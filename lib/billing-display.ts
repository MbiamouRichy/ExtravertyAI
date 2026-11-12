// Montants en unités mineures (centimes) ; XAF et les autres devises listées
// ici n'ont pas de décimales. ISK et UGX gardent deux décimales dans les API.
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
export function formatBillingAmount(amount: number, currency: string) {
  const value = amount / (ZERO_DECIMAL.has(currency.toLowerCase()) ? 1 : 100);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(value);
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
        pending: "En attente",
        refunded: "Remboursée",
        partially_refunded: "Remboursée en partie",
        open: "À payer",
        draft: "Brouillon",
        void: "Annulée",
        uncollectible: "Irrécouvrable",
      } as Record<string, string>
    )[status] || "À vérifier"
  );
}

/**
 * Projet créé dont le paiement n'a jamais abouti : aucun client ni abonnement,
 * statut resté « inactive ». Un projet actif sans abonnement (ajouté à la main)
 * n'est jamais concerné, pour ne pas facturer deux fois.
 */
export function needsInitialCheckout(project: {
  status: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}) {
  return (
    project.status === "inactive" &&
    !project.stripeCustomerId &&
    !project.stripeSubscriptionId
  );
}
