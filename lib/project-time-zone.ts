import type { PrismaClient } from "../src/generated/prisma/client";
import { requireProjectAdmin, SettingsError } from "./project-settings";
import { validTimeZone } from "./user-time-zone";

/**
 * Change le fuseau horaire de l'activité (heures d'envoi des diffusions).
 * Réservé aux propriétaires et administrateurs ; la modification est journalisée.
 * Renvoie le fuseau enregistré, sous sa forme canonique.
 */
export async function setProjectTimeZone(
  db: PrismaClient,
  input: { projectId: string; userId: string; timeZone: string },
) {
  const timeZone = validTimeZone(input.timeZone);
  if (!timeZone) throw new SettingsError("Fuseau horaire inconnu.");
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${input.projectId} FOR UPDATE`;
    const { project } = await requireProjectAdmin(tx, input.projectId, input.userId);
    if (project.deletionPending) throw new SettingsError("Projet en cours de suppression.");
    if (project.timeZone === timeZone) return timeZone;
    await tx.project.update({ where: { id: input.projectId }, data: { timeZone } });
    // Broadcasts waiting for the old opening hours are re-evaluated right away.
    await tx.broadcast.updateMany({
      where: {
        projectId: input.projectId,
        status: { in: ["SCHEDULED", "SENDING"] },
        pauseReason: { in: ["OUTSIDE_WINDOW", "DAILY_LIMIT"] },
      },
      data: { nextSendAt: new Date() },
    });
    await tx.settingsAudit.create({
      data: {
        projectId: input.projectId,
        actorId: input.userId,
        action: "timezone.updated",
        version: project.settingsVersion,
      },
    });
    return timeZone;
  });
}
