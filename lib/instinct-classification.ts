// Shared display contract: null means unavailable/stale, "none" is an assessment.
export type ProspectClassification = "interesting" | "follow_up" | "none";

/**
 * Dernière analyse connue, pour la messagerie : elle reste visible pendant que
 * le prochain message est réanalysé, que l’IA réponde à ce contact ou non.
 */
export function lastProspectClassification(contact: {
  instinctClassification: ProspectClassification | null;
  project: { agentQualifyLeads: boolean };
}): ProspectClassification | null {
  return contact.project.agentQualifyLeads
    ? contact.instinctClassification
    : null;
}

export function currentProspectClassification(
  contact: {
    instinctClassification: ProspectClassification | null;
    instinctSourceId: string | null;
    instinctConfigVersion: number;
    project: { agentQualifyLeads: boolean; agentConfigVersion: number };
  },
  latestId: string | undefined,
): ProspectClassification | null {
  return latestId &&
    contact.project.agentQualifyLeads &&
    contact.instinctConfigVersion === contact.project.agentConfigVersion &&
    contact.instinctSourceId === latestId
    ? contact.instinctClassification
    : null;
}
