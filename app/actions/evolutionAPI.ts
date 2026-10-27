import "server-only";
import { randomBytes } from "node:crypto";
import {
  EVOLUTION_WEBHOOK_EVENTS,
  evolutionWebhookUrl,
} from "@/lib/contact-presence";
const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_KEY;
const WEBHOOK_SECRET = process.env.EVOLUTION_WEBHOOK_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL;

export async function createEvolutionInstance(
  instanceName: string,
  number: string,
) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN || !WEBHOOK_SECRET) {
    throw new Error(
      "Les variables d'environnement EvolutionAPI sont manquantes.",
    );
  }

  // Utilisation de NEXT_PUBLIC_APP_URL ou VERCEL_URL selon l'environnement
  if (!APP_URL) {
    throw new Error(
      "L'URL de l'application (NEXT_PUBLIC_APP_URL) est manquante pour configurer le webhook.",
    );
  }

  // Inclut le jeton de contournement Vercel quand il est configuré.
  const webhookUrl = evolutionWebhookUrl()!;
  const events = EVOLUTION_WEBHOOK_EVENTS;
  const cleanNumero = number.replace(/\D/g, "");
  const instanceToken = randomBytes(32).toString("hex");

  // 1. CRÉATION DE L'INSTANCE
  const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: EVOLUTION_API_TOKEN,
    },
    body: JSON.stringify({
      instanceName: instanceName,
      token: instanceToken,
      integration: "WHATSAPP-BAILEYS",
      qrcode: false,
      pairingCode: true,
      number: cleanNumero,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.message || "Échec de l'initialisation de l'instance WhatsApp.",
    );
  }

  const instanceData = await response.json();

  // 2. CONFIGURATION DU WEBHOOK SUR L'INSTANCE CRÉÉE
  try {
    const webhookResponse = await fetch(
      `${EVOLUTION_API_URL}/webhook/set/${instanceName}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EVOLUTION_API_TOKEN,
        },
        body: JSON.stringify({
          webhook: {
            enabled: true,
            url: webhookUrl,
            webhookByEvents: false,
            events: events,
          },
        }),
      },
    );

    if (!webhookResponse.ok) {
      console.warn(
        `[Evolution API] Attention: L'instance ${instanceName} a été créée, mais la configuration du webhook a échoué.`,
      );
      // On ne jette pas d'erreur bloquante ici, car l'instance existe,
      // mais on logue l'avertissement pour le debugging.
    }
  } catch (error) {
    console.error(
      `[Evolution API] Erreur réseau lors de la configuration du webhook pour ${instanceName}:`,
      error,
    );
  }

  // On retourne les données de l'instance pour que tu puisses l'enregistrer dans Prisma
  return instanceData;
}
export async function deleteEvolutionInstance(
  instanceName: string,
): Promise<boolean> {
  // 1. VÉRIFICATION D'ENVIRONNEMENT
  if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN) {
    throw new Error(
      "Les variables d'environnement EvolutionAPI sont manquantes.",
    );
  }

  // 2. VÉRIFICATION ET ASSAINISSEMENT DE L'ENTRÉE (Sécurité)
  if (!instanceName || typeof instanceName !== "string") {
    console.error("❌ [EvolutionAPI] Nom d'instance invalide :", instanceName);
    throw new Error("Nom d'instance invalide fourni pour la suppression.");
  }

  // Encodage strict pour éviter les failles d'injection d'URL (Path Traversal)
  const safeInstanceName = encodeURIComponent(instanceName.trim());

  // 3. RÉSILIENCE : MISE EN PLACE D'UN TIMEOUT (Startup Standard)
  // Si l'API d'Evolution bug, on ne veut pas bloquer notre serveur indéfiniment.
  const controller = new AbortController();
  // Une instance connectée est déconnectée avant d'être supprimée : 15 s max.
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/delete/${safeInstanceName}`,
      {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          apikey: EVOLUTION_API_TOKEN,
        },
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      // 4. GESTION DE L'IDEMPOTENCE (Très important pour les Rollbacks)
      // Si l'instance n'existe pas (404), on considère la suppression comme "réussie"
      // car le résultat final (l'instance n'est plus là) est atteint.
      if (response.status === 404) {
        console.warn(
          `⚠️ [EvolutionAPI] L'instance ${safeInstanceName} n'existe pas ou plus. Ignoré.`,
        );
        return true;
      }

      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.message ||
          `Échec HTTP ${response.status} lors de la suppression.`,
      );
    }

    console.log(
      `✅ [EvolutionAPI] Instance ${safeInstanceName} supprimée avec succès.`,
    );
    return true;
  } catch (error) {
    // Plus de ": any" (TypeScript le considère comme "unknown")
    clearTimeout(timeoutId);

    // VÉRIFICATION SÉCURISÉE : On s'assure que c'est bien un objet Error
    if (error instanceof Error) {
      if (error.name === "AbortError") {
        console.error(
          `🚨 [EvolutionAPI] Timeout lors de la suppression de l'instance ${safeInstanceName}`,
        );
        throw new Error("Le serveur WhatsApp ne répond pas (Timeout).");
      }

      console.error(
        `❌ [EvolutionAPI] Erreur critique lors de la suppression de ${safeInstanceName}:`,
        error.message,
      );
    } else {
      // Cas ultra-rare où ce qui a crashé n'est pas un objet Error
      console.error(
        `❌ [EvolutionAPI] Erreur inconnue lors de la suppression de ${safeInstanceName}:`,
        error,
      );
    }

    throw error;
  }
}

