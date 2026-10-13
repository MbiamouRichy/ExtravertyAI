import { randomUUID } from "node:crypto";
import type { Prisma } from "../src/generated/prisma/client";
import { requireProjectAdmin, SettingsError } from "./project-settings";

export const SYSTEM_AI_LIMITS = {
  cooldownSeconds: 30,
  projectPerDay: 10,
  userPerDay: 20,
  leaseSeconds: 90,
};
export async function reserveSystemAssistance(
  tx: Prisma.TransactionClient,
  projectId: string,
  userId: string,
) {
  // Serialize across tabs, users and server instances. All reservations lock in this order.
  await tx.$queryRaw`SELECT id FROM "user" WHERE id = ${userId} FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
  const { project } = await requireProjectAdmin(tx, projectId, userId);
  if (project.deletionPending)
    throw new SettingsError("Ce projet est en cours de suppression.");
  const [{ now }] = await tx.$queryRaw<
    Array<{ now: Date }>
  >`SELECT clock_timestamp() AS now`;
  const since = new Date(now.getTime() - 86400000);
  await tx.$executeRaw`DELETE FROM ai_editor_request WHERE "createdAt" < ${new Date(now.getTime() - 172800000)}`;
  const requests = await tx.$queryRaw<
    Array<{
      projectId: string;
      actorId: string;
      createdAt: Date;
      state: string;
    }>
  >`
    SELECT "projectId", "actorId", "createdAt", state FROM ai_editor_request
    WHERE "createdAt" > ${since} AND ("projectId" = ${projectId} OR "actorId" = ${userId})
  `;
  if (
    requests.some(
      (r) =>
        r.state === "started" &&
        now.getTime() - r.createdAt.getTime() <
          SYSTEM_AI_LIMITS.leaseSeconds * 1000,
    )
  )
    throw new SettingsError(
      "Une demande IA est déjà en cours. Patientez avant de réessayer.",
    );
  if (
    requests.some(
      (r) =>
        now.getTime() - r.createdAt.getTime() <
        SYSTEM_AI_LIMITS.cooldownSeconds * 1000,
    )
  )
    throw new SettingsError("Patientez 30 secondes entre deux demandes IA.");
  if (
    requests.filter((r) => r.projectId === projectId).length >=
      SYSTEM_AI_LIMITS.projectPerDay ||
    requests.filter((r) => r.actorId === userId).length >=
      SYSTEM_AI_LIMITS.userPerDay
  )
    throw new SettingsError(
      "Limite IA atteinte : 10 demandes par projet et 20 par compte sur 24 heures.",
    );
  const id = randomUUID();
  await tx.$executeRaw`INSERT INTO ai_editor_request (id, "projectId", "actorId", state, "createdAt") VALUES (${id}, ${projectId}, ${userId}, 'started', ${now})`;
  return { id, projectName: project.name };
}
