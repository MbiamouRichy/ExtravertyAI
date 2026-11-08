import { planAllows } from "./plan-features";

// Shared display contract: null means unavailable/stale, "none" is an assessment.
export type ProspectClassification = "interesting" | "follow_up" | "none";

type InstinctProject = { plan: unknown; agentQualifyLeads: boolean };

/**
 * Instinct IA tourne quand l’offre l’inclut et que la qualification est activée.
 * Sur les autres offres, `agentQualifyLeads` ne règle que les questions de l’agent.
 */
export function instinctEnabled(project: InstinctProject): boolean {
  return project.agentQualifyLeads && planAllows(project.plan, "instinct");
}

/**
 * Dernière analyse connue, pour la messagerie : elle reste visible pendant que
 * le prochain message est réanalysé, que l’IA réponde à ce contact ou non.
 */
export function lastProspectClassification(contact: {
  instinctClassification: ProspectClassification | null;
  project: InstinctProject;
}): ProspectClassification | null {
  return instinctEnabled(contact.project)
    ? contact.instinctClassification
    : null;
}

export function currentProspectClassification(
  contact: {
    instinctClassification: ProspectClassification | null;
    instinctSourceId: string | null;
    instinctConfigVersion: number;
    project: InstinctProject & { agentConfigVersion: number };
  },
  latestId: string | undefined,
): ProspectClassification | null {
  return latestId &&
    instinctEnabled(contact.project) &&
    contact.instinctConfigVersion === contact.project.agentConfigVersion &&
    contact.instinctSourceId === latestId
    ? contact.instinctClassification
    : null;
}
