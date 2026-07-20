"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { createEvolutionInstance } from "./evolutiomAPI";

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
  // 1. SÉCURITÉ : Vérification stricte de la session
  const session = await getSession();
  if (!session?.user?.id) throw new Error("Non autorisé");

  const cleanedNumero = validateAndCleanNumero(data.numero);

  // 2. ISOLATION DES DONNÉES : Vérification de l'unicité via la table de liaison
  // On s'assure que cet utilisateur ne possède pas déjà ce numéro dans SES projets
  const existingProject = await prisma.project.findFirst({
    where: {
      numero: cleanedNumero,
      members: {
        some: { userId: session.user.id },
      },
    },
  });

  if (existingProject) {
    throw new Error(
      "Ce numéro WhatsApp est déjà configuré sur l'un de vos projets.",
    );
  }

  // 3. INFRASTRUCTURE : Génération de l'ID unique
  const uniqueId = Math.random().toString(36).substring(2, 7);
  const instanceName = `ext_${Date.now()}_${uniqueId}`;

  // 4. PROVISIONING (API Externe)
  // On tente d'abord de créer l'instance. Si ça échoue, on ne pollue pas la base de données.
  try {
    await createEvolutionInstance(instanceName, cleanedNumero);
  } catch (apiError) {
    console.error("❌ Erreur EvolutionAPI lors du provisioning :", apiError);
    throw new Error(
      "Échec de la communication avec le serveur WhatsApp. Veuillez réessayer.",
    );
  }

  // 5. TRANSACTION BASE DE DONNÉES (Écriture imbriquée Multi-Tenant)
  try {
    const project = await prisma.project.create({
      data: {
        name: data.nom,
        numero: cleanedNumero,
        instanceName: instanceName,
        instanceStatus: "connecting",

        // Statut initial configuré sur la phase de test client obligatoire
        status: "testing",

        // Création atomique : on lie immédiatement l'utilisateur comme OWNER
        members: {
          create: {
            userId: session.user.id,
            role: "OWNER",
          },
        },
      },
    });

    // 6. INVALIDATION DU CACHE : Mise à jour de l'UI instantanée
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/projects"); // Selon la structure exacte de vos routes

    return { success: true, project };
  } catch (error) {
    console.error("❌ Erreur Prisma lors de la création du projet :", error);

    // Note de sécurité : Idéalement, si la DB échoue ici, il faudrait déclencher
    // une fonction de rollback (ex: deleteEvolutionInstance(instanceName))
    // pour éviter les instances "fantômes" sur votre serveur EvolutionAPI.

    return {
      success: false,
      error: "Erreur critique lors de l'enregistrement du projet.",
    };
  }
}
