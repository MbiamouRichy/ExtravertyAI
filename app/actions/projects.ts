"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";
import z from "zod";
import { setProjectPaused } from "./project-settings";
import { deleteProjectResources } from "@/lib/project-deletion";
import { billingAccess } from "@/lib/billing-access";

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
            automationPaused: true,
            statusBeforePause: true,
            stripeStatus: true,
            deletionPending: true,
            quotaPeriods: {
              where: { isCurrent: true },
              orderBy: { startsAt: "desc" },
              take: 1,
              select: { kind: true, startsAt: true, endsAt: true },
            },
            agentSetupCompletedAt: true,
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

    const [{ now }] = await prisma.$queryRaw<
      Array<{ now: Date }>
    >`SELECT clock_timestamp() AS now`;
    return memberships.map(({ project }) => {
      const {
        quotaPeriods,
        stripeStatus,
        statusBeforePause,
        deletionPending,
        ...visible
      } = project;
      const period = quotaPeriods[0];
      return {
        ...visible,
        billingAccess: billingAccess(
          {
            ...project,
            stripeStatus,
            statusBeforePause,
            deletionPending,
            kind: period?.kind ?? null,
            startsAt: period?.startsAt ?? null,
            endsAt: period?.endsAt ?? null,
          },
          now,
        ),
      };
    });
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
            automationPaused: true,
            agentSetupCompletedAt: true,
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

    return setProjectPaused({
      projectId,
      paused: !membership.project.automationPaused,
      expectedVersion: membership.project.settingsVersion,
    });
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
  formData: z.infer<typeof ProjectActionSchema> & { confirmationName: string },
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return { success: false, error: "Utilisateur non authentifié" };
  }

  try {
    const parsed = ProjectActionSchema.extend({
      confirmationName: z.string().min(1).max(100),
    }).safeParse(formData);
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
    if (parsed.data.confirmationName !== project.name)
      throw new Error("Le nom de confirmation ne correspond pas au projet.");

    await deleteProjectResources(projectId, session.user.id);

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
