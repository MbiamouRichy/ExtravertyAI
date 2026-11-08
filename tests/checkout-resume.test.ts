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
const VERIFICATION_ID = crypto.randomUUID();
const VERIFIED_AT = new Date("2026-11-08T08:00:00Z");
/** Objets nés dans le bac à sable vm : comparés par leur contenu. */
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

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
  numeroVerifiedAt: Date | null;
};

function loadResume(
  role: string | null,
  project: Partial<Project> = {},
  options: {
    trialAvailable?: boolean;
    emailVerified?: boolean;
    recentProjects?: number;
    burstAllowed?: boolean;
    /** Faux : aucune preuve utilisable du numéro pour ce compte. */
    proof?: boolean;
    /** Faux : la preuve a servi entre-temps (autre onglet). */
    proofUnused?: boolean;
    checkoutFails?: boolean;
  } = {},
) {
  const counted: Array<{ where: Record<string, unknown> }> = [];
  const sessions: Array<Record<string, unknown>> = [];
  const reservations: Array<[string, string]> = [];
  const created: Array<{ data: Record<string, unknown> }> = [];
  const instances: string[] = [];
  const deletedInstances: string[] = [];
  const deletedProjects: string[] = [];
  const consumed: Array<Record<string, unknown>> = [];
  const released: Array<Record<string, unknown>> = [];
  const verifiedProjects: Array<Record<string, unknown>> = [];
  const plan = pricing.PRICING_PLANS.find((p) => p.id === "pro")!;
  const modules: Record<string, unknown> = {
    crypto: { default: crypto },
    "next/cache": { revalidatePath: () => undefined },
    "@/lib/prisma": {
      default: {
        $transaction: async (run: (tx: unknown) => Promise<unknown>) => run(db),
        project: {
          findFirst: async () => null,
          create: async (args: { data: Record<string, unknown> }) => {
            created.push(args);
            return { id: PROJECT_ID };
          },
          delete: async (args: { where: { id: string } }) => void deletedProjects.push(args.where.id),
          updateMany: async (args: Record<string, unknown>) => {
            verifiedProjects.push(args);
            return { count: 1 };
          },
        },
        projectMembership: {
          count: async (args: { where: Record<string, unknown> }) => {
            counted.push(args);
            return options.recentProjects ?? 0;
          },
          findUnique: async () =>
            role && {
              role,
              project: {
                plan: "pro",
                numero: "+24166000001",
                status: "inactive",
                deletionPending: false,
                stripeCustomerId: null,
                stripeSubscriptionId: null,
                numeroVerifiedAt: VERIFIED_AT,
                ...project,
              },
            },
        },
      },
    },
    "@/lib/auth-server": {
      getSession: async () => ({
        user: {
          id: "u",
          email: "owner@example.test",
          emailVerified: options.emailVerified ?? true,
        },
      }),
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
              if (options.checkoutFails) throw new Error("stripe down");
              sessions.push(params);
              return { url: "https://checkout.stripe.com/c/pay/test" };
            },
          },
        },
      },
    },
    "@/lib/checkout-price": checkoutPrice,
    "@/lib/project-creation-schema": { ProjectCheckoutSchema: z.object({}).passthrough() },
    zod: { default: z, z },
    "@/lib/rate-limit": { allowRequest: () => options.burstAllowed ?? true },
    "@/lib/project-permissions": permissions,
    "@/lib/pricing": pricing,
    "@/lib/billing-display": billingDisplay,
    "@/lib/billing-provider": { checkoutProvider: () => "stripe" },
    "@/lib/polar": {},
    "./evolutionAPI": {
      createEvolutionInstance: async (name: string) => void instances.push(name),
      deleteEvolutionInstance: async (name: string) => void deletedInstances.push(name),
    },
    "@/lib/server-time-zone": { getBrowserTimeZone: async () => "Africa/Libreville" },
    "@/lib/phone-verification": {
      formatVerificationNumber: () => "+241 66 00 00 01",
      usableNumberProof: async () => (options.proof === false ? null : { verifiedAt: VERIFIED_AT }),
      consumeNumberProof: async (_db: unknown, input: Record<string, unknown>) => {
        if (options.proof === false || options.proofUnused === false) return false;
        consumed.push(input);
        return true;
      },
      releaseNumberProof: async (_db: unknown, input: Record<string, unknown>) =>
        void released.push(input),
    },
    "@/lib/project-number-conflict": { ownProjectNumberConflict: async () => null },
    "@/lib/trial-eligibility": {
      isTrialAvailable: async () => options.trialAvailable ?? true,
      reserveTrial: async (_db: unknown, numero: string, projectId: string) => {
        reservations.push([numero, projectId]);
        return options.trialAvailable ?? true;
      },
    },
  };
  const db = (modules["@/lib/prisma"] as { default: unknown }).default;
  const exports: Record<
    string,
    (input: unknown, options?: unknown) => Promise<{ success: boolean; url?: string; error?: string; code?: string }>
  > = {};
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
  return {
    resume: exports.resumeProjectCheckout,
    create: exports.createProjectAndCheckout,
    sessions,
    reservations,
    counted,
    created,
    instances,
    deletedInstances,
    deletedProjects,
    consumed,
    released,
    verifiedProjects,
  };
}

