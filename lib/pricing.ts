/**
 * Catalogue des offres : prix (USD, vérifié contre Polar au paiement), quota
 * mensuel de messages (appliqué par le serveur, lib/billing-quota.ts) et prix
 * d'une recharge. Une recharge ne coûte jamais moins cher au message que le
 * forfait lui-même : monter d'offre reste toujours le meilleur choix.
 */
export const PRICING_PLANS = [
  {
    id: "starter",
    name: "Starter",
    priceCents: 700,
    messageLimit: 500,
    extraPackCents: 1400,
    users: 2,
    storage: "500 Mo",
    description: "Pour automatiser vos premiers échanges clients.",
    highlighted: false,
    features: [
      "2 utilisateurs · 1 numéro WhatsApp",
      "500 messages par mois, puis 14 $ les 1 000",
      "Réponses textuelles uniquement",
      "Assistant disponible 24 h/24, 7 j/7",
      "Statistiques sur 30 jours",
      "Export CSV des contacts",
      "500 Mo de fichiers",
      "Support standard",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    priceCents: 1700,
    messageLimit: 2000,
    extraPackCents: 900,
    users: 4,
    storage: "1,2 Go",
    description:
      "Pour qualifier vos prospects et accompagner votre croissance.",
    highlighted: true,
    features: [
      "4 utilisateurs · 1 numéro WhatsApp",
      "2 000 messages par mois, puis 9 $ les 1 000",
      "Texte et compréhension des notes vocales",
      "Assistant disponible 24 h/24, 7 j/7",
      "Statistiques sur 90 jours",
      "Résumé IA des conversations",
      "Qualification des prospects par Instinct IA",
      "Capture IA des coordonnées des prospects",
      "Questionnaire de satisfaction",
      "Webhooks et Google Sheets",
      "Diffusions à volonté sur votre quota, 500 contacts par envoi",
      "1,2 Go de fichiers",
      "Support prioritaire",
    ],
  },
  {
    id: "business",
    name: "Business",
    priceCents: 10000,
    messageLimit: 20000,
    extraPackCents: 500,
    users: 10,
    storage: "3 Go",
    description: "Pour les équipes qui pilotent leurs ventes sur WhatsApp.",
    highlighted: false,
    // Le pipeline en 4e position : la carte d'accueil n'affiche que les quatre premières lignes.
    features: [
      "10 utilisateurs · 1 numéro WhatsApp",
      "20 000 messages par mois, puis 5 $ les 1 000",
      "Texte, notes vocales et compréhension des images",
      "Pipeline de prospects et relances automatiques",
      "Assistant disponible 24 h/24, 7 j/7",
      "Statistiques sur 12 mois",
      "Résumé IA et qualification des prospects",
      "Capture IA des coordonnées des prospects",
      "Webhooks, Google Sheets et rapports programmés",
      "Répartition automatique des conversations",
      "Diffusions à volonté sur votre quota, 2 000 contacts par envoi",
      "3 Go de fichiers",
      "Support prioritaire",
    ],
  },
] as const;

export type PricingPlan = (typeof PRICING_PLANS)[number];
export type PlanId = PricingPlan["id"];

/**
 * Essai gratuit d'un nouvel abonnement. Source unique : le paiement Polar
 * (durée) et le quota (messages) l'appliquent côté serveur, les pages
 * l'annoncent avec ces mêmes valeurs.
 */
export const TRIAL_DAYS = 7;
/** Premier atteint des deux : au-delà, plus aucun envoi jusqu'au premier paiement. */
export const TRIAL_MESSAGES = 50;

/**
 * Messages au-delà du quota mensuel : recharge prépayée de EXTRA_PACK_MESSAGES
 * messages au prix `extraPackCents` de l’offre (lib/message-credit.ts).
 */
export const EXTRA_PACK_MESSAGES = 1000;

/** Rang d'une offre (Starter 0, Pro 1, Business 2) : sens d'un changement d'offre. */
export function planRank(plan: PlanId) {
  return PRICING_PLANS.findIndex((candidate) => candidate.id === plan);
}

export function resolvePlanId(value: unknown): PlanId {
  return PRICING_PLANS.find((plan) => plan.id === value)?.id ?? "starter";
}

/** Fiche d'une offre ; une valeur inconnue retombe sur Starter, comme `resolvePlanId`. */
export function pricingPlan(value: unknown): PricingPlan {
  const id = resolvePlanId(value);
  return PRICING_PLANS.find((plan) => plan.id === id) ?? PRICING_PLANS[0];
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
    "Statistiques sur 30 jours",
    // Cohérent avec PLAN_FEATURES (knowledgeWords, knowledgeSources) : vérifié par les tests.
    "Base de connaissances : ≈ 40 pages, 5 documents PDF ou pages web",
    "500 Mo de fichiers",
    "Support standard",
  ],
  pro: [
    ...SHARED_CAPABILITIES,
    "Compréhension des notes vocales",
    "Instinct IA : repère les prospects intéressants",
    "Capture IA : nom, e-mail, ville et adresse des prospects relevés dans le chat",
    "Résumé IA des conversations",
    "Questionnaire de satisfaction",
    "Connexion à vos outils (Make, Zapier, CRM)",
    "Diffusion de messages : autant d’envois que vous voulez, 500 contacts par envoi et 300 messages par jour, décomptés de votre quota",
    "Statistiques sur 90 jours",
    "Base de connaissances : ≈ 300 pages, 10 documents PDF ou pages web",
    "1,2 Go de fichiers",
    "Support prioritaire",
  ],
  business: [
    ...SHARED_CAPABILITIES,
    "Compréhension des notes vocales et des images",
    "Instinct IA : repère les prospects intéressants",
    "Capture IA : nom, e-mail, ville et adresse des prospects relevés dans le chat",
    "Résumé IA des conversations",
    "Pipeline de prospects : étapes, valeur des affaires et chiffre gagné",
    "Relances automatiques des prospects silencieux, rédigées par l’IA ou avec votre message",
    "Questionnaire de satisfaction",
    "Connexion à vos outils (Make, Zapier, CRM)",
    "Répartition automatique entre les membres en ligne",
    "Diffusion de messages : autant d’envois que vous voulez, 2 000 contacts par envoi et 1 000 messages par jour, décomptés de votre quota",
    "Ciblage des diffusions par étape du pipeline",
    "Rapports hebdomadaires programmés",
    "Statistiques sur 12 mois",
    "Base de connaissances : ≈ 1 200 pages, 20 documents PDF ou pages web",
    "3 Go de fichiers",
    "Support prioritaire",
  ],
};
