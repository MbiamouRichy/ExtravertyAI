"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server"; // Ton helper Better Auth
import crypto from "crypto";
import { Role } from "@/src/generated/prisma/client";
import { resend } from "@/lib/resend";
import { ProjectInvitationEmail } from "@/components/emailTemplate/invitationEmail";
import { ProjectMemberConfirmationEmail } from "@/components/emailTemplate/projectMemberConfirmationEmail";
import z from "zod";
import { isRecentSession } from "@/lib/recent-session";
import { allowRequest } from "@/lib/rate-limit";
import {
  assignableRoles,
  can,
  canManageMember,
} from "@/lib/project-permissions";

/** Adresse publique de l'application, sans laquelle aucun lien d'e-mail n'est valide. */
function appOrigin() {
  const origin = process.env.NEXT_PUBLIC_APP_URL;
  if (!origin) throw new Error("NEXT_PUBLIC_APP_URL manquant");
  return origin.replace(/\/$/, "");
}

/** Envoi d'un e-mail d'équipe : false si le modèle, la configuration ou Resend échoue. */
async function sendTeamEmail(
  build: () => Parameters<typeof resend.emails.send>[0],
) {
  try {
    const { error } = await resend.emails.send(build());
    if (error) throw new Error(error.message);
    return true;
  } catch (error) {
    console.error("[team] E-mail non envoyé :", error instanceof Error ? error.message : error);
    return false;
  }
}

const MemberTarget = z.object({
  projectId: z.string().cuid(),
  membershipId: z.string().cuid(),
});

export type TeamMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  createdAt: Date | string;
  open?: number;
  /** Conversations ouvertes qui lui sont assignées. */
  assigned?: number;
};

// ============================================================================
// 1. RÉCUPÉRER L'ÉQUIPE (Sécurisé)
// ============================================================================
export async function getTeamMembers(projectId: string) {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Non autorisé");

  const access = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
    select: { role: true },
  });
  // Le tableau de bord montre l'équipe disponible aux superviseurs et lecteurs ;
  // seuls ceux qui gèrent l'équipe voient les adresses e-mail.
  if (!can(access?.role, "team.manage") && !can(access?.role, "stats.view"))
    throw new Error("Accès refusé");
  const showEmails = can(access?.role, "team.manage");
  // 1. Récupérer les membres de l'équipe
  const memberships = await prisma.projectMembership.findMany({
    where: { projectId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
    },
    // Enum order goes from the narrowest role to OWNER: descending lists the owner first.
    orderBy: [{ role: "desc" }, { createdAt: "asc" }],
  });

  // 2. Récupérer les conversations actives des dernières 24h
  // On cherche les combinaisons uniques [agentId + contactId]
  const hier = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const conversationsActives = await prisma.message.findMany({
    where: {
      projectId,
      agentId: { not: null },
      createdAt: { gte: hier },
    },
    select: { agentId: true, contactId: true },
    distinct: ["agentId", "contactId"],
  });

  // 3. Regrouper le compte de conversations par agent
  const countParAgent = conversationsActives.reduce(
    (acc, msg) => {
      if (msg.agentId) {
        acc[msg.agentId] = (acc[msg.agentId] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>,
  );

  // Conversations ouvertes (non résolues) assignées à chaque membre.
  const assignedRows = await prisma.contact.groupBy({
    by: ["assigneeId"],
    where: { projectId, resolvedAt: null, assigneeId: { not: null } },
    _count: { _all: true },
  });
  const assignedParMembre = Object.fromEntries(
    assignedRows.map((row) => [row.assigneeId, row._count._all]),
  ) as Record<string, number>;

  // 4. Formater les données pour le composant
  return memberships.map((m) => {
    return {
      id: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: showEmails ? m.user.email : "",
      role: m.role,
      image: m.user.image,
      createdAt: m.createdAt,
      open: countParAgent[m.user.id] || 0, // <-- Le vrai chiffre calculé !
      assigned: assignedParMembre[m.user.id] || 0,
    };
  });
}
// ============================================================================
// 2. RETIRER UN MEMBRE (Hiérarchie stricte)
// ============================================================================
export async function removeTeamMember(
  membershipId: string,
  projectId: string,
) {
  try {
    if (!MemberTarget.safeParse({ projectId, membershipId }).success)
      return { success: false, error: "Données de requête invalides." };
    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    // Qui fait la demande ?
    const requester = await prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId: session.user.id, projectId } },
    });

    if (!can(requester?.role, "team.manage")) {
      return { success: false, error: "Droits insuffisants" };
    }

    // Qui cible-t-on ?
    const targetMember = await prisma.projectMembership.findUnique({
      where: { id: membershipId, projectId },
    });

    if (!targetMember) return { success: false, error: "Membre introuvable" };

    // SÉCURITÉ : Règles de hiérarchie
    if (targetMember.role === "OWNER") {
      return {
        success: false,
        error: "Impossible de supprimer le propriétaire",
      };
    }
    if (!canManageMember(requester?.role, targetMember.role)) {
      return {
        success: false,
        error: "Un administrateur ne peut pas retirer un autre administrateur.",
      };
    }

    await prisma.projectMembership.delete({
      where: { id: membershipId, projectId },
    });

    revalidatePath(`/projects/${projectId}`, "layout");
    return { success: true };
  } catch {
    return { success: false, error: "Erreur lors de la suppression." };
  }
}

