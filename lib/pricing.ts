export const PRICING_PLANS = [
  {
    id: "starter",
    name: "Starter",
    priceCents: 1599,
    messageLimit: 4000,
    users: 2,
    description: "Pour automatiser vos premiers échanges clients.",
    highlighted: false,
    features: [
      "2 utilisateurs · 1 numéro WhatsApp",
      "4 000 messages par mois",
      "Réponses textuelles uniquement",
      "Assistant disponible 24 h/24, 7 j/7",
      "Statistiques sur 30 jours",
      "Support standard",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceCents: 3999,
    messageLimit: 10000,
    users: 4,
    description:
      "Pour qualifier vos prospects et accompagner votre croissance.",
    highlighted: true,
    features: [
      "4 utilisateurs · 1 numéro WhatsApp",
      "10 000 messages par mois",
      "Texte et compréhension des notes vocales",
      "Assistant disponible 24 h/24, 7 j/7",
      "Statistiques sur 90 jours",
      "Résumé IA des conversations",
      "Qualification des prospects et export CSV",
      "Support prioritaire",
    ],
  },
  {
    id: "business",
    name: "Business",
    priceCents: 9900,
    messageLimit: 25000,
    users: 10,
    description: "Pour les équipes avec un volume important de conversations.",
    highlighted: false,
    features: [
      "10 utilisateurs · 1 numéro WhatsApp",
      "25 000 messages par mois",
      "Texte, notes vocales et compréhension des images",
      "Assistant disponible 24 h/24, 7 j/7",
      "Statistiques sur 12 mois",
      "Résumé IA et qualification des prospects",
      "Rapports programmés et exports",
      "Accompagnement à la configuration",
    ],
  },
] as const;

export type PricingPlan = (typeof PRICING_PLANS)[number];
export type PlanId = PricingPlan["id"];

export function resolvePlanId(value: unknown): PlanId {
  return PRICING_PLANS.find((plan) => plan.id === value)?.id ?? "starter";
}

export function projectPlanHref(plan: PlanId) {
  return `/projects/new?plan=${plan}`;
}

export function formatPlanPrice(cents: number) {
  return `${new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)} $`;
}

export function formatMessageLimit(limit: number) {
  return new Intl.NumberFormat("fr-FR").format(limit);
}
