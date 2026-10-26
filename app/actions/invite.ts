"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server"; // Ton helper Better Auth

// 1. Accepter l'invitation (Une fois le compte créé ou si l'utilisateur est déjà logué)
export async function consumeInvitation(token: string) {
  try {
    // Jeton émis par crypto.randomBytes(32) en hexadécimal.
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/.test(token)) {
      return {
        success: false,
        error: "Invitation introuvable ou déjà utilisée.",
      };
    }
    const session = await getSession();
    if (!session?.user?.id) {
      return { success: false, error: "Vous devez être authentifié." };
    }

    // Récupérer l'invitation
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { project: true },
    });

    if (!invitation) {
      return {
        success: false,
        error: "Invitation introuvable ou déjà utilisée.",
      };
    }

    if (invitation.expiresAt < new Date()) {
      return { success: false, error: "Cette invitation a expiré." };
    }

    // SÉCURITÉ : Vérifier que l'email de session correspond à l'email invité
    if (
      session.user.email.trim().toLowerCase() !==
      invitation.email.trim().toLowerCase()
    ) {
      return {
        success: false,
        error: "L'email de votre compte ne correspond pas à l'invitation.",
      };
    }

    // TRANSACTION : Ajouter au projet ET supprimer l'invitation
    await prisma.$transaction(async (tx) => {
      // 1. Ajouter le membre. Une invitation ne crée jamais de propriétaire
      // (transfert dédié) et ne rétrograde pas un propriétaire déjà membre.
      const role = invitation.role === "OWNER" ? "ADMIN" : invitation.role;
      const key = {
        userId_projectId: {
          userId: session.user.id,
          projectId: invitation.projectId,
        },
      };
      const existing = await tx.projectMembership.findUnique({
        where: key,
        select: { role: true },
      });
      if (!existing) {
        await tx.projectMembership.create({
          data: { userId: session.user.id, projectId: invitation.projectId, role },
        });
      } else if (existing.role !== "OWNER") {
        await tx.projectMembership.update({ where: key, data: { role } });
      }

      // 2. Supprimer l'invitation
      await tx.invitation.delete({
        where: { id: invitation.id },
      });
    });

    return {
      success: true,
      projectId: invitation.projectId,
      message: `Bienvenue dans le projet ${invitation.project.name} !`,
    };
  } catch (error) {
    console.error("Erreur consumeInvitation:", error);
    return {
      success: false,
      error: "Erreur lors de l'acceptation de l'invitation.",
    };
  }
}
