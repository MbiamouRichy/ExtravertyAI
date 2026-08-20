"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";

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
