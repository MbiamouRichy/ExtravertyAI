import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { isRecentSession } from "../lib/recent-session";
class SettingsError extends Error {}
function setup(
  options: {
    anonymous?: boolean;
    forbidden?: boolean;
    foreign?: boolean;
    invoice?: boolean;
    status?: string;
    cancelling?: boolean;
    /** Connexion de plus de 10 minutes. */
    staleLogin?: boolean;
  } = {},
) {
  const calls: unknown[] = [];
  const exports: Record<
    string,
    (...args: unknown[]) => Promise<{ success: boolean; url?: string }>
  > = {};
  const modules: Record<string, unknown> = {
    zod: { z },
    "next/cache": { revalidatePath: () => {} },
    "next/navigation": { redirect: () => {} },
    "@/lib/agent-config": {},
    "@/lib/chat-realtime": {},
    "@/lib/whatsapp-settings-sync": {},
    "@/lib/auth-server": {
      getSession: async () =>
        options.anonymous
          ? null
          : {
              user: { id: "actor" },
              session: {
                createdAt: new Date(Date.now() - (options.staleLogin ? 11 : 1) * 60_000),
              },
            },
    },
    "@/lib/recent-session": { isRecentSession },
    "@/lib/prisma": {
      default: { $transaction: async (fn: (tx: object) => unknown) => fn({}) },
    },
    "@/lib/project-settings": {
      SettingsError,
      requireProjectAdmin: async () => {
        throw new Error("Billing must not use the settings check.");
      },
      // Propriétaire et rôle Facturation : la permission est vérifiée côté serveur.
      requireProjectPermission: async (
        _tx: unknown,
        _project: unknown,
        user: unknown,
        permission: unknown,
      ) => {
        assert.equal(user, "actor");
        assert.equal(permission, "billing.manage");
        if (options.forbidden) throw new SettingsError("Interdit");
        return {
          project: {
            id: "cmuhe8ap1000004l64j9yddk1",
            plan: "pro",
            stripeCustomerId: "cus_ours",
            stripeSubscriptionId: "sub_ours",
            deletionPending: false,
          },
        };
      },
    },
    "@/lib/polar": {
      getPolarSubscription: async (id: string) => {
        calls.push("retrieve");
        return {
          id,
          customer_id: options.foreign ? "cus_foreign" : "cus_ours",
          status: options.status ?? "active",
          cancel_at_period_end: !!options.cancelling,
          customer: { email: "owner@example.test" },
        };
      },
      isEndedPolarSubscription: (sub: { status: string }) =>
        ["canceled", "unpaid", "incomplete_expired"].includes(sub.status),
      cancelPolarSubscription: async (id: string) => void calls.push({ cancelAtPeriodEnd: id }),
      revokePolarSubscription: async (id: string) => void calls.push({ revoke: id }),
      resumePolarSubscription: async (id: string) => void calls.push({ resume: id }),
      createPolarPortalUrl: async (customer: string, returnUrl: string) => {
        calls.push({ portal: customer, returnUrl });
        return "https://sandbox.polar.sh/portal/session";
      },
      createPolarCheckout: async (input: unknown) => {
        calls.push({ checkout: input });
        return "https://sandbox.polar.sh/checkout/renew";
      },
      polarProductId: (plan: string) => `prod_${plan}`,
      getPolarProduct: async () => ({}),
    },
    "@/lib/checkout-price": { matchesPolarProduct: () => true },
    "@/lib/pricing": { resolvePlanId: (plan: string) => plan },
  };
  const source = ts.transpileModule(
    readFileSync("app/actions/project-settings.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
  runInNewContext(source, {
    exports,
    URL,
    process: {
      env: { NEXT_PUBLIC_APP_URL: "https://app.example.test" },
    },
    require: (name: string) => {
      assert.ok(name in modules, name);
      return modules[name];
    },
  });
  return {
    call: (intent: unknown) =>
      exports.openProjectBillingPortal("cmuhe8ap1000004l64j9yddk1", intent),
    cancel: () => exports.cancelProjectSubscription("cmuhe8ap1000004l64j9yddk1"),
    calls,
  };
}
const BILLING_URL =
  "https://app.example.test/projects/cmuhe8ap1000004l64j9yddk1/billing";
// Les objets créés dans le contexte vm n'ont pas les prototypes du test.
const sameCalls = (actual: unknown, expected: unknown) =>
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
test("billing plan actions validate intent and require the project owner before Polar", async () => {
  for (const options of [{ anonymous: true }, { forbidden: true }]) {
    const s = setup(options);
    assert.equal((await s.call("upgrade")).success, false);
    assert.equal(s.calls.length, 0);
  }
  const s = setup();
  assert.equal((await s.call("unexpected")).success, false);
  assert.equal(s.calls.length, 0);
});
test("billing rejects a mismatched customer and opens only the project's customer portal", async () => {
  const foreign = setup({ foreign: true });
  assert.equal((await foreign.call("upgrade")).success, false);
  assert.deepEqual(foreign.calls, ["retrieve"]);
  const s = setup();
  const result = await s.call("upgrade");
  assert.equal(result.url, "https://sandbox.polar.sh/portal/session");
  sameCalls(s.calls, ["retrieve", { portal: "cus_ours", returnUrl: BILLING_URL }]);
});
test("an unpaid subscription must be settled before changing plan", async () => {
  const s = setup({ status: "past_due" });
  assert.equal((await s.call("upgrade")).success, false);
  assert.deepEqual(s.calls, ["retrieve"]);
});
test("renewing an ended subscription revokes it and opens a paid checkout without trial", async () => {
  const s = setup({ status: "canceled" });
  const result = await s.call("renew");
  assert.equal(result.url, "https://sandbox.polar.sh/checkout/renew");
  sameCalls(s.calls, [
    "retrieve",
    { revoke: "sub_ours" },
    {
      checkout: {
        productId: "prod_pro",
        projectId: "cmuhe8ap1000004l64j9yddk1",
        plan: "pro",
        email: "owner@example.test",
        successUrl: `${BILLING_URL}?success=true`,
        returnUrl: BILLING_URL,
        trial: false,
      },
    },
  ]);
});
test("renewal lifts a scheduled cancellation instead of opening the portal", async () => {
  const s = setup({ cancelling: true });
  const result = await s.call("renew");
  assert.equal(result.url, BILLING_URL);
  sameCalls(s.calls, ["retrieve", { resume: "sub_ours" }]);
});
test("cancellation requires the billing permission and checks the customer before Polar", async () => {
  for (const options of [{ anonymous: true }, { forbidden: true }]) {
    const s = setup(options);
    assert.equal((await s.cancel()).success, false);
    assert.equal(s.calls.length, 0);
  }
  const foreign = setup({ foreign: true });
  assert.equal((await foreign.cancel()).success, false);
  assert.deepEqual(foreign.calls, ["retrieve"]);
});
test("an up-to-date subscription is cancelled at period end, only once", async () => {
  const s = setup();
  assert.equal((await s.cancel()).success, true);
  sameCalls(s.calls, ["retrieve", { cancelAtPeriodEnd: "sub_ours" }]);
  const scheduled = setup({ cancelling: true });
  assert.equal((await scheduled.cancel()).success, true);
  assert.deepEqual(scheduled.calls, ["retrieve"]);
});
test("an unpaid subscription stops now and an ended one is refused", async () => {
  const s = setup({ status: "past_due" });
  assert.equal((await s.cancel()).success, true);
  sameCalls(s.calls, ["retrieve", { revoke: "sub_ours" }]);
  const ended = setup({ status: "canceled" });
  assert.equal((await ended.cancel()).success, false);
  assert.deepEqual(ended.calls, ["retrieve"]);
});
test("cancellation refuses a login older than ten minutes before Polar", async () => {
  const s = setup({ staleLogin: true });
  const result = (await s.cancel()) as { success: boolean; code?: string };
  assert.equal(result.success, false);
  assert.equal(result.code, "REAUTH_REQUIRED");
  assert.equal(s.calls.length, 0);
});
