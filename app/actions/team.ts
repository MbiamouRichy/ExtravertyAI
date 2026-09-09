"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server"; // Ton helper Better Auth
import crypto from "crypto";
import { Role } from "@/src/generated/prisma/client";
import { resend } from "@/lib/resend";
import { ProjectInvitationEmail } from "@/components/emailTemplate/invitationEmail";
import { ProjectMemberConfirmationEmail } from "@/components/emailTemplate/projectMemberConfirmationEmail";
import { z } from "zod";

export type TeamMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: Role;
  createdAt: Date;
};

// ============================================================================
// 1. RÉCUPÉRER L'ÉQUIPE (Sécurisé)
// ============================================================================
export async function getTeamMembers(projectId: string): Promise<TeamMember[]> {
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Non autorisé");

  // SÉCURITÉ : Vérifier que l'utilisateur fait bien partie de CE projet
  const isMember = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
  });

  if (!isMember) throw new Error("Accès refusé à ce projet");

  const memberships = await prisma.projectMembership.findMany({
    where: { projectId },
    include: { user: { select: { name: true, email: true, image: true } } },
    orderBy: { role: "asc" },
  });

  return memberships.map((m) => ({
    id: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    image: m.user.image,
    role: m.role,
    createdAt: m.createdAt,
  }));
}

// ============================================================================
// 2. RETIRER UN MEMBRE (Hiérarchie stricte)
// ============================================================================
export async function removeTeamMember(
  membershipId: string,
  projectId: string,
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    // Qui fait la demande ?
    const requester = await prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId: session.user.id, projectId } },
    });

    if (!requester || requester.role === "USER") {
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
    if (requester.role === "ADMIN" && targetMember.role === "ADMIN") {
      return {
        success: false,
        error: "Un Admin ne peut pas supprimer un autre Admin",
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
export async function inviteTeamMember(
  email: string,
  targetRole: Role,
  projectId: string,
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false, error: "Non authentifié" };

    // 1. Vérification des droits de l'inviteur
    const requester = await prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId: session.user.id, projectId } },
      include: { project: true },
    });

    if (!requester || requester.role === "USER") {
      return {
        success: false,
        error: "Vous n'avez pas les droits pour inviter.",
      };
    }

    // SÉCURITÉ : Empêcher un Admin d'inviter un Owner
    if (requester.role === "ADMIN" && targetRole === "OWNER") {
      return {
        success: false,
        error: "Un Admin ne peut pas inviter un Owner.",
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

      const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/projects/${projectId}`;
      // Envoi Email d'information
      await resend.emails.send({
        from: "ExtravertyAI <equipe@extravertyai.com>",
        to: email,
        subject: `Vous avez été ajouté au projet ${requester.project.name}`,
        html: ProjectMemberConfirmationEmail({
          inviterName: session.user.name || "Un membre de l'équipe",
          userName: existingUser.name,
          projectName: requester.project.name,
          role: targetRole,
          projectUrl: inviteLink,
          email: email,
        }),
      });
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

      const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/invite?token=${inviteToken}`;

      // Envoi Email d'invitation avec Resend
      await resend.emails.send({
        from: "ExtravertyAI <equipe@extravertyai.com>",
        to: email,
        subject: `Invitation à rejoindre ${requester.project.name}`,
        html: ProjectInvitationEmail({
          inviterName: session.user.name || "Un membre de l'équipe",
          projectName: requester.project.name,
          role: targetRole,
          inviteUrl: inviteLink,
          email: email,
        }),
      });
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
  projectId: z.string().min(1, "ID projet requis"),
  membershipId: z.string().min(1, "ID membre requis"),
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

    // C. Un ADMIN ne peut modifier que des USER et ne peut pas promouvoir en ADMIN/OWNER
    if (requesterRole === "ADMIN") {
      if (targetMembership.role !== "USER") {
        return {
          success: false,
          error:
            "Les administrateurs ne peuvent modifier que les membres standards.",
        };
      }
      if (newRole === "OWNER" || newRole === "ADMIN") {
        return {
          success: false,
          error:
            "Vous n'avez pas les droits pour accorder ce niveau de privilège.",
        };
      }
    }

    // D. Seul un OWNER peut attribuer le rôle ADMIN ou OWNER
    if (
      requesterRole !== "OWNER" &&
      (newRole === "ADMIN" || newRole === "OWNER")
    ) {
      return {
        success: false,
        error:
          "Seul le propriétaire du projet peut nommer des administrateurs.",
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
