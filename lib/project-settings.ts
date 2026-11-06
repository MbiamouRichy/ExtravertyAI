import type { Prisma } from "../src/generated/prisma/client";
import { AgentConfigSchema } from "./agent-config";
import { can, type ProjectPermission } from "./project-permissions";
import { getBillingAccess } from "./billing-access";

export class SettingsError extends Error {}

/** Contrôle d’accès serveur commun : membre du projet avec la permission demandée. */
export async function requireProjectPermission(
  tx: Prisma.TransactionClient,
  projectId: string,
  userId: string,
  permission: ProjectPermission,
) {
  const membership = await tx.projectMembership.findUnique({
    where: { userId_projectId: { userId, projectId } },
    include: { project: true },
  });
  if (!membership || !can(membership.role, permission)) {
    throw new SettingsError(
      "Vous n’avez pas les droits nécessaires sur ce projet.",
    );
  }
  return membership;
}

/** Réglages du projet (propriétaire et administrateurs) ou action réservée au propriétaire. */
export async function requireProjectAdmin(
  tx: Prisma.TransactionClient,
  projectId: string,
  userId: string,
  ownerOnly = false,
) {
  return requireProjectPermission(
    tx,
    projectId,
    userId,
    ownerOnly ? "project.own" : "project.manage",
  );
}
/**
 * Enregistre la configuration de l’agent. Pendant la configuration initiale,
 * `activate: false` garde un brouillon : l’agent reste silencieux sur WhatsApp
 * tant que son propriétaire ne l’a pas testé puis activé.
 */
export async function writeAgentConfig(
  tx: Prisma.TransactionClient,
  projectId: string,
  actorId: string,
  expectedVersion: number,
  input: unknown,
  { activate = true }: { activate?: boolean } = {},
) {
  await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
  const { project } = await requireProjectAdmin(tx, projectId, actorId);
  if (project.deletionPending)
    throw new SettingsError("Ce projet est en cours de suppression.");
  // L’agent ne se configure qu’avec un abonnement actif ou un essai en cours.
  const access = await getBillingAccess(tx, projectId);
  if (!access.allowed) throw new SettingsError(access.message);
  if (project.agentConfigVersion !== expectedVersion)
    throw new SettingsError(
      "Un autre membre a modifié cet agent. Rechargez la page avant d’enregistrer.",
    );
  const config = AgentConfigSchema.parse(input);
  const version = project.agentConfigVersion + 1;
  await tx.project.update({
    where: { id: projectId },
    data: {
      ...config,
      agentConfigVersion: version,
      agentSetupCompletedAt:
        project.agentSetupCompletedAt ?? (activate ? new Date() : null),
    },
  });
  await tx.settingsAudit.create({
    data: { projectId, actorId, action: "agent.updated", version },
  });
  return version;
}

/**
 * Fin de la configuration initiale : l’agent commence à répondre sur WhatsApp.
 * La configuration enregistrée est revalidée ici, jamais crue du navigateur.
 */
export async function activateAgent(
  tx: Prisma.TransactionClient,
  projectId: string,
  actorId: string,
) {
  await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
  const { project } = await requireProjectAdmin(tx, projectId, actorId);
  if (project.deletionPending)
    throw new SettingsError("Ce projet est en cours de suppression.");
  if (project.agentSetupCompletedAt) return false;
  const access = await getBillingAccess(tx, projectId);
  if (!access.allowed) throw new SettingsError(access.message);
  if (!AgentConfigSchema.safeParse(project).success)
    throw new SettingsError(
      "Terminez la configuration de votre agent avant de l’activer.",
    );
  await tx.project.update({
    where: { id: projectId },
    data: { agentSetupCompletedAt: new Date() },
  });
  await tx.settingsAudit.create({
    data: {
      projectId,
      actorId,
      action: "agent.activated",
      version: project.agentConfigVersion,
    },
  });
  return true;
}

export async function markProjectForDeletion(
  tx: Prisma.TransactionClient,
  projectId: string,
  actorId: string,
) {
  await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
  const { project } = await requireProjectAdmin(tx, projectId, actorId, true);
  const pending = await tx.outboundJob.findFirst({
    where: { projectId, state: { in: ["DISPATCHING", "UNCERTAIN"] } },
  });
  if (pending)
    throw new SettingsError(
      "Un envoi est en cours ou reste à vérifier. Réessayez la suppression après sa résolution.",
    );
  await tx.project.update({
    where: { id: projectId },
    data: { deletionPending: true, automationPaused: true },
  });
  return project;
}

export async function writeProjectPause(
  tx: Prisma.TransactionClient,
  projectId: string,
  actorId: string,
  expectedVersion: number,
  paused: boolean,
) {
  await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
  const { project } = await requireProjectAdmin(tx, projectId, actorId);
  if (project.deletionPending)
    throw new SettingsError("Ce projet est en cours de suppression.");
  if (project.settingsVersion !== expectedVersion)
    throw new SettingsError("Les réglages ont changé. Actualisez la page.");
  const billingStatus = project.statusBeforePause ?? project.status;
  if (!paused) {
    const [{ now }] = await tx.$queryRaw<
      Array<{ now: Date }>
    >`SELECT clock_timestamp() AS now`;
    const period = await tx.quotaPeriod.findFirst({
      where: {
        projectId,
        isCurrent: true,
        kind: billingStatus,
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
    });
    if (!["active", "trialing"].includes(billingStatus) || !period) {
      throw new SettingsError(
        "Vérifiez votre abonnement avant de réactiver le projet.",
      );
    }
  }
  const version = project.settingsVersion + 1;
  const status = paused ? "paused" : billingStatus;
  await tx.project.update({
    where: { id: projectId },
    data: {
      automationPaused: paused,
      status,
      statusBeforePause: paused ? billingStatus : null,
      settingsVersion: version,
      agentConfigVersion: { increment: 1 },
    },
  });
  await tx.settingsAudit.create({
    data: {
      projectId,
      actorId,
      action: paused ? "project.paused" : "project.resumed",
      version,
    },
  });
  return { version, status, automationPaused: paused };
}
