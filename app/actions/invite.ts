"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import crypto from "crypto";
import { Role } from "@/src/generated/prisma/client";
import { z } from "zod";

// Schéma de validation pour l'inscription depuis l'invitation
const acceptInviteSchema = z.object({
  token: z.string().min(1, "Jeton invalide"),
  name: z.string().min(2, "Le nom doit contenir au moins 2 caractères"),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères"),
});

export type InvitationDetails = {
  id: string;
  email: string;
  role: Role;
  expiresAt: Date;
  project: {
    id: string;
    name: string;
    numero: string;
  };
  inviter: {
    name: string;
    image: string | null;
  };
};

/**
 * Récupère et vérifie la validité d'une invitation via son token.
 */
export async function getInvitationDetails(token: string): Promise<{
  success: boolean;
  invitation?: InvitationDetails;
  error?: string;
}> {
  try {
    if (!token) {
      return { success: false, error: "Jeton d'invitation manquant." };
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            numero: true,
          },
        },
        inviter: {
          select: {
            name: true,
            image: true,
          },
        },
      },
    });

    if (!invitation) {
      return {
        success: false,
        error: "Invitation introuvable ou déjà utilisée.",
      };
    }

    // Vérification de l'expiration (7 jours par défaut)
    if (new Date() > invitation.expiresAt) {
      return { success: false, error: "Cette invitation a expiré." };
    }

    return { success: true, invitation };
  } catch (error) {
    console.error("Erreur récupération invitation:", error);
    return { success: false, error: "Une erreur serveur est survenue." };
  }
}

/**
 * Traite l'inscription de l'utilisateur et son ajout au projet de façon atomique.
 */
export async function acceptInvitationAndRegister(formData: {
  token: string;
  name: string;
  password: string;
}) {
  const parse = acceptInviteSchema.safeParse(formData);

  if (!parse.success) {
    return {
      success: false,
      error: parse.error.issues[0]?.message || "Données invalides.",
    };
  }

  const { token, name, password } = parse.data;

  try {
    // 1. Récupération de l'invitation
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { project: true },
    });

    if (!invitation || new Date() > invitation.expiresAt) {
      return { success: false, error: "Invitation invalide ou expirée." };
    }

    // 2. Vérifier si un utilisateur n'a pas été créé entre-temps
    const existingUser = await prisma.user.findUnique({
      where: { email: invitation.email },
    });

    let targetUserId = existingUser?.id;

    // 3. Hachage du mot de passe pour l'Account (Better Auth style)
    // Note: Remplacez ce hachage sha256 simplifié par votre helper de hachage Better Auth / Argon2 / Bcrypt si nécessaire.
    const passwordHash = crypto
      .createHash("sha256")
      .update(password)
      .digest("hex");

    // 4. Transaction Atomique : Création du compte + Adhésion + Suppression de l'invitation
    await prisma.$transaction(async (tx) => {
      if (!targetUserId) {
        // Créer l'utilisateur
        const newUser = await tx.user.create({
          data: {
            id: crypto.randomUUID(),
            name,
            email: invitation.email,
            emailVerified: true, // L'email est validé implicitement par la réception de l'invitation
            globalRole: "USER",
          },
        });
        targetUserId = newUser.id;

        // Créer le compte d'authentification lié
        await tx.account.create({
          data: {
            id: crypto.randomUUID(),
            userId: targetUserId,
            accountId: targetUserId,
            providerId: "credential",
            password: passwordHash,
          },
        });
      }

      // Ajouter l'adhésion au projet
      await tx.projectMembership.create({
        data: {
          userId: targetUserId,
          projectId: invitation.projectId,
          role: invitation.role,
        },
      });

      // Nettoyer l'invitation
      await tx.invitation.delete({
        where: { id: invitation.id },
      });
    });

    revalidatePath(`/projects/${invitation.projectId}`, "layout");
    return { success: true, projectId: invitation.projectId };
  } catch (error) {
    console.error("Erreur acceptation invitation:", error);
    return {
      success: false,
      error: "Impossible de finaliser la création du compte.",
    };
  }
}
