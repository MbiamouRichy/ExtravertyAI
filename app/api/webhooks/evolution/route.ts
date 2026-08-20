import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { InstanceStatus } from "@/src/generated/prisma/client";
import { processWhatsAppMessage } from "@/lib/quotaMessage";

// Typage pour l'historique envoyé à l'IA
interface ChatMessage {
  role: string;
  content: string;
}

// Typage flexible mais strict pour le Webhook Evolution API
interface EvolutionMessagePayload {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  messages?: Array<any>;
  key?: {
    remoteJid: string;
    fromMe: boolean;
    id?: string;
  };
  message?: {
    conversation?: string;
    extendedTextMessage?: {
      text?: string;
    };
  };
  pushName?: string;
  messageType?: string;
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

    switch (event.toLocaleLowerCase()) {
      case "connection.update": {
        const stateData = data as { state?: string };
        const state = stateData?.state;
        let dbStatus: InstanceStatus = "disconnected" as InstanceStatus;

        if (state === "open") {
          dbStatus = "connected" as InstanceStatus;
        } else if (state === "connecting") {
          dbStatus = "connecting" as InstanceStatus;
        }

        // CORRECTION : Ajout du await et d'un try/catch local
        try {
          await prisma.project.update({
            where: { instanceName: instance },
            data: { instanceStatus: dbStatus },
          });
          console.log(
            `[Webhook] 🔄 Statut de l'instance ${instance} : ${dbStatus}`,
          );
        } catch (err) {
          console.error(`[DB Error] Update status ${instance}:`, err);
        }
        break;
      }

      case "messages.upsert": {
        // CORRECTION : Ajout du await pour garantir l'exécution de Prisma et de l'IA
        try {
          await processIncomingMessages(instance, data);
        } catch (err) {
          console.error(
            `[Webhook] Erreur lors du traitement du message :`,
            err,
          );
        }
        break;
      }

      case "messages.update": {
        // CORRECTION : Ajout du await
        try {
          await processMessageStatusUpdate(data);
        } catch (err) {
          console.error(
            `[Webhook] Erreur lors de la mise à jour du statut du message :`,
            err,
          );
        }
        break;
      }

      default:
        console.log(`[Webhook] ℹ️ Événement ignoré : ${event}`);
    }

    // La réponse n'est envoyée qu'UNE FOIS la base de données mise à jour
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Webhook] 🚨 Erreur critique :", error);
    return NextResponse.json({ error: "Erreur interne" }, { status: 500 });
  }
}

// ------------------------------------------------------------------
// FONCTIONS MÉTIER
// ------------------------------------------------------------------

