// Shared display contract: null means unavailable/stale, "none" is an assessment.
export type ProspectClassification = "interesting" | "follow_up" | "none";

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
