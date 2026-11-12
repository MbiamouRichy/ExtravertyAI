import type { PlanId } from "./pricing";

export { verifyWebhookSignature } from "./standard-webhook";

export type SandboxProvider = "polar" | "dodo";

type Env = Record<string, string | undefined>;

export const SANDBOX_TRIAL_DAYS = 10;

// Les URL sont figées : ce module ne peut jamais viser une API de production.
const POLAR_CHECKOUTS_URL = "https://sandbox-api.polar.sh/v1/checkouts/";
const DODO_CHECKOUTS_URL = "https://test.dodopayments.com/checkouts";
const DODO_SUBSCRIPTIONS_URL = "https://test.dodopayments.com/subscriptions";

export function isSandboxProvider(value: unknown): value is SandboxProvider {
  return value === "polar" || value === "dodo";
}

function required(env: Env, name: string) {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Variable manquante : ${name}`);
  return value;
}

function dodoTestKey(env: Env) {
  const token = required(env, "DODO_TEST_API_KEY");
  if (!token.startsWith("dodo_test_"))
    throw new Error("DODO_TEST_API_KEY doit être une clé de test (dodo_test_).");
  return token;
}

export type DodoSubscriptionChange =
  | { action: "bill-soon"; minutes: number }
  | { action: "cancel-now" }
  | { action: "cancel-at-period-end" };

/** Modifie un abonnement Dodo de test : prélèvement avancé ou annulation. */
export function buildDodoSubscriptionUpdate(
  subscriptionId: string,
  change: DodoSubscriptionChange,
  env: Env,
  nowMs = Date.now(),
) {
  if (!/^sub_[A-Za-z0-9]+$/.test(subscriptionId))
    throw new Error("Identifiant d'abonnement Dodo invalide.");
  const body = (() => {
    if (change.action === "cancel-now") return { status: "cancelled" };
    if (change.action === "cancel-at-period-end")
      return { cancel_at_next_billing_date: true };
    if (!Number.isSafeInteger(change.minutes) || change.minutes <= 0)
      throw new Error("Le délai doit être un nombre de minutes positif.");
    return {
      next_billing_date: new Date(nowMs + change.minutes * 60_000).toISOString(),
    };
  })();
  return {
    url: `${DODO_SUBSCRIPTIONS_URL}/${subscriptionId}`,
    token: dodoTestKey(env),
    body,
  };
}

export function webhookSecretName(provider: SandboxProvider) {
  return provider === "polar"
    ? "POLAR_SANDBOX_WEBHOOK_SECRET"
    : "DODO_TEST_WEBHOOK_KEY";
}

export function buildCheckoutRequest(
  provider: SandboxProvider,
  input: { plan: PlanId; projectId: string; email: string; returnUrl: string },
  env: Env,
) {
  const plan = input.plan.toUpperCase();
  const metadata = { projectId: input.projectId, plan: input.plan };
  const trialDays = Number(env.PAYMENT_SANDBOX_TRIAL_DAYS) || SANDBOX_TRIAL_DAYS;
  if (provider === "polar") {
    return {
      url: POLAR_CHECKOUTS_URL,
      token: required(env, "POLAR_SANDBOX_ACCESS_TOKEN"),
      body: {
        products: [required(env, `POLAR_SANDBOX_${plan}_PRODUCT_ID`)],
        customer_email: input.email,
        metadata,
        success_url: input.returnUrl,
        trial_interval: "day",
        trial_interval_count: trialDays,
      },
    };
  }
  return {
    url: DODO_CHECKOUTS_URL,
    token: dodoTestKey(env),
    body: {
      product_cart: [
        { product_id: required(env, `DODO_TEST_${plan}_PRODUCT_ID`), quantity: 1 },
      ],
      customer: { email: input.email },
      metadata,
      subscription_data: { trial_period_days: trialDays },
      return_url: input.returnUrl,
    },
  };
}

export function checkoutUrlFrom(provider: SandboxProvider, response: unknown) {
  const body = (response ?? {}) as Record<string, unknown>;
  const url = provider === "polar" ? body.url : body.checkout_url;
  if (typeof url !== "string" || !url.startsWith("https://"))
    throw new Error("Réponse de paiement sans URL exploitable.");
  return url;
}

export type SandboxEventSummary = {
  provider: SandboxProvider;
  type: string;
  subscriptionId: string | null;
  status: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  trial: string | number | null;
  projectId: string | null;
  /** Commandes Polar : distingue l'essai à 0 d'un encaissement réel. */
  amount: number | null;
  billingReason: string | null;
  /** Champs dont la synchronisation a besoin et absents de l'événement. */
  missing: string[];
};

function text(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

/**
 * Réduit un événement aux champs utiles au billing, sans e-mail ni donnée
 * client, pour mesurer l'écart avec ce qu'attend la synchronisation des abonnements.
 */
export function summarizeEvent(
  provider: SandboxProvider,
  payload: unknown,
): SandboxEventSummary {
  const event = (payload ?? {}) as { type?: unknown; data?: unknown };
  const data = (event.data ?? {}) as Record<string, unknown>;
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  const polar = provider === "polar";
  const type = text(event.type) ?? "unknown";
  const summary: Omit<SandboxEventSummary, "missing"> = {
    provider,
    type,
    // Sur une commande Polar, `id` désigne la commande et non l'abonnement.
    subscriptionId: text(
      polar && !type.startsWith("order.") ? data.id : data.subscription_id,
    ),
    status: text(data.status),
    periodStart: text(
      polar ? data.current_period_start : data.previous_billing_date,
    ),
    periodEnd: text(polar ? data.current_period_end : data.next_billing_date),
    trial: polar
      ? text(data.trial_end)
      : typeof data.trial_period_days === "number"
        ? data.trial_period_days
        : null,
    projectId: text(metadata.projectId),
    amount: typeof data.total_amount === "number" ? data.total_amount : null,
    billingReason: text(data.billing_reason),
  };
  const fields = [
    "subscriptionId",
    "status",
    "periodStart",
    "periodEnd",
    "projectId",
  ] as const;
  return {
    ...summary,
    missing: type.startsWith("subscription.")
      ? fields.filter((field) => !summary[field])
      : [],
  };
}
