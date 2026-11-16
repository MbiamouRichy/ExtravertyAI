import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import * as billingPlanChange from "../lib/billing-plan-change";
import * as pricing from "../lib/pricing";
import * as planFeatures from "../lib/plan-features";
import { getPolarDefaultCard, polarPaymentSettingsUrl } from "../lib/polar";

const { planChange, isPaymentHolder, maskEmail, holderManagesBilling } = billingPlanChange;
const PROJECT = "cmuhe8ap1000004l64j9yddk1";

test("plan changes: upgrade now with the difference, downgrade at renewal, free during trial", () => {
  assert.deepEqual(planChange("active", "starter", "business"), {
    kind: "upgrade",
    proration: "invoice",
  });
  assert.deepEqual(planChange("active", "business", "pro"), {
    kind: "downgrade",
    proration: "next_period",
  });
  assert.deepEqual(planChange("trialing", "business", "starter"), {
    kind: "trial",
    proration: "prorate",
  });
  assert.equal(planChange("active", "pro", "pro"), null);
});

test("the payment holder is recognised by address only, without exposing it", () => {
  assert.equal(isPaymentHolder(" Owner@Example.test ", "owner@example.test"), true);
  assert.equal(isPaymentHolder("billing@example.test", "owner@example.test"), false);
  assert.equal(isPaymentHolder("", ""), false);
  assert.equal(isPaymentHolder(undefined, null), false);
  assert.equal(maskEmail("richy@gmail.com"), "r•••@gmail.com");
  assert.equal(maskEmail("pas-une-adresse"), "un autre compte");
});

test("the holder keeps billing rights only with an owner or billing role", async () => {
  const tx = (role: string | null) =>
    ({
      projectMembership: {
        findFirst: async (query: { where: { user: { email: { equals: string } } } }) => {
          assert.equal(query.where.user.email.equals, "owner@example.test");
          return role ? { role } : null;
        },
      },
    }) as never;
  assert.equal(await holderManagesBilling(tx("OWNER"), PROJECT, "Owner@example.test"), true);
  assert.equal(await holderManagesBilling(tx("BILLING"), PROJECT, "owner@example.test"), true);
  // Ancien propriétaire devenu administrateur, ou parti du projet.
  assert.equal(await holderManagesBilling(tx("ADMIN"), PROJECT, "owner@example.test"), false);
  assert.equal(await holderManagesBilling(tx(null), PROJECT, "owner@example.test"), false);
});

test("the Polar portal opens on payment settings, not on the list of subscriptions", () => {
  const session = "?customer_session_token=polar_cst_1";
  assert.equal(
    polarPaymentSettingsUrl(`https://sandbox.polar.sh/extraverty/portal${session}`),
    `https://sandbox.polar.sh/extraverty/portal/settings${session}`,
  );
  assert.equal(
    polarPaymentSettingsUrl(`https://polar.sh/extraverty/portal/overview${session}`),
    `https://polar.sh/extraverty/portal/settings${session}`,
  );
  // Adresse inattendue : laissée telle quelle plutôt que devinée.
  assert.equal(
    polarPaymentSettingsUrl(`https://polar.sh/other/path${session}`),
    `https://polar.sh/other/path${session}`,
  );
});

test("the trial offer is 5 days and 100 messages", () => {
  assert.equal(pricing.TRIAL_DAYS, 5);
  assert.equal(pricing.TRIAL_MESSAGES, 100);
});

class SettingsError extends Error {}

type Options = {
  anonymous?: boolean;
  forbidden?: boolean;
  locked?: boolean;
  foreign?: boolean;
  otherProject?: boolean;
  status?: string;
  cancelling?: boolean;
  from?: string;
  pending?: string;
  members?: number;
  holderRole?: string | null;
  productMismatch?: boolean;
  notHolder?: boolean;
};