test("the owner and billing role resume an abandoned checkout for the same project", async () => {
  for (const role of ["OWNER", "BILLING"]) {
    const { resume, sessions, reservations } = loadResume(role);
    const result = await resume({ projectId: PROJECT_ID });
    assert.equal(result.success, true, role);
    // L'essai est réservé pour ce projet le temps du paiement.
    assert.deepEqual(reservations, [["+24166000001", PROJECT_ID]]);
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

test("a number whose trial was used resumes only after an explicit paid confirmation", async () => {
  const { resume, sessions } = loadResume("OWNER", {}, { trialAvailable: false });
  const refused = (await resume({ projectId: PROJECT_ID })) as { success: boolean; code?: string };
  assert.equal(refused.success, false);
  assert.equal(refused.code, "TRIAL_UNAVAILABLE");
  assert.equal(sessions.length, 0);

  const paid = await resume({ projectId: PROJECT_ID, withoutTrial: true });
  assert.equal(paid.success, true);
  const [params] = sessions as Array<{
    subscription_data: Record<string, unknown>;
    expires_at?: number;
  }>;
  assert.equal("trial_period_days" in params.subscription_data, false);
  assert.equal(params.expires_at, undefined);
});

test("an unverified email address cannot start a trial", async () => {
  const { resume, sessions, reservations } = loadResume("OWNER", {}, { emailVerified: false });
  const result = (await resume({ projectId: PROJECT_ID })) as { success: boolean; code?: string };
  assert.equal(result.success, false);
  assert.equal(result.code, "EMAIL_NOT_VERIFIED");
  assert.equal(sessions.length, 0);
  assert.equal(reservations.length, 0);
});

test("project creation is rate limited before any trial reservation or WhatsApp instance", async () => {
  const input = { name: "Boutique", numero: "+24166000001", plan: "pro" };
  // Limite durable : 5 projets possédés créés dans l'heure, comptés en base.
  const hourly = loadResume("OWNER", {}, { recentProjects: 5 });
  const refused = (await hourly.create(input)) as { success: boolean; error?: string };
  assert.equal(refused.success, false);
  assert.match(refused.error ?? "", /une heure/);
  assert.equal(hourly.reservations.length, 0);
  assert.equal(hourly.sessions.length, 0);
  const [{ where }] = hourly.counted;
  assert.equal(where.userId, "u");
  assert.equal(where.role, "OWNER");
  const since = (where.createdAt as { gte: Date }).gte.getTime();
  assert.ok(Math.abs(Date.now() - 60 * 60 * 1000 - since) < 5000);

  // Rafale sur la même instance : refusée avant tout appel externe.
  const burst = loadResume("OWNER", {}, { burstAllowed: false });
  const blocked = (await burst.create(input)) as { success: boolean; error?: string };
  assert.equal(blocked.success, false);
  assert.match(blocked.error ?? "", /une minute/);
  assert.equal(burst.reservations.length, 0);
});

test("a project saved before the check pays only once its number is proved", async () => {
  const unverified = { numeroVerifiedAt: null };
  // Sans preuve : ni essai réservé, ni paiement ouvert.
  const blocked = loadResume("OWNER", unverified);
  const refused = (await blocked.resume({ projectId: PROJECT_ID })) as {
    success: boolean;
    code?: string;
    number?: string;
  };
  assert.equal(refused.success, false);
  assert.equal(refused.code, "NUMBER_NOT_VERIFIED");
  assert.equal(refused.number, "+241 66 00 00 01");
  assert.equal(blocked.reservations.length, 0);
  assert.equal(blocked.sessions.length, 0);
  assert.equal(blocked.verifiedProjects.length, 0);

  // Preuve déjà utilisée ailleurs : refusée de même.
  const used = loadResume("OWNER", unverified, { proofUnused: false });
  const reused = await used.resume({ projectId: PROJECT_ID, verificationId: VERIFICATION_ID });
  assert.equal(reused.code, "NUMBER_NOT_VERIFIED");
  assert.equal(used.sessions.length, 0);

  // Bon code : le numéro du projet est marqué prouvé, puis le paiement s'ouvre.
  const proved = loadResume("OWNER", unverified);
  const result = await proved.resume({ projectId: PROJECT_ID, verificationId: VERIFICATION_ID });
  assert.equal(result.success, true);
  assert.deepEqual(plain(proved.consumed), [
    { verificationId: VERIFICATION_ID, userId: "u", numero: "+24166000001", projectId: PROJECT_ID },
  ]);
  assert.equal(proved.verifiedProjects.length, 1);
  assert.deepEqual(proved.reservations, [["+24166000001", PROJECT_ID]]);
  assert.equal(proved.sessions.length, 1);
});

test("nothing is created before the number is proved by its code", async () => {
  const input = { name: "Boutique", numero: "+24166000001", plan: "pro" };
  for (const [options, verificationId] of [
    [{}, undefined],
    [{ proof: false }, VERIFICATION_ID],
    [{}, "pas-un-uuid"],
  ] as const) {
    const attempt = loadResume("OWNER", {}, options);
    const result = await attempt.create(input, { verificationId });
    assert.equal(result.success, false, String(verificationId));
    assert.equal(result.code, "NUMBER_NOT_VERIFIED");
    assert.equal(attempt.instances.length, 0);
    assert.equal(attempt.created.length, 0);
    assert.equal(attempt.reservations.length, 0);
    assert.equal(attempt.sessions.length, 0);
  }
});

test("a proved number saves the project, spends the proof and opens the checkout", async () => {
  const input = { name: "Boutique", numero: "+24166000001", plan: "pro" };
  const ok = loadResume("OWNER");
  const result = await ok.create(input, { verificationId: VERIFICATION_ID });
  assert.equal(result.success, true);
  assert.equal(result.url, "https://checkout.stripe.com/c/pay/test");
  assert.equal(ok.instances.length, 1);
  assert.equal(ok.created[0].data.status, "inactive");
  assert.deepEqual(ok.created[0].data.numeroVerifiedAt, VERIFIED_AT);
  assert.deepEqual(plain(ok.consumed), [
    { verificationId: VERIFICATION_ID, userId: "u", numero: "+24166000001", projectId: PROJECT_ID },
  ]);
  assert.deepEqual(ok.reservations, [["+24166000001", PROJECT_ID]]);
  assert.equal(ok.sessions.length, 1);

  // La même preuve utilisée dans un autre onglet : l'instance créée est retirée.
  const race = loadResume("OWNER", {}, { proofUnused: false });
  const raced = await race.create(input, { verificationId: VERIFICATION_ID });
  assert.equal(raced.code, "NUMBER_NOT_VERIFIED");
  assert.deepEqual(race.deletedInstances, race.instances);
  assert.equal(race.sessions.length, 0);

  // Paiement impossible à préparer : projet annulé, preuve rendue pour réessayer.
  const down = loadResume("OWNER", {}, { checkoutFails: true });
  const failed = await down.create(input, { verificationId: VERIFICATION_ID });
  assert.equal(failed.success, false);
  assert.deepEqual(down.deletedProjects, [PROJECT_ID]);
  assert.deepEqual(plain(down.released), [{ verificationId: VERIFICATION_ID, userId: "u" }]);
  assert.deepEqual(down.deletedInstances, down.instances);
});
