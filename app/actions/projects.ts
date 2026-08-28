"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";
import z from "zod";
import { ProjectStatus } from "@/src/generated/prisma/client";

export async function getProjects() {
  const session = await getSession();

  // On retourne un tableau vide plutôt que de faire crasher l'application
  if (!session?.user?.id) return [];

  try {
    const memberships = await prisma.projectMembership.findMany({
      where: {
        userId: session.user.id,
      },
      select: {
        project: {
          select: {
            id: true,
            name: true,
            numero: true,
            status: true,
            plan: true,
            messageCount: true,
            allMessagesCount: true,
            expiredAt: true,
            instanceStatus: true,
            stripeCurrentPeriodEnd: true,
          },
        },
      },
    });

    return memberships.map((m) => m.project);
  } catch (error) {
    console.error("Erreur lors de la récupération des projets:", error);
    return [];
  }
}

export async function getProjectById(projectId: string) {
  if (!projectId) return null;

  const session = await getSession();

  // On retourne 'null' pour que le composant de page puisse rediriger proprement
  if (!session?.user?.id) return null;

  try {
    const memberShip = await prisma.projectMembership.findUnique({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId: projectId,
        },
      },
      select: {
        role: true,
        project: {
          select: {
            id: true,
            name: true,
            numero: true,
            status: true,
            plan: true,
            messageCount: true,
            allMessagesCount: true,
            expiredAt: true,
            instanceName: true,
            instanceStatus: true,
            stripeCurrentPeriodEnd: true,
          },
        },
      },
    });

    // Si on ne trouve pas l'adhésion, c'est que soit le projet n'existe pas,
    // soit l'utilisateur n'a pas le droit de le voir (sécurité absolue)
    if (!memberShip) {
      return null;
    }

    // Optionnel : On peut aussi injecter le rôle de l'utilisateur dans l'objet retourné
    // si le frontend a besoin de savoir s'il est OWNER, ADMIN, etc.
    return {
      ...memberShip.project,
      userRole: memberShip.role,
    };
  } catch (error) {
    console.error("Erreur lors de la récupération du projet:", error);
    return null;
  }
}

const ProjectActionSchema = z.object({
  projectId: z.string().cuid(),
});

// 1. DÉSACTIVER LE PROJET
export async function disableProject(
  formData: z.infer<typeof ProjectActionSchema>,
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return { success: false, error: "Utilisateur non authentifié" };
  }

  try {
    const parsed = ProjectActionSchema.safeParse(formData);
    if (!parsed.success) throw new Error("Données invalides");

    const { projectId } = parsed.data;

    // CORRECTION : On récupère la relation (pour le rôle) ET les données du projet
    const membership = await prisma.projectMembership.findUnique({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId: projectId,
        },
      },
      include: {
        project: true, // Nécessaire pour accéder à membership.project.instanceName plus bas
      },
    });

    if (!membership || !membership.project)
      throw new Error("Projet introuvable");

    // SÉCURITÉ : Bloquer si l'utilisateur n'est pas le propriétaire ou un admin
    // (Ajuste "OWNER" / "ADMIN" selon ce que tu as défini dans ton schéma Prisma)
    if (membership.role !== "OWNER" && membership.role !== "ADMIN") {
      throw new Error("Droits insuffisants pour désactiver ce projet.");
    }

    const statusToSet =
      membership.project.status === "active" ||
      membership.project.status === "trialing";
    let newStatus: ProjectStatus = statusToSet ? "paused" : "active";
    if (membership.project.instanceName && newStatus === "paused") {
      await fetch(
        `${process.env.EVOLUTION_API_URL}/instance/logout/${membership.project.instanceName}`,
        {
          method: "DELETE",
          headers: { apikey: process.env.EVOLUTION_API_KEY! },
        },
      );
    }
    if (membership.project.expiredAt) {
      newStatus = statusToSet ? "paused" : "trialing";
    }
    await prisma.project.update({
      where: { id: projectId },
      data: { status: newStatus },
    });

    revalidatePath(`/dashboard/projects/${projectId}`);
    return { success: true };
  } catch (error: unknown) {
    // CORRECTION : Remplacement de "any" par "unknown"
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Erreur lors de la désactivation";
    console.error("Erreur disableProject:", errorMessage);
    return { success: false, error: errorMessage };
  }
}
// 2. SUPPRIMER LE PROJET (IRRÉVERSIBLE)
export async function deleteProjectAction(
  formData: z.infer<typeof ProjectActionSchema>,
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return { success: false, error: "Utilisateur non authentifié" };
  }

  try {
    const parsed = ProjectActionSchema.safeParse(formData);
    if (!parsed.success) throw new Error("Données invalides");

    const { projectId } = parsed.data;

    const membership = await prisma.projectMembership.findUnique({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId: projectId,
        },
      },
      include: {
        project: true,
      },
    });

    if (!membership || !membership.project)
      throw new Error("Projet introuvable");

    // SÉCURITÉ : La suppression doit être encore plus stricte (souvent réservée au seul OWNER)
    if (membership.role !== "OWNER") {
      throw new Error("Seul le propriétaire peut supprimer le projet.");
    }

    // 1. NETTOYAGE EXTERNE : Supprimer l'instance sur Evolution API
    /*
    if (membership.project.instanceName) {
      await fetch(`${process.env.EVOLUTION_API_URL}/instance/delete/${membership.project.instanceName}`, {
        method: "DELETE",
        headers: { "apikey": process.env.EVOLUTION_API_KEY! }
      });
    }
    */

    // 2. SUPPRESSION EN BASE DE DONNÉES
    // Note : Prisma gérera la suppression en cascade de membership, contacts, etc. SI configuré.
    await prisma.project.delete({
      where: { id: projectId },
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: unknown) {
    // CORRECTION : Remplacement de "any" par "unknown"
    const errorMessage =
      error instanceof Error ? error.message : "Erreur lors de la suppression";
    console.error("Erreur deleteProjectAction:", errorMessage);
    return { success: false, error: errorMessage };
  }
}
