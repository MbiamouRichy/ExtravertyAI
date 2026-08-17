"use server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { InstanceStatus } from "@/src/generated/prisma/client";
import {
  getEvolutionInstanceConnect,
  requestEvolutionPairingCode,
} from "./evolutionAPI";

/**
 * Vérif./evolutionAPInce du projet à l'utilisateur authentifié (Sécurité)
 */
async function verifyProjectOwnership(projectId: string) {
  if (!projectId) throw new Error("ID de projet manquant.");

  const session = await getSession();
  if (!session?.user?.id) {
    throw new Error("Non autorisé. Veuillez vous connecter.");
  }

  const membership = await prisma.projectMembership.findUnique({
    where: {
      userId_projectId: {
        userId: session.user.id,
        projectId: projectId,
      },
    },
    include: { project: true },
  });

  if (!membership) {
    throw new Error("Projet introuvable ou accès refusé.");
  }

  return membership.project;
}

/**
 * Récupère l'état actuel de la connexion et le QR Code (Polling)
 */
export async function getConnectionData(projectId: string) {
  try {
    const project = await verifyProjectOwnership(projectId);

    if (project.instanceStatus === InstanceStatus.connected) {
      return { status: InstanceStatus.connected, qrCodeBase64: null };
    }

    const data = await getEvolutionInstanceConnect(project.instanceName);
    const rawState = data?.instance?.state?.toLowerCase();

    let currentStatus: InstanceStatus = project.instanceStatus;

    if (rawState === "open") {
      currentStatus = InstanceStatus.connected;
    } else if (rawState === "close") {
      currentStatus = InstanceStatus.disconnected;
    } else if (data?.base64) {
      currentStatus = InstanceStatus.qr_ready;
    }

    return {
      status: currentStatus,
      qrCodeBase64: data?.base64 || null,
    };
  } catch (error: unknown) {
    // Remplacement strict de "any" par "unknown" + vérification de type
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Impossible de joindre le serveur d'authentification.";
    console.error("[getConnectionData] Erreur de sécurité/API:", errorMessage);

    return {
      status: "error",
      error: errorMessage,
      qrCodeBase64: null,
    };
  }
}

/**
 * Action : Générer un Pairing Code via le numéro de téléphone stocké en base de données
 */
export async function generatePairingCode(projectId: string) {
  try {
    const project = await verifyProjectOwnership(projectId);

    // Utilisation de project.numero au lieu de project.phoneNumber
    if (!project.numero) {
      throw new Error(
        "Aucun numéro de téléphone n'est configuré pour ce projet. Veuillez l'ajouter dans les paramètres.",
      );
    }

    // Nettoyage strict (Anti-injection)
    const sanitizedNumber = project.numero.replace(/\D/g, "");
    if (sanitizedNumber.length < 8 || sanitizedNumber.length > 15) {
      throw new Error(
        "Le format du numéro de téléphone configuré pour ce projet est invalide.",
      );
    }

    const data = await requestEvolutionPairingCode(
      project.instanceName,
      sanitizedNumber,
    );

    if (!data?.code) {
      throw new Error(
        "L'infrastructure n'a pas pu générer le code de couplage.",
      );
    }
    console.log("data", data);
    return {
      success: true,
      pairingCode: data.code,
    };
  } catch (error: unknown) {
    // Remplacement strict de "any" par "unknown" + vérification de type
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Une erreur inattendue est survenue lors de la génération du code.";
    console.error("[generatePairingCode] Erreur:", errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}