async function processIncomingMessages(instanceName: string, rawData: unknown) {
  console.log(`\n======================================================`);
  console.log(
    `[DEBUG 1] 📥 Nouveau webhook reçu pour l'instance : ${instanceName}`,
  );

  const data = rawData as EvolutionMessagePayload;
  const msg = data?.messages ? data.messages[0] : data;

  if (!msg) {
    console.log(`[DEBUG 2] 🛑 Aucun objet message trouvé. Abandon.`);
    return;
  }

  if (msg.key?.remoteJid === "status@broadcast") {
    console.log(`[DEBUG 2] 🛑 Message de statut WhatsApp ignoré.`);
    return;
  }

  const isFromMe = msg.key?.fromMe || false;
  console.log(`[DEBUG 3] 👤 isFromMe = ${isFromMe}`);

  const textContent =
    msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
  if (!textContent.trim()) {
    console.log(
      `[DEBUG 4] 🛑 Le message est vide ou c'est un média (Image/Audio). Abandon.`,
    );
    // Affiche le contenu brut pour voir la vraie structure envoyée par Evolution API
    console.log(JSON.stringify(msg.message, null, 2));
    return;
  }

  console.log(`[DEBUG 5] 💬 Texte extrait : "${textContent}"`);

  const remoteJid = msg.key.remoteJid;
  const phoneOnly = remoteJid.split("@")[0];
  const prospectName = msg.pushName || "Client";
  const evolutionId = msg.key.id;

  try {
    const project = await prisma.project.findUnique({
      where: { instanceName: instanceName },
    });

    if (!project) {
      console.log(
        `[DEBUG 6] ❌ Projet introuvable en DB pour l'instance "${instanceName}". Abandon.`,
      );
      return;
    }

    console.log(
      `[DEBUG 7] ✅ Projet trouvé : ${project.name} (Statut: ${project.status})`,
    );

    // 4. CRM : UPSERT DU CONTACT
    console.log(`[DEBUG 8] 🔄 Sauvegarde du contact en cours...`);
    const contact = await prisma.contact.upsert({
      where: {
        projectId_remoteJid: { projectId: project.id, remoteJid: remoteJid },
      },
      update: { pushName: prospectName, updatedAt: new Date() },
      create: {
        phone: phoneOnly,
        remoteJid: remoteJid,
        pushName: prospectName,
        projectId: project.id,
        aiActive: true,
      },
    });

    // 5. CRM : ENREGISTRER LE MESSAGE
    console.log(`[DEBUG 9] 💾 Sauvegarde du message en cours...`);
    await prisma.message.create({
      data: {
        evolutionId: evolutionId,
        content: textContent,
        fromMe: isFromMe,
        type: "TEXT",
        senderType: isFromMe ? "AGENT" : "CLIENT",
        status: isFromMe ? "SENT" : "DELIVERED",
        contactId: contact.id,
        projectId: project.id,
      },
    });

    console.log(
      `[DEBUG 10] 🎉 Contact et Message sauvegardés avec succès en DB !`,
    );

    // ==========================================
    // 🛑 LES BARRIÈRES AVANT D'APPELER L'IA 🛑
    // ==========================================

    if (isFromMe) {
      console.log(
        `[DEBUG 11] 🛑 Message fromMe détecté (Tu as écrit). Fin du script, l'IA ne répondra pas.`,
      );
      return;
    }

    if (project.status === "paused" || project.status === "inactive") {
      console.log(
        `[DEBUG 12] 🛑 Le projet est en statut "${project.status}". L'IA est bloquée.`,
      );
      return;
    }

    const quotaCheck = await processWhatsAppMessage(project.id);
    if (!quotaCheck.canSendMessage) {
      console.log(`[DEBUG 13] ⚠️ Quota atteint pour ce projet.`);
      return;
    }

    if (!contact.aiActive) {
      console.log(
        `[DEBUG 14] ⏸️ Handover actif (L'agent a pris le relais). IA bloquée.`,
      );
      return;
    }

    // ==========================================
    // 🟢 APPEL À L'IA 🟢
    // ==========================================
    console.log(
      `[DEBUG 15] 🧠 Préparation de l'historique et appel à Gemini...`,
    );

    const rawHistory = await prisma.message.findMany({
      where: { contactId: contact.id, projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    });

    const chatHistory = rawHistory.reverse().map((m) => ({
      role: m.fromMe ? "assistant" : "user",
      content: m.content,
    }));

    const aiResponseText = await generateAiResponse(chatHistory, prospectName);

    const evolutionResponse = await sendWhatsAppMessage(
      instanceName,
      remoteJid,
      aiResponseText,
    );

    const sentMessageId = evolutionResponse?.key?.id || null;

    await prisma.message.create({
      data: {
        evolutionId: sentMessageId,
        content: aiResponseText,
        fromMe: true,
        type: "TEXT",
        senderType: "BOT",
        status: "SENT",
        contactId: contact.id,
        projectId: project.id,
      },
    });

    console.log(`[DEBUG 16] ✅ Réponse IA générée et stockée !`);
    console.log(`======================================================\n`);
  } catch (error) {
    console.error(`\n[ERREUR CRITIQUE] 🚨 L'exécution a planté :`, error);
  }
}

// 🚀 NOUVEAU : Gestion des statuts de messages
async function processMessageStatusUpdate(data: unknown) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updates = Array.isArray(data) ? data : ([data] as any[]);

  for (const item of updates) {
    const messageId = item?.key?.id;
    const statusRaw = item?.update?.status; // 3 = DELIVERED, 4 = READ

    if (!messageId || statusRaw === undefined) continue;

    let newStatus = null;
    if (statusRaw === 3 || statusRaw === "DELIVERY_ACK") {
      newStatus = "DELIVERED";
    } else if (statusRaw === 4 || statusRaw === "READ") {
      newStatus = "READ";
    }

    if (newStatus) {
      try {
        await prisma.message.update({
          where: { evolutionId: messageId },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data: { status: newStatus as any },
        });
      } catch (error: unknown) {
        // Ignorer silencieusement l'erreur P2025 (Message non trouvé en base)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((error as any).code !== "P2025") {
          console.error(`[CRM] 🚨 Erreur maj statut :`, error);
        }
      }
    }
  }
}

