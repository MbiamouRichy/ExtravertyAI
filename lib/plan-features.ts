import { PRICING_PLANS, resolvePlanId, type PlanId } from "./pricing";

/** Limits and gated capabilities per plan. Always enforced on the server. */
export type PlanFeatures = {
  /**
   * Volume de la base de connaissances, en mots (≈ 500 par page) : c’est la
   * limite affichée, celle qui borne ce que l’IA peut lire.
   */
  knowledgeWords: number;
  /** Garde-fou technique sur le nombre d’entrées (morceaux de documents compris). */
  knowledgeEntries: number;
  knowledgeSources: number;
  /** Taille maximale d’un PDF importé dans la base de connaissances. */
  pdfMaxMb: number;
  /** Espace total des fichiers déposés (médias du chat, PDF), en Mo. */
  storageMb: number;
  /** Mémoire de contexte : derniers messages de la conversation lus par l’IA. */
  contextMessages: number;
  sandboxPerDay: number;
  /** Profondeur d’historique consultable dans Analytics, en jours. */
  analyticsDays: number;
  /** Transcription des notes vocales reçues, lue par l’IA. */
  audio: boolean;
  /** Analyse des images reçues, lue par l’IA. */
  images: boolean;
  /** Instinct IA : chaque conversation est analysée pour repérer les prospects. */
  instinct: boolean;
  pipeline: boolean;
  csat: boolean;
  /** Page Intégrations et Google Sheets. */
  integrations: boolean;
  /** Webhooks signés (Make, Zapier, CRM). */
  webhooks: boolean;
  /** Diffusion d’un message à des contacts existants. */
  broadcast: boolean;
  /** Contacts au plus par diffusion. */
  broadcastRecipients: number;
  /** Messages de diffusion par période de facturation (aussi décomptés du quota). */
  broadcastMonthly: number;
  /** Messages de diffusion par jour : rythme sûr pour le numéro WhatsApp. */
  broadcastDaily: number;
};

export const PLAN_FEATURES: Record<PlanId, PlanFeatures> = {
  starter: {
    knowledgeWords: 20_000,
    knowledgeEntries: 500,
    knowledgeSources: 5,
    pdfMaxMb: 5,
    storageMb: 500,
    contextMessages: 20,
    sandboxPerDay: 30,
    analyticsDays: 30,
    audio: false,
    images: false,
    instinct: false,
    pipeline: false,
    csat: false,
    integrations: true,
    webhooks: false,
    broadcast: false,
    broadcastRecipients: 0,
    broadcastMonthly: 0,
    broadcastDaily: 0,
  },
  pro: {
    knowledgeWords: 150_000,
    knowledgeEntries: 3000,
    knowledgeSources: 10,
    pdfMaxMb: 10,
    storageMb: 1200,
    contextMessages: 30,
    sandboxPerDay: 100,
    analyticsDays: 90,
    audio: true,
    images: false,
    instinct: true,
    // Pipeline de ventes : Business seulement. Instinct IA continue de classer
    // les prospects ; ils sont déjà dans le pipeline au passage à Business.
    pipeline: false,
    csat: true,
    integrations: true,
    webhooks: true,
    broadcast: true,
    broadcastRecipients: 500,
    broadcastMonthly: 2000,
    broadcastDaily: 300,
  },
  business: {
    knowledgeWords: 600_000,
    knowledgeEntries: 10000,
    knowledgeSources: 20,
    pdfMaxMb: 10,
    storageMb: 3000,
    contextMessages: 50,
    sandboxPerDay: 300,
    analyticsDays: 365,
    audio: true,
    images: true,
    instinct: true,
    pipeline: true,
    csat: true,
    integrations: true,
    webhooks: true,
    broadcast: true,
    broadcastRecipients: 2000,
    broadcastMonthly: 10000,
    broadcastDaily: 1000,
  },
};

export type GatedFeature =
  | "audio"
  | "images"
  | "instinct"
  | "pipeline"
  | "csat"
  | "integrations"
  | "webhooks"
  | "broadcast";

const FEATURE_LABEL: Record<GatedFeature, string> = {
  audio: "La compréhension des notes vocales",
  images: "La compréhension des images",
  instinct: "Instinct IA",
  pipeline: "Le pipeline de prospects",
  csat: "Le questionnaire de satisfaction",
  integrations: "Les intégrations",
  webhooks: "Les webhooks",
  broadcast: "La diffusion de messages",
};

// Safe to show as is to the user.
export class PlanFeatureError extends Error {}

export function planFeatures(plan: unknown): PlanFeatures {
  return PLAN_FEATURES[resolvePlanId(plan)];
}

export function planAllows(plan: unknown, feature: GatedFeature): boolean {
  return planFeatures(plan)[feature];
}

/** Capacité qui rend un média reçu compréhensible par l’IA ; null pour les autres types. */
export function mediaFeature(type: string): "audio" | "images" | null {
  return type === "AUDIO" ? "audio" : type === "IMAGE" ? "images" : null;
}

/** Offres qui incluent la fonctionnalité, de la moins chère à la plus complète. */
export function plansWith(feature: GatedFeature): PlanId[] {
  return PRICING_PLANS.filter((plan) => PLAN_FEATURES[plan.id][feature]).map((plan) => plan.id);
}

/** Offre la moins chère qui débloque la fonctionnalité : celle à proposer. */
export function minimumPlanFor(feature: GatedFeature): PlanId {
  return plansWith(feature)[0] ?? "business";
}

/** « Business », « Pro ou Business »… toujours déduit de `PLAN_FEATURES`. */
export function requiredPlanLabel(feature: GatedFeature): string {
  const names = PRICING_PLANS.filter((plan) => PLAN_FEATURES[plan.id][feature]).map(
    (plan) => plan.name,
  );
  if (names.length <= 1) return names[0] ?? "Business";
  return `${names.slice(0, -1).join(", ")} ou ${names[names.length - 1]}`;
}

export function planUpgradeMessage(feature: GatedFeature): string {
  return `${FEATURE_LABEL[feature]} est disponible avec l’offre ${requiredPlanLabel(feature)}.`;
}

export function requirePlanFeature(plan: unknown, feature: GatedFeature) {
  if (!planAllows(plan, feature)) {
    throw new PlanFeatureError(planUpgradeMessage(feature));
  }
}
