import "server-only";

import { cache } from "react";
import { getSession } from "@/lib/auth-server";
import { getProjectById } from "@/app/actions/projects";
import prisma from "@/lib/prisma";

export const getAnalyticsAccess = cache(async (projectId: string) => {
  const session = await getSession();

  if (!session?.user?.id) {
    return { status: "unauthenticated" } as const;
  }

  if (
    typeof projectId !== "string" ||
    projectId.trim().length === 0 ||
    projectId.length > 200
  ) {
    return { status: "not-found" } as const;
  }

  // Un projet inexistant et un projet sans membership produisent
  // la même réponse, pour limiter l'énumération des projets.
  const membership = await prisma.projectMembership.findUnique({
    where: {
      userId_projectId: {
        userId: session.user.id,
        projectId,
      },
    },
    select: {
      project: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!membership) {
    return { status: "not-found" } as const;
  }

  // On réutilise la résolution des rôles déjà présente dans ton application,
  // sans supposer le nom d'un champ "role" dans ton schéma Prisma.
  const project = await getProjectById(projectId);

  if (!project) {
    return { status: "not-found" } as const;
  }

  if (project.userRole !== "OWNER" && project.userRole !== "ADMIN") {
    return { status: "forbidden" } as const;
  }

  return {
    status: "authorized",
    projectName: membership.project.name,
  } as const;
});
