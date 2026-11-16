import { TRIAL_DAYS, type PlanId } from "./pricing";

export type PolarSubscription = {
  id: string;
  status: string;
  customer_id: string;
  product_id: string;
  amount: number;
  currency: string;
  recurring_interval: string;
  current_period_start: string;
  current_period_end: string | null;
  trial_start: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  metadata: Record<string, unknown>;
  /** Changement d'offre programmé au début de la période suivante. */
  pending_update?: { product_id: string | null; applies_at: string } | null;
  customer?: {
    name?: string | null;
    email?: string | null;
    billing_address?: {
      line1?: string | null;
      line2?: string | null;
      postal_code?: string | null;
      city?: string | null;
      country?: string | null;
    } | null;
  };
};

export type PolarProduct = {
  is_archived: boolean;
  is_recurring: boolean;
  recurring_interval: string | null;
  recurring_interval_count?: number | null;
  prices: {
    amount_type: string;
    price_amount?: number;
    price_currency: string;
    is_archived: boolean;
  }[];
};

export type PolarOrder = {
  id: string;
  status: string;
  total_amount: number;
  currency: string;
  subscription_id: string | null;
  created_at: string;
  invoice_number: string | null;
};

export class PolarApiError extends Error {
  constructor(readonly status: number) {
    super(`POLAR_API_${status}`);
  }
}

// POLAR_SERVER=sandbox réserve les préversions à l'environnement sans argent réel.
function apiOrigin() {
  return process.env.POLAR_SERVER === "sandbox"
    ? "https://sandbox-api.polar.sh"
    : "https://api.polar.sh";
}

