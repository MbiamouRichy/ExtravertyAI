import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
class SettingsError extends Error {}
function setup(
  options: {
    anonymous?: boolean;
    forbidden?: boolean;
    foreign?: boolean;
    invoice?: boolean;
  } = {},
) {
  const calls: unknown[] = [];
  const exports: Record<
    string,
    (...args: unknown[]) => Promise<{ success: boolean; url?: string }>
  > = {};
  const modules: Record<string, unknown> = {
    zod: { z },
    "next/cache": {},
    "@/lib/agent-config": {},
    "@/lib/chat-realtime": {},
    "@/lib/whatsapp-settings-sync": {},
    "@/lib/auth-server": {
      getSession: async () =>
        options.anonymous ? null : { user: { id: "actor" } },
    },
    "@/lib/prisma": {
      default: { $transaction: async (fn: (tx: object) => unknown) => fn({}) },
    },
    "@/lib/project-settings": {
      SettingsError,
      requireProjectAdmin: async (
        _tx: unknown,
        _project: unknown,
        user: unknown,
        ownerOnly: unknown,
      ) => {
        assert.equal(user, "actor");
        assert.equal(ownerOnly, true);
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
              status: "active",
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
