"use server";

import { getUser } from "@/lib/auth-server";
import prisma from "@/lib/prisma"; // Ajustez le chemin vers votre client Prisma
import { revalidatePath } from "next/cache";
// Importez votre méthode d'authentification Better Auth (ex: getSession())
// import { getSession } from "@/lib/auth";

/**
 * 🛡️ MIDDLEWARE DE SÉCURITÉ (RBAC)
 * Vérifie que l'utilisateur est authentifié et possède les droits nécessaires sur le projet.
 */
async function verifyProjectAccess(
  projectId: string,
  allowedRoles: string[] = ["OWNER", "ADMIN"],
) {
  const user = await getUser();
  const userId = user?.id;
  if (!userId) {
    throw new Error("UNAUTHORIZED: Vous devez être connecté.");
  }

  // 2. Vérification de l'autorisation (Appartenance au projet + Rôle)
  const membership = await prisma.projectMembership.findUnique({
    where: {
      userId_projectId: {
        userId: userId,
        projectId: projectId,
      },
    },
    select: { role: true },
  });

  if (!membership || !allowedRoles.includes(membership.role)) {
    throw new Error(
      "FORBIDDEN: Vous n'avez pas les droits nécessaires sur ce projet.",
    );
  }

  return true;
}

/**
 * 🔄 BASCULER L'ÉTAT DE L'IA (Handover)
 */
export async function toggleContactAiStatus(
  projectId: string,
  contactId: string,
  newStatus: boolean,
) {
  try {
    // Validation stricte des droits avant toute action
    await verifyProjectAccess(projectId, ["OWNER", "ADMIN"]);

    const updatedContact = await prisma.contact.update({
      where: {
        id: contactId,
        projectId: projectId, // Sécurité additionnelle : on s'assure que le contact appartient bien à ce projet
      },
      data: { aiActive: newStatus },
    });

    // Purge le cache Next.js pour mettre à jour l'interface instantanément
    revalidatePath(`/projects/${projectId}`);

    return { success: true, aiActive: updatedContact.aiActive };
  } catch (error) {
    // On vérifie de manière sécurisée si c'est bien une instance d'Error
    const errorMessage =
      error instanceof Error ? error.message : "Erreur inconnue";

    // On log l'erreur exacte côté serveur pour le debugging
    console.error("[SECURITY] Échec du toggle IA :", errorMessage);

    // On renvoie un message d'erreur générique au client
    return {
      success: false,
      error: "Impossible de modifier le statut de l'IA.",
    };
  }
}

/**
 * 🗑️ SUPPRIMER UN CONTACT
 */
export async function deleteContact(projectId: string, contactId: string) {
  try {
    // Seuls les ADMIN et OWNER peuvent supprimer
    await verifyProjectAccess(projectId, ["OWNER", "ADMIN"]);

    await prisma.contact.delete({
      where: {
        id: contactId,
        projectId: projectId,
      },
    });

    revalidatePath(`/projects/${projectId}`);

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Erreur inconnue";
    console.error(
      "[SECURITY] Échec de la suppression du contact :",
      errorMessage,
    );

    return { success: false, error: "Impossible de supprimer le contact." };
  }
}
