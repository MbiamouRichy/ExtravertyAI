import type { PrismaClient } from "../src/generated/prisma/client";
import { SettingsError, requireProjectAdmin } from "./project-settings";

/**
 * Active ou coupe la répartition automatique des nouvelles conversations.
 * Réservé aux propriétaires et administrateurs, offre Business ; journalisé.
 */
export async function setTeamAutoAssign(
  db: PrismaClient,
  input: { projectId: string; userId: string; enabled: boolean },
) {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${input.projectId} FOR UPDATE`;
    const { project } = await requireProjectAdmin(
      tx,
      input.projectId,
      input.userId,
    );
    if (project.plan !== "business")
      throw new SettingsError(
        "La répartition automatique est disponible avec l’offre Business.",
      );
    if (project.autoAssignTeam === input.enabled) return;
    await tx.project.update({
      where: { id: input.projectId },
      data: { autoAssignTeam: input.enabled },
    });
    await tx.settingsAudit.create({
      data: {
        projectId: input.projectId,
        actorId: input.userId,
        action: input.enabled ? "auto_assign.enabled" : "auto_assign.disabled",
        version: project.settingsVersion,
      },
    });
  });
}
