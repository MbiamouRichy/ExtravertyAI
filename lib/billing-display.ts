// Stripe uses minor units; XAF and the other currencies listed here have no decimals.
// ISK and UGX retain two-decimal API representation for backwards compatibility.
const ZERO_DECIMAL = new Set([
  "bif",
  "clp",
  "djf",
  "gnf",
  "jpy",
  "kmf",
  "krw",
  "mga",
  "pyg",
  "rwf",
  "vnd",
  "vuv",
  "xaf",
  "xof",
  "xpf",
]);
export function formatStripeAmount(amount: number, currency: string) {
  const value = amount / (ZERO_DECIMAL.has(currency.toLowerCase()) ? 1 : 100);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(value);
}
export function stripeDocumentUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      (url.hostname === "stripe.com" || url.hostname.endsWith(".stripe.com")) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
export function billingStatusLabel(status: string) {
  return (
    (
      {
        active: "Actif",
        trialing: "En période d’essai",
        past_due: "Paiement en retard",
        canceled: "Résilié",
        unpaid: "Impayé",
        incomplete: "Paiement à finaliser",
        incomplete_expired: "Inscription expirée",
        paused: "Suspendu",
        paid: "Payée",
        open: "À payer",
        draft: "Brouillon",
        void: "Annulée",
        uncollectible: "Irrécouvrable",
      } as Record<string, string>
    )[status] || "À vérifier"
  );
}
