export const PRICING_PLANS = [
  {
    id: "starter",
    name: "Starter",
    priceCents: 1599,
    messageLimit: 4000,
    users: 2,
    storage: "500 Mo",
    description: "Pour automatiser vos premiers échanges clients.",
    highlighted: false,
    features: [
      "2 utilisateurs · 1 numéro WhatsApp",
      "4 000 messages par mois",
      "Réponses textuelles uniquement",
      "Assistant disponible 24 h/24, 7 j/7",
      "Statistiques sur 30 jours",
      "Mémoire des 20 derniers messages",
      "Export CSV des contacts",
      "500 Mo de fichiers",
      "Support standard",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceCents: 3999,
    messageLimit: 10000,
    users: 4,
    storage: "1,2 Go",
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
      "Mémoire des 30 derniers messages",
      "Pipeline et qualification des prospects",
      "Webhooks et Google Sheets",
      "Diffusion : 500 contacts par envoi, 2 000 messages par mois",
      "1,2 Go de fichiers",
      "Support prioritaire",
    ],
  },
  {
    id: "business",
    name: "Business",
    priceCents: 9900,
    messageLimit: 25000,
    users: 10,
    storage: "3 Go",
    description: "Pour les équipes avec un volume important de conversations.",
    highlighted: false,
    features: [
      "10 utilisateurs · 1 numéro WhatsApp",
      "25 000 messages par mois",
      "Texte, notes vocales et compréhension des images",
      "Assistant disponible 24 h/24, 7 j/7",
      "Statistiques sur 12 mois",
      "Résumé IA et qualification des prospects",
      "Mémoire des 50 derniers messages",
      "Pipeline, intégrations et rapports programmés",
      "Assignation automatique des conversations",
      "Diffusion : 2 000 contacts par envoi, 10 000 messages par mois",
      "3 Go de fichiers",
      "Support prioritaire",
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

const SHARED_CAPABILITIES = [
  "Assistant IA WhatsApp 24 h/24, 7 j/7",
  "Messagerie partagée avec votre équipe",
  "Suggestions de réponses IA",
  "Reformulation IA de vos messages",
  "Notes internes et étiquettes",
  "Reprise en main d’une conversation en un clic",
  "Base de connaissances et test de l’agent",
  "Mise en veille de l’IA en fin de conversation",
  "Export des conversations (.txt et .csv)",
  "Export CSV des contacts",
  "Intégration Google Sheets",
] as const;

/** Liste complète affichée sous « Afficher plus », cohérente avec `features`. */
export const PLAN_CAPABILITIES: Record<PlanId, readonly string[]> = {
  starter: [
    ...SHARED_CAPABILITIES,
    "Réponses textuelles",
    "Mémoire des 20 derniers messages",
    "Statistiques sur 30 jours",
    "500 Mo de fichiers",
    "Support standard",
  ],
  pro: [
    ...SHARED_CAPABILITIES,
    "Compréhension des notes vocales",
    "Mémoire des 30 derniers messages",
    "Instinct IA : repère les prospects intéressants",
    "Résumé IA des conversations",
    "Pipeline de prospects",
    "Questionnaire de satisfaction",
    "Webhooks signés (Make, Zapier, CRM)",
    "Diffusion de messages : 500 contacts par envoi, 2 000 messages par mois, 300 par jour",
    "Statistiques sur 90 jours",
    "1,2 Go de fichiers",
    "Support prioritaire",
  ],
  business: [
    ...SHARED_CAPABILITIES,
    "Compréhension des notes vocales et des images",
    "Mémoire des 50 derniers messages",
    "Instinct IA : repère les prospects intéressants",
    "Résumé IA des conversations",
    "Pipeline de prospects",
    "Questionnaire de satisfaction",
    "Webhooks signés (Make, Zapier, CRM)",
    "Assignation automatique des conversations",
    "Diffusion de messages : 2 000 contacts par envoi, 10 000 messages par mois, 1 000 par jour",
    "Rapports hebdomadaires programmés",
    "Statistiques sur 12 mois",
    "3 Go de fichiers",
    "Support prioritaire",
  ],
};
