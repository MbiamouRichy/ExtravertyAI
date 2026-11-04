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
            stripeCustomerId: "cus_ours",
            stripeSubscriptionId: "sub_ours",
            deletionPending: false,
          },
        };
      },
    },
    "@/lib/polar": {},
    "@/lib/checkout-price": {},
    "@/lib/pricing": {},
    "@/lib/stripe": {
      stripe: {
        prices: {
          retrieve: async () => ({
            id: "price_pro",
            currency: "usd",
            active: true,
          }),
        },
        subscriptions: {
          retrieve: async () => {
            calls.push("retrieve");
            return {
              id: "sub_ours",
              customer: options.foreign ? "cus_foreign" : "cus_ours",
              status: options.status ?? "active",
              cancel_at_period_end: !!options.cancelling,
              cancel_at: null,
              items: {
                data: [{ price: { id: "price_current", currency: "usd" } }],
              },
              latest_invoice: options.invoice
                ? {
                    status: "open",
                    hosted_invoice_url: "https://invoice.stripe.com/i/test",
                  }
                : null,
            };
          },
          update: async (id: string, input: unknown) => {
            calls.push({ update: id, input });
          },
          cancel: async (id: string) => {
            calls.push({ cancel: id });
          },
        },
        billingPortal: {
          sessions: {
            create: async (input: unknown) => {
              calls.push(input);
              return { url: "https://billing.stripe.com/p/session" };
            },
          },
        },
      },
    },
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
      env: {
        NEXT_PUBLIC_APP_URL: "https://app.example.test",
        STRIPE_PRO_PLAN_ID: "price_pro",
      },
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
test("billing plan actions validate intent and require the project owner before Stripe", async () => {
  for (const options of [{ anonymous: true }, { forbidden: true }]) {
    const s = setup(options);
    assert.equal((await s.call("upgrade")).success, false);
    assert.equal(s.calls.length, 0);
  }
  const s = setup();
  assert.equal((await s.call("unexpected")).success, false);
  assert.equal(s.calls.length, 0);
});
test("billing rejects a mismatched customer and opens only the project's subscription update", async () => {
  const foreign = setup({ foreign: true });
  assert.equal((await foreign.call("upgrade")).success, false);
  assert.equal(foreign.calls.length, 1);
  const s = setup();
  assert.equal((await s.call("upgrade")).success, true);
  const input = s.calls[1] as {
    customer: string;
    flow_data: { subscription_update: { subscription: string } };
  };
  assert.equal(input.customer, "cus_ours");
  assert.equal(input.flow_data.subscription_update.subscription, "sub_ours");
});
test("renewal opens the outstanding invoice without creating another subscription", async () => {
  const s = setup({ invoice: true });
  const result = await s.call("renew");
  assert.equal(result.url, "https://invoice.stripe.com/i/test");
  assert.equal(s.calls.length, 1);
});
// Les objets créés dans le contexte vm n'ont pas les prototypes du test.
const sameCall = (actual: unknown, expected: unknown) =>
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
test("cancellation requires the billing permission and checks the customer before Stripe", async () => {
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
  sameCall(s.calls[1], {
    update: "sub_ours",
    input: { cancel_at_period_end: true },
  });
  const scheduled = setup({ cancelling: true });
  assert.equal((await scheduled.cancel()).success, true);
  assert.deepEqual(scheduled.calls, ["retrieve"]);
});
test("an unpaid subscription stops now and an ended one is refused", async () => {
  const s = setup({ status: "past_due" });
  assert.equal((await s.cancel()).success, true);
  sameCall(s.calls[1], { cancel: "sub_ours" });
  const ended = setup({ status: "canceled" });
  assert.equal((await ended.cancel()).success, false);
  assert.deepEqual(ended.calls, ["retrieve"]);
});
test("renewal lifts a scheduled cancellation instead of opening the portal", async () => {
  const s = setup({ cancelling: true });
  const result = await s.call("renew");
  assert.equal(result.url, "https://app.example.test/projects/cmuhe8ap1000004l64j9yddk1/billing");
  sameCall(s.calls[1], {
    update: "sub_ours",
    input: { cancel_at_period_end: false },
  });
});
test("cancellation refuses a login older than ten minutes before Stripe", async () => {
  const s = setup({ staleLogin: true });
  const result = (await s.cancel()) as { success: boolean; code?: string };
  assert.equal(result.success, false);
  assert.equal(result.code, "REAUTH_REQUIRED");
  assert.equal(s.calls.length, 0);
});
