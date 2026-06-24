"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";

// Récupérer les projets de l'utilisateur connecté
export async function getProjects() {
  const session = await getSession();
  if (!session?.user) throw new Error("Non autorisé")

  return await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  })
}

export async function createProject(data: { name: string; numero: string }) {
  // 1. Vérification de la session avec Better Auth
  const session = await getSession();
  if (!session?.user) throw new Error("Non autorisé");

  // 2. Génération de l'instanceName unique (format clean pour Evolution API)
  const uniqueId = Math.random().toString(36).substring(2, 7);
  const instanceName = `ext_${Date.now()}_${uniqueId}`;

  // 3. (Optionnel plus tard) L'appel à Evolution API viendra se greffer ici

  // 4. Insertion dans la base de données
  try {
    const project = await prisma.project.create({
      data: {
        name: data.name,
        numero: data.numero, // Le numéro fourni par l'utilisateur
        instanceName: instanceName, // L'identifiant technique autogénéré
        userId: session.user.id,
      },
    });

    // On rafraîchit la page des projets pour afficher le nouveau
    revalidatePath("/dashboard/projects");
    return { success: true, project };
  } catch (error) {
    console.error("Erreur Prisma:", error);
    return {
      success: false,
      error:
        "Erreur lors de la création du projet. Ce numéro existe peut-être déjà.",
    };
  }
}
