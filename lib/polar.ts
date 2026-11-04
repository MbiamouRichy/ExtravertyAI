import type { PlanId } from "./pricing";

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
        : { trial_interval: "day", trial_interval_count: 10 }),
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

export async function createPolarPortalUrl(customerId: string, returnUrl: string) {
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
  return session.customer_portal_url;
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
