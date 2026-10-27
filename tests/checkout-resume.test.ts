import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { z } from "zod";
import * as checkoutPrice from "../lib/checkout-price";
import * as permissions from "../lib/project-permissions";
import * as pricing from "../lib/pricing";
import * as billingDisplay from "../lib/billing-display";
import { needsInitialCheckout } from "../lib/billing-display";

const PROJECT_ID = "cmuhe8ap1000004l64j9yddk1";

test("only a project whose first payment never went through needs a new checkout", () => {
  const unpaid = { status: "inactive", stripeCustomerId: null, stripeSubscriptionId: null };
  assert.equal(needsInitialCheckout(unpaid), true);
  assert.equal(needsInitialCheckout({ ...unpaid, stripeCustomerId: "cus_1" }), false);
  assert.equal(needsInitialCheckout({ ...unpaid, stripeSubscriptionId: "sub_1" }), false);
  // Projet actif sans Stripe (ajouté à la main) : jamais refacturé.
  assert.equal(needsInitialCheckout({ ...unpaid, status: "active" }), false);
  assert.equal(needsInitialCheckout({ ...unpaid, status: "trialing" }), false);
});

type Project = {
  plan: string;
  status: string;
  deletionPending: boolean;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
};

function loadResume(role: string | null, project: Partial<Project> = {}) {
  const sessions: Array<Record<string, unknown>> = [];
  const plan = pricing.PRICING_PLANS.find((p) => p.id === "pro")!;
  const modules: Record<string, unknown> = {
    crypto: { default: crypto },
    "next/cache": { revalidatePath: () => undefined },
    "@/lib/prisma": {
      default: {
        projectMembership: {
          findUnique: async () =>
            role && {
              role,
              project: {
                plan: "pro",
                status: "inactive",
                deletionPending: false,
                stripeCustomerId: null,
                stripeSubscriptionId: null,
                ...project,
              },
            },
        },
      },
    },
    "@/lib/auth-server": {
      getSession: async () => ({ user: { id: "u", email: "owner@example.test" } }),
    },
    "@/lib/stripe": {
      stripe: {
        prices: {
          retrieve: async () => ({
            active: true,
            currency: "usd",
            unit_amount: plan.priceCents,
            billing_scheme: "per_unit",
            type: "recurring",
            recurring: { interval: "month", interval_count: 1, usage_type: "licensed" },
            transform_quantity: null,
          }),
        },
        checkout: {
          sessions: {
            create: async (params: Record<string, unknown>) => {
              sessions.push(params);
              return { url: "https://checkout.stripe.com/c/pay/test" };
            },
          },
        },
      },
    },
    "@/lib/checkout-price": checkoutPrice,
    "@/lib/project-creation-schema": { ProjectCheckoutSchema: z.object({}) },
    zod: { default: z, z },
    "@/lib/rate-limit": { allowRequest: () => true },
    "@/lib/project-permissions": permissions,
    "@/lib/pricing": pricing,
    "@/lib/billing-display": billingDisplay,
    "./evolutionAPI": {},
  };
  const exports: Record<string, (input: unknown) => Promise<{ success: boolean; url?: string; error?: string }>> = {};
  const source = ts.transpileModule(readFileSync("app/actions/stripe-actions.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  runInNewContext(source, {
    exports,
    console: { error: () => {} },
    process: {
      env: {
        NEXT_PUBLIC_APP_URL: "https://app.example.test/",
        STRIPE_PRO_PLAN_ID: "price_pro",
      },
    },
    require: (name: string) => {
      assert.ok(name in modules, name);
      return modules[name];
    },
  });
  return { resume: exports.resumeProjectCheckout, sessions };
}

test("the owner and billing role resume an abandoned checkout for the same project", async () => {
  for (const role of ["OWNER", "BILLING"]) {
    const { resume, sessions } = loadResume(role);
    const result = await resume({ projectId: PROJECT_ID });
    assert.equal(result.success, true, role);
    assert.equal(result.url, "https://checkout.stripe.com/c/pay/test");
    const [params] = sessions as Array<{
      metadata: { projectId: string };
      subscription_data: { metadata: { projectId: string }; trial_period_days: number };
      line_items: Array<{ price: string }>;
      success_url: string;
      cancel_url: string;
    }>;
    // Le webhook rattache l'abonnement au projet existant, sans en créer un autre.
    assert.equal(params.metadata.projectId, PROJECT_ID);
    assert.equal(params.subscription_data.metadata.projectId, PROJECT_ID);
    assert.equal(params.subscription_data.trial_period_days, 10);
    assert.equal(params.line_items[0].price, "price_pro");
    assert.equal(params.success_url, `https://app.example.test/projects/${PROJECT_ID}?success=true`);
    assert.equal(params.cancel_url, `https://app.example.test/projects/${PROJECT_ID}/billing?canceled=true`);
  }
});

test("resuming is refused without the right role or once billing exists", async () => {
  for (const role of [null, "ADMIN", "SUPERVISOR", "AGENT", "VIEWER"]) {
    const { resume, sessions } = loadResume(role);
    assert.equal((await resume({ projectId: PROJECT_ID })).success, false, String(role));
    assert.equal(sessions.length, 0);
  }
  for (const project of [
    { stripeCustomerId: "cus_1" },
    { stripeSubscriptionId: "sub_1" },
    { status: "active" },
    { deletionPending: true },
  ]) {
    const { resume, sessions } = loadResume("OWNER", project);
    assert.equal((await resume({ projectId: PROJECT_ID })).success, false, JSON.stringify(project));
    assert.equal(sessions.length, 0);
  }
  const { resume } = loadResume("OWNER");
  assert.equal((await resume({ projectId: "pas-un-id" })).success, false);
});