function setup(options: Options = {}) {
  const calls: unknown[] = [];
  const exports: Record<string, (...args: unknown[]) => Promise<Record<string, unknown>>> = {};
  const tx = {
    $queryRaw: async () => [{ locked: !options.locked }],
    projectMembership: {
      count: async () => options.members ?? 1,
      findFirst: async () => {
        const role = options.holderRole === undefined ? "OWNER" : options.holderRole;
        return role ? { role } : null;
      },
    },
    settingsAudit: {
      create: async ({ data }: { data: { action: string } }) =>
        void calls.push({ audit: data.action }),
    },
  };
  const subscription = () => ({
    id: "sub_ours",
    customer_id: options.foreign ? "cus_foreign" : "cus_ours",
    product_id: `prod_${options.from ?? "pro"}`,
    status: options.status ?? "active",
    cancel_at_period_end: !!options.cancelling,
    metadata: { projectId: options.otherProject ? "cmuhe8ap1000004l64j9other" : PROJECT },
    pending_update: options.pending
      ? { product_id: `prod_${options.pending}`, applies_at: "2026-12-01T00:00:00Z" }
      : null,
    customer: { email: "owner@example.test" },
  });
  const modules: Record<string, unknown> = {
    zod: { z },
    "next/cache": { revalidatePath: () => {} },
    "@/lib/auth-server": {
      getSession: async () =>
        options.anonymous
          ? null
          : {
              user: {
                id: "actor",
                email: options.notHolder ? "billing@example.test" : "owner@example.test",
                emailVerified: true,
              },
            },
    },
    "@/lib/prisma": {
      default: { $transaction: async (fn: (client: typeof tx) => unknown) => fn(tx) },
    },
    "@/lib/project-settings": {
      SettingsError,
      requireProjectPermission: async (
        _tx: unknown,
        projectId: unknown,
        user: unknown,
        permission: unknown,
      ) => {
        assert.equal(projectId, PROJECT);
        assert.equal(user, "actor");
        assert.equal(permission, "billing.manage");
        if (options.forbidden) throw new SettingsError("Interdit");
        return {
          project: {
            id: PROJECT,
            internal: false,
            deletionPending: false,
            stripeCustomerId: "cus_ours",
            stripeSubscriptionId: "sub_ours",
            settingsVersion: 3,
            billingEventCreated: 100,
            billingRevision: 7,
          },
        };
      },
    },
    "@/lib/checkout-price": { matchesPolarProduct: () => !options.productMismatch },
    "@/lib/billing-polar": {
      planForPolarProduct: (id: string) => {
        const plan = id.replace(/^prod_/, "");
        if (!["starter", "pro", "business"].includes(plan)) throw new Error("UNKNOWN");
        return plan;
      },
      syncPolarSubscription: async (
        _client: unknown,
        sub: { product_id: string },
        watermark: number,
        projectId: string,
        revision: number,
      ) => void calls.push({ sync: sub.product_id, watermark, projectId, revision }),
    },
    "@/lib/billing-plan-change": billingPlanChange,
    "@/lib/plan-features": planFeatures,
    "@/lib/pricing": pricing,
    "@/lib/polar": {
      getPolarSubscription: async () => {
        calls.push("retrieve");
        return subscription();
      },
      getPolarProduct: async (id: string) => ({ id }),
      polarProductId: (plan: string) => `prod_${plan}`,
      changePolarSubscriptionProduct: async (id: string, product: string, proration: string) => {
        calls.push({ change: id, product, proration });
        return { ...subscription(), product_id: product };
      },
      clearPolarPendingUpdate: async (id: string) => void calls.push({ clearPending: id }),
      getPolarCustomer: async (id: string) => {
        calls.push("customer");
        return { id, email: "owner@example.test" };
      },
      createPolarPortalUrl: async (customer: string, returnUrl: string, page: string) => {
        calls.push({ portal: customer, returnUrl, page });
        return "https://sandbox.polar.sh/extraverty/portal/settings";
      },
    },
  };
  const source = ts.transpileModule(readFileSync("app/actions/billing-plan.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(source, {
    exports,
    console: { error: () => {} },
    process: { env: { NEXT_PUBLIC_APP_URL: "https://app.example.test" } },
    require: (name: string) => {
      assert.ok(name in modules, name);
      return modules[name];
    },
  });
  return {
    change: (plan: unknown) => exports.changeProjectPlan({ projectId: PROJECT, plan }),
    payment: () => exports.openProjectPaymentSettings(PROJECT),
    calls,
  };
}
// Les objets créés dans le contexte vm n'ont pas les prototypes du test.
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

test("plan change requires a session, a valid plan and the billing permission before Polar", async () => {
  for (const options of [{ anonymous: true }, { forbidden: true }, { locked: true }]) {
    const s = setup(options);
    assert.equal((await s.change("business")).success, false);
    assert.equal(s.calls.length, 0);
  }
  const s = setup();
  assert.equal((await s.change("enterprise")).success, false);
  assert.equal((await s.change(undefined)).success, false);
  assert.equal(s.calls.length, 0);
});

test("plan change refuses another project's subscription or one that is not up to date", async () => {
  for (const options of [
    { foreign: true },
    { otherProject: true },
    { status: "past_due" },
    { cancelling: true },
  ]) {
    const s = setup(options);
    assert.equal((await s.change("business")).success, false, JSON.stringify(options));
    assert.deepEqual(plain(s.calls), ["retrieve"]);
  }
});

test("an upgrade applies now, charges the difference and is audited", async () => {
  const s = setup({ from: "pro" });
  const result = await s.change("business");
  assert.equal(result.success, true);
  assert.match(String(result.message), /Business activée/);
  assert.deepEqual(plain(s.calls), [
    "retrieve",
    { change: "sub_ours", product: "prod_business", proration: "invoice" },
    { audit: "billing.plan_changed.pro.business" },
    { sync: "prod_business", watermark: 100, projectId: PROJECT, revision: 7 },
  ]);
});

