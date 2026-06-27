const EVOLUTION_API_URL = process.env.EVOLUTION_API_URL;
const EVOLUTION_API_TOKEN = process.env.EVOLUTION_API_KEY;

export async function createEvolutionInstance(instanceName: string, number: string) {
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