// ============================================================================
// 3. INVITER UN MEMBRE (Better Auth + Resend)
// ============================================================================
const InviteSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  targetRole: z.nativeEnum(Role),
  projectId: z.string().cuid(),
});

export async function inviteTeamMember(
  rawEmail: string,
  rawRole: Role,
  rawProjectId: string,
) {
  try {
    const parsed = InviteSchema.safeParse({
      email: rawEmail,
      targetRole: rawRole,
      projectId: rawProjectId,
    });
    if (!parsed.success)
      return { success: false, error: "Adresse e-mail ou rôle invalide." };
    const { email, targetRole, projectId } = parsed.data;

    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    // 1. Vérification des droits de l'inviteur
    const requester = await prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId: session.user.id, projectId } },
      include: { project: true },
    });

    if (
      !requester ||
      requester.project.deletionPending ||
      !can(requester.role, "team.manage")
    ) {
      return {
        success: false,
        error: "Vous n'avez pas les droits pour inviter.",
      };
    }

    // SÉCURITÉ : un administrateur n'invite ni administrateur ni propriétaire ;
    // la propriété ne se donne que par le transfert dédié.
    if (!assignableRoles(requester.role).includes(targetRole)) {
      return {
        success: false,
        error: "Vous ne pouvez pas attribuer ce rôle.",
      };
    }

    // Chaque invitation envoie un e-mail : limite contre l'envoi en rafale.
    if (
      !allowRequest(`invite:${session.user.id}`, 20, 60 * 60 * 1000) ||
      !allowRequest(`invite-project:${projectId}`, 50, 24 * 60 * 60 * 1000)
    ) {
      return {
        success: false,
        error: "Trop d’invitations envoyées. Réessayez dans une heure.",
      };
    }

    // 2. L'utilisateur existe-t-il déjà dans la base ?
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      // --- CAS A : L'UTILISATEUR EXISTE DÉJÀ ---
      const alreadyInProject = await prisma.projectMembership.findUnique({
        where: { userId_projectId: { userId: existingUser.id, projectId } },
      });

      if (alreadyInProject) {
        return {
          success: false,
          error: "Cet utilisateur est déjà dans le projet.",
        };
      }

      // Ajout direct
      await prisma.projectMembership.create({
        data: { projectId, userId: existingUser.id, role: targetRole },
      });

      // L'ajout est fait : un e-mail d'information qui échoue ne l'annule pas.
      const notified = await sendTeamEmail(() => ({
        from: "ExtravertyAI <equipe@extravertyai.com>",
        to: email,
        subject: `Vous avez été ajouté au projet ${requester.project.name}`,
        html: ProjectMemberConfirmationEmail({
          inviterName: session.user.name || "Un membre de l'équipe",
          userName: existingUser.name,
          projectName: requester.project.name,
          role: targetRole,
          projectUrl: `${appOrigin()}/projects/${projectId}`,
          email: email,
        }),
      }));
      revalidatePath(`/projects/${projectId}`, "layout");
      return notified
        ? { success: true }
        : {
            success: true,
            warning:
              "Membre ajouté, mais l’e-mail d’information n’a pas pu être envoyé.",
          };
    } else {
      // --- CAS B : L'UTILISATEUR N'EXISTE PAS (Création d'une Invitation) ---

      // Nettoyage d'une éventuelle ancienne invitation expirée
      await prisma.invitation.deleteMany({
        where: { email, projectId },
      });

      const inviteToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Expire dans 7 jours

      await prisma.invitation.create({
        data: {
          email,
          projectId,
          role: targetRole,
          token: inviteToken,
          expiresAt,
          inviterId: session.user.id,
        },
      });

      // Sans e-mail, l'invité n'a pas le lien : l'invitation est retirée.
      const sent = await sendTeamEmail(() => ({
        from: "ExtravertyAI <equipe@extravertyai.com>",
        to: email,
        subject: `Invitation à rejoindre ${requester.project.name}`,
        html: ProjectInvitationEmail({
          inviterName: session.user.name || "Un membre de l'équipe",
          projectName: requester.project.name,
          role: targetRole,
          inviteUrl: `${appOrigin()}/invite?token=${inviteToken}`,
          email: email,
        }),
      }));
      if (!sent) {
        await prisma.invitation.deleteMany({ where: { token: inviteToken } });
        return {
          success: false,
          error: "L’e-mail d’invitation n’a pas pu être envoyé. Vérifiez l’adresse et réessayez.",
        };
      }
    }

    revalidatePath(`/projects/${projectId}`, "layout");
    return { success: true };
  } catch (error) {
    console.error("Erreur invitation:", error);
    return {
      success: false,
      error: "Une erreur est survenue lors de l'invitation.",
    };
  }
}