test("a downgrade waits for renewal and respects the target plan's team seats", async () => {
  const full = setup({ from: "business", members: 3 });
  const refused = await full.change("starter");
  assert.equal(refused.success, false);
  assert.match(String(refused.error), /3 utilisateurs et l’offre Starter en comprend 2/);
  assert.deepEqual(plain(full.calls), ["retrieve"]);

  const s = setup({ from: "business", members: 2 });
  assert.equal((await s.change("starter")).success, true);
  assert.deepEqual(plain(s.calls).slice(0, 2), [
    "retrieve",
    { change: "sub_ours", product: "prod_starter", proration: "next_period" },
  ]);
});

test("during the trial a plan change is free and keeps the trial quota", async () => {
  const s = setup({ from: "starter", status: "trialing" });
  const result = await s.change("business");
  assert.equal(result.success, true);
  assert.match(String(result.message), /fin de l’essai/);
  assert.deepEqual(plain(s.calls)[1], {
    change: "sub_ours",
    product: "prod_business",
    proration: "prorate",
  });
});

test("nothing is charged to a payer who no longer manages this project's billing", async () => {
  for (const holderRole of ["ADMIN", null]) {
    const s = setup({ holderRole });
    const result = await s.change("business");
    assert.equal(result.success, false);
    assert.match(String(result.error), /payé par o•••@example\.test/);
    assert.deepEqual(plain(s.calls), ["retrieve"]);
  }
});

test("a scheduled change can be cancelled, and repeating it is idempotent", async () => {
  const same = setup({ from: "pro" });
  assert.equal((await same.change("pro")).success, false);
  assert.deepEqual(plain(same.calls), ["retrieve"]);

  const cancel = setup({ from: "business", pending: "starter" });
  assert.equal((await cancel.change("business")).success, true);
  assert.deepEqual(plain(cancel.calls), [
    "retrieve",
    { clearPending: "sub_ours" },
    { audit: "billing.plan_change_cancelled" },
  ]);

  const repeat = setup({ from: "business", pending: "starter" });
  assert.equal((await repeat.change("starter")).success, true);
  assert.deepEqual(plain(repeat.calls), ["retrieve"]);
});

test("a product that no longer matches the displayed price is refused", async () => {
  const s = setup({ productMismatch: true });
  assert.equal((await s.change("business")).success, false);
  assert.deepEqual(plain(s.calls), ["retrieve"]);
});

test("payment settings open only for the holder, on the payment page of the portal", async () => {
  const s = setup();
  const result = await s.payment();
  assert.equal(result.success, true);
  assert.deepEqual(plain(s.calls), [
    "customer",
    {
      portal: "cus_ours",
      returnUrl: `https://app.example.test/projects/${PROJECT}/billing#paiement`,
      page: "payment",
    },
  ]);
  const member = setup({ notHolder: true });
  const refused = await member.payment();
  assert.equal(refused.success, false);
  assert.match(String(refused.error), /Seul le titulaire du moyen de paiement \(o•••@example\.test\)/);
  assert.deepEqual(plain(member.calls), ["customer"]);
  const forbidden = setup({ forbidden: true });
  assert.equal((await forbidden.payment()).success, false);
  assert.equal(forbidden.calls.length, 0);
});

test("the card shown is the default one, or the same card saved for several projects", async () => {
  const card = (id: string, last4: string) => ({
    id,
    type: "card",
    method_metadata: { brand: "visa", last4, exp_month: 4, exp_year: 2030, wallet: null },
  });
  const realFetch = globalThis.fetch;
  const previousToken = process.env.POLAR_ACCESS_TOKEN;
  process.env.POLAR_ACCESS_TOKEN = "polar_test";
  const run = async (items: unknown[], defaultId: string | null = null) => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ items }), { status: 200 })) as typeof fetch;
    return getPolarDefaultCard({ id: "cus_1", email: "o@example.test", default_payment_method_id: defaultId });
  };
  try {
    assert.equal(await run([]), null);
    assert.deepEqual(await run([card("pm_1", "4242"), card("pm_2", "4242")]), {
      brand: "visa",
      last4: "4242",
      expMonth: 4,
      expYear: 2030,
      wallet: null,
    });
    assert.equal(await run([card("pm_1", "4242"), card("pm_2", "1881")]), "several");
    assert.equal(
      ((await run([card("pm_1", "4242"), card("pm_2", "1881")], "pm_2")) as { last4: string }).last4,
      "1881",
    );
    // Métadonnées inattendues : rien d'affiché plutôt qu'une valeur douteuse.
    assert.equal(await run([{ id: "pm_x", type: "card", method_metadata: { last4: "12" } }]), null);
  } finally {
    globalThis.fetch = realFetch;
    if (previousToken === undefined) delete process.env.POLAR_ACCESS_TOKEN;
    else process.env.POLAR_ACCESS_TOKEN = previousToken;
  }
});
