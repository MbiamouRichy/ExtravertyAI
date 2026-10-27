import { resolvePlanId, type PlanId } from "./pricing";

/** Limits and gated capabilities per plan. Always enforced on the server. */
export type PlanFeatures = {
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
    knowledgeEntries: 100,
    knowledgeSources: 3,
    pdfMaxMb: 5,
    storageMb: 500,
    contextMessages: 20,
    sandboxPerDay: 30,
    analyticsDays: 30,
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
    knowledgeEntries: 1000,
    knowledgeSources: 20,
    pdfMaxMb: 10,
    storageMb: 1200,
    contextMessages: 30,
    sandboxPerDay: 100,
    analyticsDays: 90,
    pipeline: true,
    csat: true,
    integrations: true,
    webhooks: true,
    broadcast: true,
    broadcastRecipients: 500,
    broadcastMonthly: 2000,
    broadcastDaily: 300,
  },
  business: {
    knowledgeEntries: 10000,
    knowledgeSources: 100,
    pdfMaxMb: 10,
    storageMb: 3000,
    contextMessages: 50,
    sandboxPerDay: 300,
    analyticsDays: 365,
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

export type GatedFeature = "pipeline" | "csat" | "integrations" | "webhooks" | "broadcast";

const REQUIRED_PLAN_LABEL: Record<GatedFeature, string> = {
  pipeline: "Pro ou Business",
  csat: "Pro ou Business",
  integrations: "Starter, Pro ou Business",
  webhooks: "Pro ou Business",
  broadcast: "Pro ou Business",
};

const FEATURE_LABEL: Record<GatedFeature, string> = {
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

export function planUpgradeMessage(feature: GatedFeature): string {
  return `${FEATURE_LABEL[feature]} est disponible avec l’offre ${REQUIRED_PLAN_LABEL[feature]}.`;
}

export function requirePlanFeature(plan: unknown, feature: GatedFeature) {
  if (!planAllows(plan, feature)) {
    throw new PlanFeatureError(planUpgradeMessage(feature));
  }
}
