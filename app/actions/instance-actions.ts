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

    if (!project.numero) {
      throw new Error(
        "Aucun numéro de téléphone n'est configuré pour ce projet.",
      );
    }

    // 1. Nettoyage strict (Anti-injection & Formatage)
    // Ne garder que les chiffres. Evolution API nécessite le format international sans le '+'.
    const sanitizedNumber = project.numero.replace(/\D/g, "");

    // Vérification de base de la longueur
    if (sanitizedNumber.length < 8 || sanitizedNumber.length > 15) {
      throw new Error("Le format du numéro de téléphone est invalide.");
    }

    // 2. Vérification de l'état de l'instance (Crucial !)
    // Si l'instance est déjà connectée, on refuse.
    if (project.instanceStatus === InstanceStatus.connected) {
      throw new Error(
        "L'instance est déjà connectée. Veuillez la déconnecter d'abord.",
      );
    }

    // 3. Appel à l'API Evolution (Assure-toi que requestEvolutionPairingCode appelle bien le bon endpoint)
    // L'endpoint Evolution DOIT être : POST /instance/connect/{instanceName}
    // Avec dans le body : { number: sanitizedNumber }
    const data = await requestEvolutionPairingCode(
      project.instanceName,
      sanitizedNumber,
    );

    // 4. Sécurité de retour & Parsing Strict
    // Le vrai pairing code fourni par Evolution API se trouve SOIT dans data.pairingCode, SOIT dans data.code.
    // MAIS, un vrai code de pairing fait toujours 8 caractères (ex: "X1Y2-Z3W4" ou "X1Y2Z3W4").
    // Si la chaîne dépasse 10 caractères, c'est une fuite de token, pas un pairing code !

    let finalPairingCode = null;

    if (
      typeof data?.pairingCode === "string" &&
      data.pairingCode.length <= 10
    ) {
      finalPairingCode = data.pairingCode;
    } else if (typeof data?.code === "string" && data.code.length <= 10) {
      finalPairingCode = data.code;
    }

    if (!finalPairingCode) {
      console.error(
        "[SECURITY LOG] L'API Evolution a renvoyé des données inattendues ou un token au lieu d'un Pairing Code:",
        data,
      );
      throw new Error(
        "Impossible de générer le code de liaison. Veuillez vérifier le format du numéro de téléphone et réessayer.",
      );
    }

    return {
      success: true,
      pairingCode: finalPairingCode, // Ne retourne que le code propre à 8 caractères
    };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Une erreur inattendue est survenue.";
    console.error("[generatePairingCode] Erreur:", errorMessage);

    return {
      success: false,
      error: errorMessage,
    };
  }
}
