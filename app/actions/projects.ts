"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { createEvolutionInstance } from "./evolutiomAPI";

// Récupérer les projets de l'utilisateur connecté
export async function getProjects() {
  const session = await getSession();
  if (!session?.user) throw new Error("Non autorisé");

  return await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
}

// Fonction de validation et nettoyage du numéro de téléphone
function validateAndCleanNumero(numero: string): string {
  // Supprime les espaces, tirets, parenthèses
  const cleaned = numero.replace(/[\s()\-]/g, "");

  // Expression régulière pour le format international (ex: +24106xxxxxx ou 24107xxxxxx)
  const phoneRegex = /^\+?[1-9]\d{6,14}$/;

  if (!phoneRegex.test(cleaned)) {
    throw new Error(
      "Format invalide. Utilisez le format international (ex: +24166000000).",
    );
  }

  // S'assurer que le numéro commence par un '+' pour l'uniformisation en base
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

export async function createProject(data: { nom: string; numero: string }) {
  // 1. Vérification de la session avec Better Auth
  const session = await getSession();
  if (!session?.user) throw new Error("Non autorisé");

  const cleanedNumero = validateAndCleanNumero(data.numero);

  // Vérifier l'unicité du numéro pour cet utilisateur
  const existingProject = await prisma.project.findFirst({
    where: { numero: cleanedNumero, userId: session.user.id },
  });
  if (existingProject) {
    throw new Error(
      "Ce numéro WhatsApp est déjà configuré sur un autre projet.",
    );
  }

  // 2. Génération de l'instanceName unique (format clean pour Evolution API)
  const uniqueId = Math.random().toString(36).substring(2, 7);
  const instanceName = `ext_${Date.now()}_${uniqueId}`;

  // 3. Création de l'instance côté EvolutionAPI
     await createEvolutionInstance(instanceName, cleanedNumero)
  // 4. Insertion dans la base de données
  try {
    const project = await prisma.project.create({
      data: {
        name: data.nom, // Le nom fourni par l'utilisateur
        numero: cleanedNumero, // Le numéro nettoyé
        instanceName: instanceName, // L'identifiant technique autogénéré
        instanceStatus: "connecting", // Statut initial
        status: "active", // Statut du projet
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