async function polarRequest<T>(
  path: string,
  init: { method?: string; body?: unknown; timeoutMs?: number } = {},
) {
  const token = process.env.POLAR_ACCESS_TOKEN;
  if (!token) throw new Error("POLAR_CONFIG_MISSING");
  const response = await fetch(`${apiOrigin()}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(init.timeoutMs ?? 10000),
  });
  if (!response.ok) throw new PolarApiError(response.status);
  return (response.status === 204 ? null : await response.json()) as T;
}

const segment = encodeURIComponent;

export function polarProductId(plan: PlanId) {
  return process.env[`POLAR_${plan.toUpperCase()}_PRODUCT_ID`];
}

export function getPolarSubscription(id: string) {
  return polarRequest<PolarSubscription>(`/v1/subscriptions/${segment(id)}`);
}

export function getPolarProduct(id: string) {
  return polarRequest<PolarProduct>(`/v1/products/${segment(id)}`);
}

export async function createPolarCheckout(input: {
  productId: string;
  projectId: string;
  plan: PlanId;
  email: string;
  successUrl: string;
  returnUrl: string;
  /** Pas de nouvel essai quand un abonnement terminé repart. */
  trial?: boolean;
}) {
  const checkout = await polarRequest<{ url?: unknown }>("/v1/checkouts/", {
    method: "POST",
    body: {
      products: [input.productId],
      customer_email: input.email,
      metadata: { projectId: input.projectId, plan: input.plan },
      success_url: input.successUrl,
      return_url: input.returnUrl,
      ...(input.trial === false
        ? {}
        : { trial_interval: "day", trial_interval_count: TRIAL_DAYS }),
      allow_discount_codes: false,
    },
  });
  if (typeof checkout.url !== "string" || !isPolarCheckoutUrl(checkout.url))
    throw new Error("POLAR_CHECKOUT_URL_INVALID");
  return checkout.url;
}

export function isPolarCheckoutUrl(value: string) {
  const url = new URL(value);
  return (
    url.protocol === "https:" &&
    (url.hostname === "polar.sh" || url.hostname.endsWith(".polar.sh")) &&
    !url.port &&
    !url.username &&
    !url.password
  );
}

/**
 * Ouvre le portail Polar directement sur ses réglages de paiement (cartes,
 * adresse de facturation) plutôt que sur la vue d'ensemble, qui liste tous
 * les abonnements du client. Une adresse inattendue reste inchangée.
 */
export function polarPaymentSettingsUrl(portalUrl: string) {
  const url = new URL(portalUrl);
  const base = url.pathname.replace(/\/(overview\/?)?$/, "");
  if (/^\/[^/]+\/portal$/.test(base)) url.pathname = `${base}/settings`;
  return url.toString();
}

export async function createPolarPortalUrl(
  customerId: string,
  returnUrl: string,
  page: "overview" | "payment" = "overview",
) {
  const session = await polarRequest<{ customer_portal_url?: unknown }>(
    "/v1/customer-sessions/",
    {
      method: "POST",
      body: { customer_id: customerId, return_url: returnUrl },
    },
  );
  if (
    typeof session.customer_portal_url !== "string" ||
    !isPolarCheckoutUrl(session.customer_portal_url)
  )
    throw new Error("POLAR_PORTAL_URL_INVALID");
  return page === "payment"
    ? polarPaymentSettingsUrl(session.customer_portal_url)
    : session.customer_portal_url;
}

export type PolarProrationBehavior = "invoice" | "prorate" | "next_period";

/** Change l'offre d'un abonnement ; Polar renvoie l'abonnement à jour. */
export function changePolarSubscriptionProduct(
  id: string,
  productId: string,
  proration: PolarProrationBehavior,
) {
  return polarRequest<PolarSubscription>(`/v1/subscriptions/${segment(id)}`, {
    method: "PATCH",
    body: { product_id: productId, proration_behavior: proration },
  });
}

/** Annule un changement d'offre programmé pour la période suivante. */
export function clearPolarPendingUpdate(id: string) {
  return polarRequest<PolarSubscription>(`/v1/subscriptions/${segment(id)}`, {
    method: "PATCH",
    body: { pending_update: null },
  });
}

export type PolarCustomer = {
  id: string;
  email: string;
  email_verified?: boolean;
  default_payment_method_id?: string | null;
};

export function getPolarCustomer(id: string) {
  return polarRequest<PolarCustomer>(`/v1/customers/${segment(id)}`);
}

export type PolarCard = {
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  wallet: string | null;
};

type PolarPaymentMethod = {
  id: string;
  type: string;
  method_metadata?: {
    brand?: unknown;
    last4?: unknown;
    exp_month?: unknown;
    exp_year?: unknown;
    wallet?: unknown;
  };
};

/** Carte réduite à ce qu'on peut afficher, ou null si la réponse est inattendue. */
function toPolarCard(method: PolarPaymentMethod | undefined): PolarCard | null {
  const meta = method?.type === "card" ? method.method_metadata : undefined;
  if (
    !meta ||
    typeof meta.brand !== "string" ||
    typeof meta.last4 !== "string" ||
    !/^\d{4}$/.test(meta.last4) ||
    !Number.isInteger(meta.exp_month) ||
    !Number.isInteger(meta.exp_year)
  )
    return null;
  return {
    brand: meta.brand.slice(0, 20),
    last4: meta.last4,
    expMonth: meta.exp_month as number,
    expYear: meta.exp_year as number,
    wallet: typeof meta.wallet === "string" ? meta.wallet.slice(0, 20) : null,
  };
}

const sameCard = (a: PolarCard, b: PolarCard) =>
  a.brand === b.brand &&
  a.last4 === b.last4 &&
  a.expMonth === b.expMonth &&
  a.expYear === b.expYear;

/**
 * Carte du client (marque, 4 derniers chiffres, expiration). Sans carte par
 * défaut, chaque paiement enregistre la sienne : une même carte saisie pour
 * plusieurs projets reste une carte. « several » : cartes différentes sans
 * défaut, on n'en désigne aucune au hasard. Null sans carte.
 */
export async function getPolarDefaultCard(
  customer: PolarCustomer,
): Promise<PolarCard | "several" | null> {
  const { items } = await polarRequest<{ items: PolarPaymentMethod[] }>(
    `/v1/customers/${segment(customer.id)}/payment-methods?limit=20`,
  );
  const preferred = items.find((item) => item.id === customer.default_payment_method_id);
  if (preferred) return toPolarCard(preferred);
  const cards = items.map(toPolarCard).filter((card) => card !== null);
  if (!cards.length) return null;
  return cards.every((card) => sameCard(card, cards[0])) ? cards[0] : "several";
}

/** Résiliation immédiate. Déjà révoqué ou introuvable : rien à annuler. */
export async function revokePolarSubscription(id: string) {
  try {
    await polarRequest(`/v1/subscriptions/${segment(id)}`, { method: "DELETE" });
  } catch (error) {
    if (!(error instanceof PolarApiError) || ![403, 404].includes(error.status))
      throw error;
    const current = await getPolarSubscription(id).catch((lookup) => {
      if (lookup instanceof PolarApiError && lookup.status === 404) return null;
      throw lookup;
    });
    if (current && current.status !== "canceled") throw error;
  }
}

/** Résiliation en fin de période : l'accès reste ouvert jusqu'à son terme. */
export async function cancelPolarSubscription(id: string) {
  await polarRequest(`/v1/subscriptions/${segment(id)}`, {
    method: "PATCH",
    body: { cancel_at_period_end: true },
  });
}

/** Annule une résiliation programmée : l'abonnement se renouvelle de nouveau. */
export async function resumePolarSubscription(id: string) {
  await polarRequest(`/v1/subscriptions/${segment(id)}`, {
    method: "PATCH",
    body: { cancel_at_period_end: false },
  });
}

/** Abonnement fini : seul un nouveau paiement peut le relancer. */
export function isEndedPolarSubscription(sub: PolarSubscription) {
  return ["canceled", "unpaid", "incomplete_expired"].includes(sub.status);
}

export function getPolarOrder(id: string) {
  return polarRequest<PolarOrder>(`/v1/orders/${segment(id)}`);
}

/** URL du PDF, ou null tant que Polar prépare une facture demandée pour la première fois. */
export async function polarInvoiceUrl(orderId: string) {
  const path = `/v1/orders/${segment(orderId)}/invoice`;
  try {
    const { url } = await polarRequest<{ url: string }>(path);
    return url;
  } catch (error) {
    if (!(error instanceof PolarApiError) || error.status !== 404) throw error;
    await polarRequest(path, { method: "POST" });
    return null;
  }
}

export async function deletePolarCustomer(id: string) {
  try {
    await polarRequest(`/v1/customers/${segment(id)}`, { method: "DELETE" });
  } catch (error) {
    if (!(error instanceof PolarApiError) || error.status !== 404) throw error;
  }
}

export async function listPolarOrders(subscriptionId: string, page = 1) {
  const query = new URLSearchParams({
    subscription_id: subscriptionId,
    limit: "10",
    page: String(page),
    sorting: "-created_at",
  });
  const { items, pagination } = await polarRequest<{
    items: PolarOrder[];
    pagination: { max_page: number };
  }>(`/v1/orders/?${query}`);
  return { orders: items, maxPage: pagination.max_page };
}

/** Commandes payées depuis une date, plafonnées pour borner la lecture. */
export async function listPaidPolarOrders(since: Date, maxOrders: number) {
  const orders: PolarOrder[] = [];
  for (let page = 1; orders.length < maxOrders; page += 1) {
    const query = new URLSearchParams({
      status: "paid",
      created_after: since.toISOString(),
      limit: "100",
      page: String(page),
    });
    const { items, pagination } = await polarRequest<{
      items: PolarOrder[];
      pagination: { max_page: number };
    }>(`/v1/orders/?${query}`);
    orders.push(...items);
    if (page >= pagination.max_page) break;
  }
  return orders.slice(0, maxOrders);
}
