import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { InstanceStatus } from "@/src/generated/prisma/client";

// Typage pour nettoyer le payload entrant d'Evolution API
interface WhatsAppMessagePayload {
  instance: string;
  data: {
    messages?: Array<{
      key: {
        remoteJid: string; // ex: 24176205629@s.whatsapp.net
        fromMe: boolean;
        id: string;
      };
      pushName?: string;
      message?: {
        conversation?: string; // Message texte simple
        extendedTextMessage?: {
          text?: string; // Message avec lien ou réponse à un autre message
        };
      };
      messageType?: string;
    }>;
  };
}

const WebhookBodySchema = z.object({
  event: z.string({ message: "Le type d'événement est requis" }).min(1),
  instance: z.string({ message: "Le nom de l'instance est requis" }).min(1),
  data: z.unknown().optional(),
  destination: z.string().optional(),
  date_time: z.string().optional(),
  sender: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret");

    if (!secret || secret !== process.env.EVOLUTION_WEBHOOK_SECRET) {
      console.warn("[Sécurité] Tentative d'accès non autorisée au webhook.");
      return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
    }

    const rawBody = await req.json().catch(() => ({}));
    const parsedBody = WebhookBodySchema.safeParse(rawBody);

    if (!parsedBody.success) {
      console.error("[Webhook] Payload malformé :", parsedBody.error.format());
      return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
    }

    const { event, instance, data } = parsedBody.data;

    switch (event) {
      case "connection.update": {
        // Typage sécurisé de data en tant qu'objet contenant potentiellement 'state'
        const stateData = data as { state?: string };
        const state = stateData?.state;

        // UTILISATION DE L'ENUM PRISMA OU DU CASTING STRICT
        let dbStatus: InstanceStatus = "disconnected" as InstanceStatus;

        if (state === "open") {
          dbStatus = "connected" as InstanceStatus;
        } else if (state === "connecting") {
          dbStatus = "connecting" as InstanceStatus;
        }

        prisma.project
          .update({
            where: { instanceName: instance },
            data: { instanceStatus: dbStatus },
          })
          .catch((err) =>
            console.error(`[DB Error] Update status ${instance}:`, err),
          );

        console.log(
          `[Webhook] 🔄 Statut de l'instance ${instance} : ${dbStatus}`,
        );
        break;
      }

      case "messages.upsert": {
        processIncomingMessages(instance, data).catch((err) => {
          console.error(
            `[Webhook] Erreur lors du traitement du message :`,
            err,
          );
        });
        break;
      }

      default:
        console.log(`[Webhook] ℹ️ Événement ignoré : ${event}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Webhook] 🚨 Erreur critique :", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

async function processIncomingMessages(instanceName: string, rawData: unknown) {
  // 1. Cast sécurisé des données
  const payload = rawData as WhatsAppMessagePayload["data"];
  const messages = payload?.messages;

  if (!messages || messages.length === 0) return;

  const msg = messages[0];

  // On ignore les messages qu'on envoie nous-mêmes et les status (stories)
  if (msg.key.fromMe || msg.key.remoteJid === "status@broadcast") return;

  // 2. Extraction sécurisée du texte
  // WhatsApp Baileys met le texte dans 'conversation' ou 'extendedTextMessage.text'
  const textContent =
    msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

  if (!textContent.trim()) {
    console.log(
      "[Webhook] Message non textuel (image, vocal) ignoré pour l'instant.",
    );
    return;
  }

  const senderNumber = msg.key.remoteJid;
  const prospectName = msg.pushName || "Client";

  console.log(
    `[Agent IA] Message reçu de ${prospectName} (${senderNumber}): ${textContent}`,
  );

  try {
    // 3. ENREGISTREMENT EN BASE DE DONNÉES (Optionnel pour l'instant, mais recommandé)
    // await prisma.message.create({ ... })

    // 4. APPEL À OPENROUTER (Génération de la réponse)
    const aiResponseText = await generateAiResponse(textContent, prospectName);

    // 5. ENVOI DE LA RÉPONSE VIA EVOLUTION API
    await sendWhatsAppMessage(instanceName, senderNumber, aiResponseText);

    console.log(`[Agent IA] Réponse envoyée avec succès à ${senderNumber}`);
  } catch (error) {
    console.error("[Agent IA] Erreur dans le flux de traitement :", error);
  }
}

async function generateAiResponse(
  userMessage: string,
  userName: string,
): Promise<string> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;

  if (!openRouterKey) throw new Error("Clé OPENROUTER_API_KEY manquante");

  // Prompt Système : À personnaliser plus tard depuis ton interface UI
  const systemPrompt = `Tu es l'assistant virtuel IA de l'entreprise ExtravertyAI. Ton but est de qualifier les prospects et de répondre de manière courtoise, concise et professionnelle. Le client avec qui tu parles s'appelle ${userName}. Réponds toujours de manière brève, idéale pour une conversation WhatsApp.`;

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        // Optionnel : Recommandé par OpenRouter pour les stats
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "",
        "X-Title": "ExtravertyAI",
      },
      body: JSON.stringify({
        // Tu peux choisir le modèle que tu veux (ex: meta-llama/llama-3-8b-instruct, openai/gpt-4o-mini, etc.)
        model: "meta-llama/llama-3-8b-instruct:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        temperature: 0.7,
        max_tokens: 150,
      }),
    },
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erreur OpenRouter: ${err}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function sendWhatsAppMessage(
  instanceName: string,
  remoteJid: string,
  text: string,
) {
  const evolutionUrl = process.env.EVOLUTION_API_URL;
  const evolutionApiKey = process.env.EVOLUTION_API_KEY;

  if (!evolutionUrl || !evolutionApiKey)
    throw new Error("Variables Evolution API manquantes");

  // La route Evolution API pour envoyer un simple texte
  const endpoint = `${evolutionUrl}/message/sendText/${instanceName}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: evolutionApiKey,
    },
    body: JSON.stringify({
      number: remoteJid,
      text: text,
      delay: 2000, // Petit délai artificiel (2 sec) pour faire "plus humain"
      linkPreview: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erreur Envoi Evolution: ${err}`);
  }

  return response.json();
}