const updateRoleSchema = z.object({
  projectId: z.string().cuid("ID projet requis"),
  membershipId: z.string().cuid("ID membre requis"),
  newRole: z.nativeEnum(Role),
});

export async function updateMemberRole(
  input: z.infer<typeof updateRoleSchema>,
) {
  const parse = updateRoleSchema.safeParse(input);

  if (!parse.success) {
    return { success: false, error: "Données de requête invalides." };
  }

  const { projectId, membershipId, newRole } = parse.data;

  try {
    const session = await getSession();
    const currentUser = session?.user;
    if (!currentUser) {
      return { success: false, error: "Vous devez être connecté." };
    }

    // 1. Vérifier le rôle de l'utilisateur exécutant l'action
    const requesterMembership = await prisma.projectMembership.findUnique({
      where: {
        userId_projectId: {
          userId: currentUser.id,
          projectId,
        },
      },
    });

    if (!requesterMembership) {
      return { success: false, error: "Vous n'appartenez pas à ce projet." };
    }

    const requesterRole = requesterMembership.role;

    // 2. Récupérer le membre cible
    const targetMembership = await prisma.projectMembership.findUnique({
      where: { id: membershipId },
      include: { user: { select: { name: true, email: true } } },
    });

    if (!targetMembership || targetMembership.projectId !== projectId) {
      return { success: false, error: "Membre introuvable dans ce projet." };
    }

    // 3. GARDE-FOUS DE SÉCURITÉ
    // A. Interdiction de modifier son propre rôle depuis cette interface
    if (targetMembership.userId === currentUser.id) {
      return {
        success: false,
        error: "Vous ne pouvez pas modifier votre propre rôle.",
      };
    }

    // B. Impossible de modifier un OWNER
    if (targetMembership.role === "OWNER") {
      return {
        success: false,
        error: "Le rôle du propriétaire du projet ne peut pas être modifié.",
      };
    }

    // C. Seuls ceux qui gèrent l'équipe changent un rôle, et jamais celui d'un
    // rôle égal ou supérieur (un administrateur ne touche pas un administrateur).
    if (!canManageMember(requesterRole, targetMembership.role)) {
      return {
        success: false,
        error: "Vous n'avez pas les droits pour modifier le rôle de ce membre.",
      };
    }

    // D. Seul le propriétaire nomme des administrateurs ; la propriété passe
    // uniquement par le transfert dédié.
    if (!assignableRoles(requesterRole).includes(newRole)) {
      return {
        success: false,
        error:
          "Vous n'avez pas les droits pour accorder ce niveau de privilège.",
      };
    }

    // 4. Mettre à jour le rôle
    await prisma.projectMembership.update({
      where: { id: membershipId },
      data: { role: newRole },
    });

    revalidatePath(`/projects/${projectId}`, "layout");
    return {
      success: true,
      message: `Le rôle de ${targetMembership.user.name || targetMembership.user.email} a été mis à jour.`,
    };
  } catch (error) {
    console.error("Erreur modification rôle:", error);
    return {
      success: false,
      error: "Une erreur interne est survenue lors de la mise à jour.",
    };
  }
}