async function generateAiResponse(
  chatHistory: ChatMessage[],
  userName: string,
): Promise<string> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) throw new Error("Clé OPENROUTER_API_KEY manquante");

  const systemPrompt = `Tu es l'assistant virtuel de l'entreprise ExtravertyAI. Ton but est d'accueillir les prospects. Le client s'appelle ${userName}. Réponds toujours de manière courtoise, très brève (1 à 2 phrases max) et idéale pour une conversation WhatsApp.`;

  const messagesForAI = [
    { role: "system", content: systemPrompt },
    ...chatHistory, // Injection de l'historique
  ];

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "",
        "X-Title": "ExtravertyAI",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: messagesForAI,
        temperature: 0.7,
        max_tokens: 150,
      }),
    },
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Erreur OpenRouter: ${err}`);
  }

  const result = await response.json();
  return result.choices[0].message.content;
}

async function sendWhatsAppMessage(
  instanceName: string,
  remoteJid: string,
  text: string,
) {
  // 1. On nettoie l'URL pour éviter les erreurs de double slash (ex: http://url//message)
  const evolutionUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, "");
  const evolutionApiKey = process.env.EVOLUTION_API_KEY;

  if (!evolutionUrl || !evolutionApiKey) {
    throw new Error("Variables Evolution API manquantes");
  }

  const endpoint = `${evolutionUrl}/message/sendText/${instanceName}`;

  // 2. Extraire le numéro pur (Evolution API préfère souvent le numéro sans @s.whatsapp.net)
  const phoneOnly = remoteJid.includes("@")
    ? remoteJid.split("@")[0]
    : remoteJid;

  console.log(`\n[EVOLUTION API] 🚀 Tentative d'envoi à: ${phoneOnly}`);
  console.log(`[EVOLUTION API] 🔗 URL ciblée: ${endpoint}`);
  console.log(`[EVOLUTION API] 💬 Contenu: "${text}"`);

  // 3. Payload "Universel" (Compatible Evolution V1 et V2)
  const payload = {
    number: phoneOnly,
    // Format attendu par Evolution V2
    text: text,
    linkPreview: true,
    // Format attendu par Evolution V1 (pour rétrocompatibilité)
    textMessage: {
      text: text,
    },
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: evolutionApiKey,
    },
    body: JSON.stringify(payload),
  });

  // 4. Lecture brute de la réponse pour le diagnostic
  const responseText = await response.text();
  console.log(`[EVOLUTION API] 📥 Statut HTTP: ${response.status}`);
  console.log(`[EVOLUTION API] 📥 Réponse brute:`, responseText);

  if (!response.ok) {
    throw new Error(
      `Erreur HTTP ${response.status} depuis Evolution: ${responseText}`,
    );
  }

  // Si tout va bien, on parse en JSON
  return responseText ? JSON.parse(responseText) : {};
}
