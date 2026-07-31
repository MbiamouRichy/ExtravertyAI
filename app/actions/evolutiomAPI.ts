const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_KEY;

export async function createEvolutionInstance(
  instanceName: string,
  number: string,
) {
  if (!EVOLUTION_API_URL || !EVOLUTION_API_TOKEN) {
    throw new Error(
      "Les variables d'environnement EvolutionAPI sont manquantes.",
    );
  }
  const cleanNumero = number.replace(/\D/g, "");

  const response = await fetch(`${EVOLUTION_API_URL}/instance/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: EVOLUTION_API_TOKEN,
    },
    body: JSON.stringify({
      instanceName: instanceName,
      token: `token-${instanceName}`, // Sécurise cela selon ta logique
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

  return response.json();
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
  const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 secondes max

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
