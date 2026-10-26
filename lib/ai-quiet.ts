import type { PrismaClient } from "../src/generated/prisma/client";
import { SettingsError, requireProjectAdmin } from "./project-settings";
import { rolesWith } from "./project-permissions";

// Safe to show as is to the user.
export class AiQuietError extends Error {}

/**
 * Any project member can wake the assistant up before the client writes again.
 * Journaled so the conversation shows who did it; a second click logs nothing.
 */
export async function wakeAssistant(
  db: PrismaClient,
  input: { projectId: string; contactId: string; userId: string },
) {
  return db.$transaction(async (tx) => {
    // Same lock as the ingestion: a client message and a wake-up never cross.
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${input.projectId} FOR UPDATE`;
    const contact = await tx.contact.findFirst({
      where: {
        id: input.contactId,
        projectId: input.projectId,
        project: {
        deletionPending: false,
        members: { some: { userId: input.userId, role: { in: rolesWith("conversations.handle") } } },
      },
      },
      select: { id: true, aiQuietSince: true },
    });
    if (!contact) throw new AiQuietError("Conversation indisponible.");
    if (!contact.aiQuietSince) return { woken: false };
    await tx.contact.update({
      where: { id: contact.id },
      data: { aiQuietSince: null },
    });
    await tx.contactEvent.create({
      data: {
        projectId: input.projectId,
        contactId: contact.id,
        actorId: input.userId,
        type: "AI_WOKEN",
      },
    });
    return { woken: true };
  });
}

/** Owners and administrators only; the change is journaled. */
export async function setAiQuietMode(
  db: PrismaClient,
  input: { projectId: string; userId: string; enabled: boolean },
) {
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${input.projectId} FOR UPDATE`;
    const { project } = await requireProjectAdmin(tx, input.projectId, input.userId);
    if (project.deletionPending) throw new SettingsError("Ce projet est en cours de suppression.");
    if (project.aiQuietEnabled === input.enabled) return;
    await tx.project.update({
      where: { id: input.projectId },
      data: { aiQuietEnabled: input.enabled },
    });
    // Turning the mode off wakes every quiet conversation at once.
    if (!input.enabled) {
      await tx.contact.updateMany({
        where: { projectId: input.projectId, aiQuietSince: { not: null } },
        data: { aiQuietSince: null },
      });
    }
    await tx.settingsAudit.create({
      data: {
        projectId: input.projectId,
        actorId: input.userId,
        action: input.enabled ? "ai_quiet.enabled" : "ai_quiet.disabled",
        version: project.settingsVersion,
      },
    });
  });
}

export type AvoidedReplies = {
  total: number;
  quiet: number;
  repeated: number;
  merged: number;
};

/** Client messages the assistant deliberately left unanswered since a date. */
export async function avoidedReplies(
  db: PrismaClient,
  projectId: string,
  since: Date,
): Promise<AvoidedReplies> {
  const rows = await db.message.groupBy({
    by: ["aiSkip"],
    where: { projectId, createdAt: { gte: since }, aiSkip: { not: null } },
    _count: { _all: true },
  });
  const count = (reason: string) =>
    rows.find((row) => row.aiSkip === reason)?._count._all ?? 0;
  const quiet = count("QUIET_ACK") + count("SILENCE");
  const repeated = count("REPEATED");
  const merged = count("MERGED");
  return { total: quiet + repeated + merged, quiet, repeated, merged };
}