// ============================================================================
// TRANSFÉRER LA PROPRIÉTÉ (OWNER → membre existant)
// ============================================================================
const transferOwnershipSchema = z.object({
  projectId: z.string().min(1),
  membershipId: z.string().min(1),
});

export async function transferProjectOwnership(
  input: z.infer<typeof transferOwnershipSchema>,
): Promise<
  | { success: true; message: string }
  | { success: false; error: string; code?: "REAUTH_REQUIRED" }
> {
  const parse = transferOwnershipSchema.safeParse(input);
  if (!parse.success)
    return { success: false, error: "Données de requête invalides." };
  const { projectId, membershipId } = parse.data;

  try {
    const session = await getSession();
    if (!session?.user) return { success: false, error: "Vous devez être connecté." };
    // Handing over billing and full control is as sensitive as deleting the
    // account: require the same recent login.
    if (!isRecentSession(session.session.createdAt))
      return {
        success: false,
        code: "REAUTH_REQUIRED",
        error: "Reconnectez-vous pour transférer la propriété (connexion de moins de 10 minutes requise).",
      };
    const userId = session.user.id;

    const result = await prisma.$transaction(async (tx) => {
      const requester = await tx.projectMembership.findUnique({
        where: { userId_projectId: { userId, projectId } },
        select: { id: true, role: true },
      });
      if (requester?.role !== "OWNER")
        return { success: false as const, error: "Seul le propriétaire peut transférer la propriété du projet." };
      const target = await tx.projectMembership.findUnique({
        where: { id: membershipId },
        select: { id: true, projectId: true, userId: true, role: true, user: { select: { name: true, email: true } } },
      });
      if (!target || target.projectId !== projectId || target.userId === userId)
        return { success: false as const, error: "Membre introuvable dans ce projet." };
      if (target.role === "OWNER")
        return { success: false as const, error: "Ce membre est déjà propriétaire du projet." };
      await tx.projectMembership.update({ where: { id: target.id }, data: { role: "OWNER" } });
      // The previous owner keeps team management rights but loses billing.
      await tx.projectMembership.update({ where: { id: requester.id }, data: { role: "ADMIN" } });
      return {
        success: true as const,
        message: `${target.user.name || target.user.email} est désormais propriétaire du projet.`,
      };
    });

    if (result.success) revalidatePath(`/projects/${projectId}`, "layout");
    return result;
  } catch (error) {
    console.error("Erreur transfert de propriété:", error);
    return { success: false, error: "Le transfert n’a pas pu être effectué. Réessayez." };
  }
}
