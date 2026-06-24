// app/api/whatsapp/send/route.ts
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // 1. Récupérer les données envoyées par le client (votre site web)
    const { phone, message } = await request.json();

    if (!phone || !message) {
      return NextResponse.json(
        { error: "Le numéro et le message sont requis" },
        { status: 400 },
      );
    }

    // 2. Préparer l'URL d'EvolutionAPI
    const apiUrl = `${process.env.EVOLUTION_API_URL}/message/sendText/${process.env.EVOLUTION_INSTANCE_NAME}`;

    // 3. Faire la requête vers EvolutionAPI
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: process.env.EVOLUTION_API_KEY as string,
      },
      body: JSON.stringify({
        number: phone,
        options: {
          delay: 1200, // Petit délai pour simuler une frappe humaine (optionnel)
          presence: "composing", // Affiche "en train d'écrire..."
        },
        textMessage: {
          text: message,
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Erreur API Evolution");
    }

    // 4. Retourner le succès au client
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Erreur d'envoi WhatsApp:", error);
    return NextResponse.json(
      { success: false, error: "Impossible d'envoyer le message" },
      { status: 500 },
    );
  }
}
