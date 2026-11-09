import { createHash } from "node:crypto";
import type { PrismaClient } from "../src/generated/prisma/client";
import { assignableRoles, can } from "./project-permissions";
import { teamSeats } from "./plan-features";

export type InvitationFailure =
  | "NOT_FOUND"
  | "EXPIRED"
  | "WRONG_ACCOUNT"
  | "REVOKED"
  | "TEAM_FULL";

type Db = Pick<PrismaClient, "invitation" | "projectMembership" | "$transaction">;

/** Seule l’empreinte est en base : une fuite de la table n’ouvre aucun projet. */
export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Jeton émis par crypto.randomBytes(32) en hexadécimal. */
export function isInvitationToken(token: unknown): token is string {
  return typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
}

export function sameEmail(a: string, b: string) {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Seule voie d’entrée dans un projet : l’invité, connecté avec l’adresse
 * invitée, accepte lui-même. L’inviteur doit encore avoir le droit de donner ce
 * rôle, et le jeton ne sert qu’une fois, même sur deux demandes simultanées.
 */
export async function acceptInvitation(
  db: Db,
  user: { id: string; email: string },
  token: string,
): Promise<
  | { ok: true; projectId: string; projectName: string }
  | { ok: false; reason: InvitationFailure }
> {
  if (!isInvitationToken(token)) return { ok: false, reason: "NOT_FOUND" };
  return db.$transaction(async (tx) => {
    const invitation = await tx.invitation.findUnique({
      where: { token: hashInvitationToken(token) },
      select: { id: true, email: true, expiresAt: true, projectId: true, inviterId: true, role: true },
    });
    if (!invitation) return { ok: false, reason: "NOT_FOUND" };
    if (invitation.expiresAt < new Date())
      return { ok: false, reason: "EXPIRED" };
    if (!sameEmail(user.email, invitation.email))
      return { ok: false, reason: "WRONG_ACCOUNT" };

    const { projectId, inviterId, role } = invitation;
    // Verrou du projet : deux acceptations simultanées ne dépassent pas l’offre,
    // et l’offre lue est celle en vigueur au moment de l’entrée.
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
    const project = await tx.project.findUniqueOrThrow({
      where: { id: projectId },
      select: { name: true, plan: true, deletionPending: true },
    });
    const inviter = await tx.projectMembership.findUnique({
      where: { userId_projectId: { userId: inviterId, projectId } },
      select: { role: true },
    });
    const revoked =
      project.deletionPending ||
      !can(inviter?.role, "team.manage") ||
      !assignableRoles(inviter?.role).includes(role);
    if (!revoked) {
      const [alreadyMember, members] = await Promise.all([
        tx.projectMembership.count({ where: { projectId, userId: user.id } }),
        tx.projectMembership.count({ where: { projectId } }),
      ]);
      // Équipe complète : l’invitation reste valable, pour une place libérée.
      if (!alreadyMember && members >= teamSeats(project.plan))
        return { ok: false, reason: "TEAM_FULL" };
    }
    const consumed = await tx.invitation.deleteMany({
      where: { id: invitation.id },
    });
    if (consumed.count === 0) return { ok: false, reason: "NOT_FOUND" };
    if (revoked) return { ok: false, reason: "REVOKED" };

    // Déjà membre : l’invitation est consommée, le rôle actuel ne change pas.
    await tx.projectMembership.upsert({
      where: { userId_projectId: { userId: user.id, projectId } },
      create: { userId: user.id, projectId, role },
      update: {},
    });
    return { ok: true, projectId, projectName: project.name };
  });
}

/** Refus de l’invité : le lien cesse de fonctionner, aucun accès n’est créé. */
export async function declineInvitation(
  db: Db,
  user: { email: string },
  token: string,
) {
  if (!isInvitationToken(token)) return false;
  const invitation = await db.invitation.findUnique({
    where: { token: hashInvitationToken(token) },
    select: { id: true, email: true },
  });
  if (!invitation || !sameEmail(user.email, invitation.email)) return false;
  await db.invitation.deleteMany({ where: { id: invitation.id } });
  return true;
}
