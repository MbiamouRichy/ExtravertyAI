export function projectBillingStatus(project: {
  status: string;
  automationPaused: boolean;
  statusBeforePause: string | null;
}) {
  return project.automationPaused && project.status === "paused"
    ? (project.statusBeforePause ?? project.status)
    : project.status;
}
