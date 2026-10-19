import { resolvePlanId, type PlanId } from "./pricing";

/** Limits and gated capabilities per plan. Always enforced on the server. */
export type PlanFeatures = {
  knowledgeEntries: number;
  knowledgeSources: number;
  sandboxPerDay: number;
  pipeline: boolean;
  csat: boolean;
  integrations: boolean;
};

export const PLAN_FEATURES: Record<PlanId, PlanFeatures> = {
  starter: {
    knowledgeEntries: 100,
    knowledgeSources: 3,
    sandboxPerDay: 30,
    pipeline: false,
    csat: false,
    integrations: false,
  },
  pro: {
    knowledgeEntries: 1000,
    knowledgeSources: 20,
    sandboxPerDay: 100,
    pipeline: true,
    csat: true,
    integrations: false,
  },
  business: {
    knowledgeEntries: 10000,
    knowledgeSources: 100,
    sandboxPerDay: 300,
    pipeline: true,
    csat: true,
    integrations: true,
  },
};

export type GatedFeature = "pipeline" | "csat" | "integrations";

const REQUIRED_PLAN_LABEL: Record<GatedFeature, string> = {
  pipeline: "Pro ou Business",
  csat: "Pro ou Business",
  integrations: "Business",
};

const FEATURE_LABEL: Record<GatedFeature, string> = {
  pipeline: "Le pipeline de prospects",
  csat: "Le questionnaire de satisfaction",
  integrations: "Les intégrations",
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
