"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";

// Récupérer les projets de l'utilisateur connecté
export async function getProjects() {
  const session = await getSession();
  if (!session?.user) throw new Error("Non autorisé");
  // On récupère toutes les "adhésions" de cet utilisateur
  const memberships = await prisma.projectMembership.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      project: true, // On demande à Prisma d'inclure les infos du projet lié
    },
  });

  // memberships contient un tableau d'objets, chaque objet a une clé "project"
  // On transforme ça pour retourner juste une liste de projets propre
  return memberships.map((m) => m.project);
}