const getEnvVars = () => {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN) {
    throw new Error(
      "Variables d'environnement Evolution API manquantes ou mal configurées.",
    );
  }

  return { EVOLUTION_API_URL, EVOLUTION_API_TOKEN };
};

export async function getEvolutionInstanceConnect(instanceName: string) {
  const { EVOLUTION_API_URL, EVOLUTION_API_TOKEN } = getEnvVars();

  // Encodage strict
  const safeInstanceName = encodeURIComponent(instanceName.trim());

  const response = await fetch(
    `${EVOLUTION_API_URL}/instance/connect/${safeInstanceName}`,
    {
      method: "GET",
      headers: {
        apikey: EVOLUTION_API_TOKEN,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Erreur réseau (${response.status}) lors de la récupération du statut pour ${safeInstanceName}`,
    );
  }

  return response.json();
}

/** État seul (« open », « connecting », « close »), sans relancer de connexion. */
export async function getEvolutionConnectionState(instanceName: string) {
  const { EVOLUTION_API_URL, EVOLUTION_API_TOKEN } = getEnvVars();
  const response = await fetch(
    `${EVOLUTION_API_URL}/instance/connectionState/${encodeURIComponent(instanceName.trim())}`,
    {
      headers: { apikey: EVOLUTION_API_TOKEN },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    },
  );
  if (!response.ok) throw new Error(`Erreur réseau (${response.status})`);
  const data = await response.json();
  return typeof data?.instance?.state === "string"
    ? data.instance.state.toLowerCase()
    : null;
}

/** Ferme une session en attente (QR affiché) avant une liaison par code. */
export async function logoutEvolutionInstance(instanceName: string) {
  const { EVOLUTION_API_URL, EVOLUTION_API_TOKEN } = getEnvVars();
  const response = await fetch(
    `${EVOLUTION_API_URL}/instance/logout/${encodeURIComponent(instanceName.trim())}`,
    {
      method: "DELETE",
      headers: { apikey: EVOLUTION_API_TOKEN },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    },
  );
  // 400 : déjà fermée, ce qui convient.
  if (!response.ok && response.status !== 400)
    throw new Error(`Erreur réseau (${response.status})`);
}

export async function requestEvolutionPairingCode(
  instanceName: string,
  phoneNumber: string,
): Promise<Record<string, unknown>> {
  const { EVOLUTION_API_URL, EVOLUTION_API_TOKEN } = getEnvVars();
  const safeInstanceName = encodeURIComponent(instanceName.trim());

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `${EVOLUTION_API_URL}/instance/connect/${safeInstanceName}?number=${encodeURIComponent(phoneNumber)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          apikey: EVOLUTION_API_TOKEN,
        },
        cache: "no-store",
        signal: controller.signal,
      },
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const apiMessage =
        typeof errorData.message === "string"
          ? errorData.message
          : "Échec de la récupération du code de couplage.";
      throw new Error(apiMessage);
    }

    const data = await response.json();

    // Le code de liaison peut arriver sans QR code : seule la forme compte ici.
    if (!data || typeof data !== "object") {
      throw new Error(
        "La structure de la réponse de l'API Evolution est invalide.",
      );
    }

    return data;
  } catch (error: unknown) {
    clearTimeout(timeoutId);

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new Error(
          "Le serveur WhatsApp met trop de temps à répondre (Timeout).",
        );
      }
      throw new Error(`[EvolutionAPI] ${error.message}`);
    }

    throw new Error("Erreur critique inconnue lors du couplage.");
  }
}
