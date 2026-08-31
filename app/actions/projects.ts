"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";
import z from "zod";
import { ProjectStatus } from "@/src/generated/prisma/client";
import { stripe } from "@/lib/stripe";
import { deleteEvolutionInstance } from "./evolutionAPI";

// 1. RÉCUPERER TOUS LES PROJETS
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

// 2. RÉCUPERER LE PROJET VIA SON ID
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

// 3. DÉSACTIVER LE PROJET
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

    revalidatePath(`/projects/projects/${projectId}`);
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
// 4. SUPPRIMER LE PROJET (IRRÉVERSIBLE)
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

    if (membership.role !== "OWNER") {
      throw new Error("Seul le propriétaire peut supprimer le projet.");
    }

    const project = membership.project;

    // --- ÉTAPE 1 : COUPER LA FACTURATION STRIPE ---
    if (project.stripeSubscriptionId) {
      try {
        await stripe.subscriptions.cancel(project.stripeSubscriptionId);
      } catch (stripeError) {
        console.error("Erreur annulation Stripe:", stripeError);
        // On continue, l'abonnement est peut-être déjà annulé.
      }
    }

    // --- ÉTAPE 2 : NETTOYER EVOLUTION API ---
    if (project.instanceName) {
      try {
        // 1. Déconnecter proprement WhatsApp (Logout)
        // Ajout d'un .catch silencieux sur le fetch pour que même un crash réseau pur ne bloque pas
        await fetch(
          `${process.env.EVOLUTION_API_URL}/instance/logout/${project.instanceName}`,
          {
            method: "DELETE",
            headers: { apikey: process.env.EVOLUTION_API_KEY! },
          },
        ).catch(() => {});

        // 2. Supprimer l'instance (ta fonction a déjà un timeout et gère le 404)
        await deleteEvolutionInstance(project.instanceName);
      } catch (evoError) {
        // CORRECTION MAJEURE : On loggue, mais ON NE BLOQUE PAS.
        console.error(
          "Erreur nettoyage Evolution API (orphelin potentiel):",
          evoError,
        );
        // Si l'instance reste bloquée sur ton serveur, c'est ton problème d'admin à nettoyer plus tard,
        // pas celui de l'utilisateur qui a le droit de voir son projet supprimé.
      }
    }

    // --- ÉTAPE 3 : SUPPRESSION EN BASE DE DONNÉES ---
    await prisma.project.delete({
      where: { id: projectId },
    });

    // Optionnel mais recommandé : purger depuis la racine pour éviter le bug de cache du header
    revalidatePath("/", "layout");

    return { success: true };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Erreur lors de la suppression";
    console.error("Erreur deleteProjectAction:", errorMessage);
    return { success: false, error: errorMessage };
  }
}
