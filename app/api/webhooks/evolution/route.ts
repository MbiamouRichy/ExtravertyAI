import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { InstanceStatus } from "@/src/generated/prisma/client";
import { processWhatsAppMessage } from "@/lib/quotaMessage";
import { revalidatePath } from "next/cache";
import { notifyChatChanged } from "@/lib/chat-realtime";

// ------------------------------------------------------------------
// TYPAGES & SCHEMAS
// ------------------------------------------------------------------

interface ChatMessage {
  role: string;
  content: string;
}

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

// ------------------------------------------------------------------
// ROUTE PRINCIPALE (WEBHOOK)
// ------------------------------------------------------------------

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

        if (state === "open") dbStatus = "connected" as InstanceStatus;
        else if (state === "connecting")
          dbStatus = "connecting" as InstanceStatus;

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
        try {
          await processMessageStatusUpdate(instance, data);
        } catch (err) {
          console.error(`[Webhook] Erreur update statut :`, err);
        }
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

// ------------------------------------------------------------------
// FONCTIONS MÉTIER
// ------------------------------------------------------------------

async function processIncomingMessages(instanceName: string, rawData: unknown) {
  console.log(`\n======================================================`);
  console.log(`[DEBUG 1] 📥 Webhook reçu pour l'instance : ${instanceName}`);

  const data = rawData as EvolutionMessagePayload;
  const msg = data?.messages ? data.messages[0] : data;

  if (!msg) return;

  const remoteJid = msg.key?.remoteJid || "";

  // 🛡️ SÉCURITÉ : Ignorer les statuts et les messages de groupes
  if (remoteJid === "status@broadcast" || remoteJid.includes("@g.us")) {
    console.log(`[DEBUG 2] 🛑 Statut ou message de groupe ignoré.`);
    return;
  }

  const isFromMe = msg.key?.fromMe || false;
  const textContent =
    msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";

  if (!textContent.trim()) {
    console.log(`[DEBUG 3] 🛑 Message vide ou média sans texte. Abandon.`);
    return;
  }

  console.log(
    `[DEBUG 4] 💬 Message : "${textContent}" (isFromMe: ${isFromMe})`,
  );

  const phoneOnly = remoteJid.split("@")[0];
  const prospectName = msg.pushName || "Client";
  const evolutionId = msg.key?.id;

  try {
    const project = await prisma.project.findUnique({
      where: { instanceName: instanceName },
    });

    if (!project) {
      console.log(`[DEBUG 5] ❌ Projet introuvable pour "${instanceName}".`);
      return;
    }

    // 1. UPSERT CONTACT
    const contact = await prisma.contact.upsert({
      where: {
        projectId_remoteJid: { projectId: project.id, remoteJid: remoteJid },
      },
      update: { pushName: prospectName, updatedAt: new Date() },
      create: {
        phone: phoneOnly,
        remoteJid: remoteJid, // On stocke bien le JID complet !
        pushName: prospectName,
        projectId: project.id,
        aiActive: true,
      },
    });

    // 2. SAVE INCOMING MESSAGE
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
    await notifyChatChanged(project.id);

    console.log(`[DEBUG 6] 💾 Message stocké en DB.`);

    // ==========================================
    // 🛑 BARRIÈRES IA
    // ==========================================

    if (isFromMe) {
      console.log(
        `[DEBUG 7] 🛑 Agent a répondu manuellement (fromMe). IA bloquée.`,
      );
      return;
    }

    if (project.status === "paused" || project.status === "inactive") {
      console.log(`[DEBUG 8] 🛑 Projet inactif/pause. IA bloquée.`);
      return;
    }

    const quotaCheck = await processWhatsAppMessage(project.id);
    if (!quotaCheck.canSendMessage) {
      console.log(`[DEBUG 9] ⚠️ Quota atteint.`);
      return;
    }

    if (!contact.aiActive) {
      console.log(`[DEBUG 10] ⏸️ Handover actif. IA bloquée.`);
      return;
    }

    // ==========================================
    // 🟢 GÉNÉRATION & ENVOI IA
    // ==========================================
    console.log(`[DEBUG 11] 🧠 Appel de Gemini en cours...`);

    const rawHistory = await prisma.message.findMany({
      where: { contactId: contact.id, projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: 20, // 20 messages suffisent largement pour le contexte
    });

    const chatHistory = rawHistory.reverse().map((m) => ({
      role: m.fromMe ? "assistant" : "user",
      content: m.content,
    }));

    const aiResponseText = await generateAiResponse(chatHistory, prospectName);
    console.log(`[DEBUG 12] 📝 Réponse générée : "${aiResponseText}"`);

    // 🔥 C'EST ICI QUE ÇA PLANTAIT SOUVENT : ON ENVOIE LE JID COMPLET
    const evolutionResponse = await sendWhatsAppMessage(
      instanceName,
      remoteJid,
      aiResponseText,
    );

    const sentMessageId =
      evolutionResponse?.key?.id || evolutionResponse?.messageId || null;

    // 3. SAVE OUTGOING MESSAGE
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

    console.log(`[DEBUG 13] ✅ Réponse envoyée et stockée !`);
    console.log(`======================================================\n`);
    revalidatePath(`/projects/${project.id}`);
  } catch (error) {
    console.error(`\n[ERREUR CRITIQUE] 🚨 L'exécution a planté :`, error);
  }
}

// ------------------------------------------------------------------
// OUTILS
// ------------------------------------------------------------------

const StatusUpdateSchema = z.object({
  key: z.object({
    id: z.string().min(1).max(250),
  }),
  update: z.object({
    status: z.union([z.number(), z.string()]),
  }),
});

async function processMessageStatusUpdate(instanceName: string, data: unknown) {
  const project = await prisma.project.findUnique({
    where: { instanceName },
    select: { id: true },
  });

  if (!project) return;

  const updates = Array.isArray(data) ? data : [data];
  let changed = false;

  for (const raw of updates) {
    const parsed = StatusUpdateSchema.safeParse(raw);
    if (!parsed.success) continue;

    const { key, update } = parsed.data;

    // Mapping conservé depuis TON payload actuel.
    // À vérifier sur des payloads réels de ta version Evolution.
    if (update.status === 4 || update.status === "READ") {
      const result = await prisma.message.updateMany({
        where: {
          projectId: project.id,
          evolutionId: key.id,
          senderType: { in: ["BOT", "AGENT"] },
          status: { in: ["PENDING", "SENT", "DELIVERED"] },
        },
        data: { status: "READ" },
      });

      changed ||= result.count > 0;
    } else if (update.status === 3 || update.status === "DELIVERY_ACK") {
      const result = await prisma.message.updateMany({
        where: {
          projectId: project.id,
          evolutionId: key.id,
          senderType: { in: ["BOT", "AGENT"] },
          status: { in: ["PENDING", "SENT"] },
        },
        data: { status: "DELIVERED" },
      });

      changed ||= result.count > 0;
    }
  }

  if (changed) {
    await notifyChatChanged(project.id);
  }
}

async function generateAiResponse(
  chatHistory: ChatMessage[],
  userName: string,
): Promise<string> {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  if (!openRouterKey) throw new Error("Clé OPENROUTER manquante");

  const systemPrompt = `Tu es l'assistant virtuel de l'entreprise ExtravertyAI. Ton but est d'accueillir les prospects. Le client s'appelle ${userName}. Réponds toujours de manière courtoise, très brève (1 à 2 phrases max) et idéale pour une conversation WhatsApp.`;

  const response = await fetch(
    "https://openrouter.ai/api/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer":
          process.env.NEXT_PUBLIC_APP_URL || "https://extraverty.ai",
        "X-Title": "ExtravertyAI",
      },
      body: JSON.stringify({
        // ⚠️ Vérifie que "google/gemini-2.5-flash-lite" est bien le nom exact sur OpenRouter.
        // Sinon utilise "google/gemini-flash-1.5-8b"
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "system", content: systemPrompt }, ...chatHistory],
        temperature: 0.7,
        max_tokens: 150,
      }),
    },
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`OpenRouter HTTP ${response.status}: ${err}`);
  }

  const result = await response.json();
  return result.choices[0].message.content;
}

async function sendWhatsAppMessage(
  instanceName: string,
  remoteJid: string,
  text: string,
) {
  const evolutionUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, "");
  const evolutionApiKey = process.env.EVOLUTION_API_KEY;

  if (!evolutionUrl || !evolutionApiKey) {
    throw new Error("Variables Evolution API manquantes");
  }

  const endpoint = `${evolutionUrl}/message/sendText/${instanceName}`;

  console.log(`[EVOLUTION API] 🚀 Envoi à : ${remoteJid}`);

  // 🛡️ CORRECTION MAJEURE ICI :
  // 1. On utilise le remoteJid COMPLET (avec @s.whatsapp.net).
  // 2. On utilise le format natif V2, beaucoup plus stable.
  // 3. On ajoute des 'options' (delay + presence) pour simuler un humain qui tape.
  const payload = {
    number: remoteJid,
    text: text,
    linkPreview: true,
    options: {
      delay: 1500,
      presence: "composing",
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

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(`Erreur HTTP ${response.status} : ${responseText}`);
  }

  return responseText ? JSON.parse(responseText) : {};
}
