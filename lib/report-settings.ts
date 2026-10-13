import type { Prisma } from "../src/generated/prisma/client";
import { ReportSettingsSchema } from "./weekly-report";
import { requireProjectAdmin, SettingsError } from "./project-settings";
import { getBillingAccess } from "./billing-access";

export async function writeReportSettings(
  tx: Prisma.TransactionClient,
  projectId: string,
  actorId: string,
  expectedVersion: number,
  input: unknown,
) {
  const settings = ReportSettingsSchema.parse(input);
  await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
  const { project } = await requireProjectAdmin(tx, projectId, actorId);
  if (
    project.plan !== "business" ||
    project.deletionPending ||
    !(await getBillingAccess(tx, project.id)).allowed
  )
    throw new SettingsError("Un abonnement Business valide est nécessaire.");
  if (project.reportsVersion !== expectedVersion)
    throw new SettingsError(
      "Ces réglages ont changé. Actualisez la page avant de réessayer.",
    );
  const version = project.reportsVersion + 1;
  await tx.project.update({
    where: { id: project.id },
    data: { ...settings, reportsVersion: version, reportsCheckAt: new Date() },
  });
  await tx.settingsAudit.create({
    data: {
      projectId: project.id,
      actorId,
      action: "reports.updated",
      version,
    },
  });
  return version;
}
