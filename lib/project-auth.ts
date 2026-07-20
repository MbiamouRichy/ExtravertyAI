// lib/project-auth.ts
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/auth-server";

export async function verifyProjectAccess(projectId: string) {
  const user = await getUser();
  if (!user) throw new Error("Non authentifié");

  // On vérifie si une ligne relie cet utilisateur à ce projet
  const membership = await prisma.projectMembership.findUnique({
    where: {
      userId_projectId: {
        userId: user.id,
        projectId: projectId,
      },
    },
  });

  if (!membership) throw new Error("Accès refusé à ce projet");

  return membership; // Retourne le rôle (OWNER, ADMIN, USER)
}
