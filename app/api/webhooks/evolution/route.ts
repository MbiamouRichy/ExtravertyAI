import { NextResponse, after } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { notifyChatChanged } from "@/lib/chat-realtime";
import { refreshContactAvatars } from "@/lib/contact-avatar";
import { relayPresenceUpdate } from "@/lib/contact-presence";
import {
  IncomingSchema,
  deliveryStatus,
  ingestMessage,
  reconcileReceipt,
  saveReceipt,
} from "@/lib/evolution-ingestion";
import { isForeignTrialNumber } from "@/lib/instance-connection";
import {
  isOtpInstance,
  receiveVerificationMessage,
  sendWhatsAppCode,
} from "@/lib/phone-verification";
import { allowRequest } from "@/lib/rate-limit";
import {
  getEvolutionOwnerJid,
  logoutEvolutionInstance,
} from "@/app/actions/evolutionAPI";

export const runtime = "nodejs";
const Body = z.object({
  event: z.string(),
  instance: z.string().min(1),
  data: z.unknown(),
});
const Update = z.object({
  key: z.object({ id: z.string().min(1).max(250) }).optional(),
  keyId: z.string().min(1).max(250).optional(),
  update: z.object({ status: z.union([z.number(), z.string()]) }).optional(),
  status: z.union([z.number(), z.string()]).optional(),
});

/** Messages d’un `messages.upsert`, qu’Evolution les envoie seuls ou groupés. */
function upsertedMessages(data: unknown) {
  const envelope = z.object({ messages: z.array(z.unknown()) }).safeParse(data);
  return envelope.success
    ? envelope.data.messages
    : Array.isArray(data)
      ? data
      : [data];
}

/**
 * Numéro d’ExtravertyAI : seuls les codes de vérification envoyés par les
 * clients y sont lus, puis le client reçoit une réponse dans sa conversation.
 */
async function receiveOtpEvent(eventName: string, data: unknown) {
  if (eventName !== "messages.upsert") return;
  const replies: Array<{ digits: string; reply: string }> = [];
  for (const message of upsertedMessages(data)) {
    const outcome = await receiveVerificationMessage(prisma, message);
    // Une seule réponse par numéro toutes les quelques minutes, jamais de boucle.
    if (outcome && allowRequest(`otp-reply:${outcome.digits}`, 3, 10 * 60 * 1000))
      replies.push(outcome);
  }
  if (replies.length)
    after(async () => {
      for (const { digits, reply } of replies)
        await sendWhatsAppCode(digits, reply).catch(() =>
          console.error("[otp] Réponse WhatsApp non envoyée."),
        );
    });
}

export async function POST(req: Request) {
  const secret =
    new URL(req.url).searchParams.get("secret") ||
    req.headers.get("x-webhook-secret") ||
    "";
  const expected = process.env.EVOLUTION_WEBHOOK_SECRET || "";
  if (
    !expected ||
    Buffer.byteLength(secret) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(secret), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 401 });
  }
  try {
    const { event, instance, data } = Body.parse(await req.json());
    if (isOtpInstance(instance)) {
      await receiveOtpEvent(event.toLowerCase().replaceAll("_", "."), data);
      return NextResponse.json({ success: true });
    }
    const project = await prisma.project.findUnique({
      where: { instanceName: instance },
      select: { id: true, numero: true, status: true },
    });
    if (!project)
      return NextResponse.json({ error: "Instance inconnue" }, { status: 404 });
    const eventName = event.toLowerCase().replaceAll("_", ".");
    // Présence d’un contact : relayée en direct, rien n’est enregistré.
    if (eventName === "presence.update") {
      await relayPresenceUpdate(prisma, project.id, instance, data);
      return NextResponse.json({ success: true });
    }
    // Pendant l'essai, seul le numéro déclaré peut être relié au projet.
    let foreignNumber = false;
    if (eventName === "connection.update" && project.status === "trialing") {
      const update = z
        .object({ state: z.string(), wuid: z.string().optional() })
        .safeParse(data);
      if (update.success && update.data.state === "open")
        foreignNumber = isForeignTrialNumber(
          project,
          update.data.wuid ??
            (await getEvolutionOwnerJid(instance).catch(() => null)),
        );
    }
    // Prospects qui viennent d’écrire : leur photo est vérifiée après la réponse.
    const senders: string[] = [];
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM project WHERE id = ${project.id} FOR UPDATE`;
        if (eventName === "messages.upsert") {
          for (const message of upsertedMessages(data)) {
            await ingestMessage(tx, project.id, message);
            const parsed = IncomingSchema.safeParse(message);
            if (parsed.success && !parsed.data.key.fromMe)
              senders.push(parsed.data.key.remoteJid);
          }
        } else if (eventName === "messages.update") {
          for (const raw of Array.isArray(data) ? data : [data]) {
            const update = Update.parse(raw);
            const providerId = update.key?.id || update.keyId;
            const status = deliveryStatus(
              update.update?.status ?? update.status,
            );
            if (!providerId || !status) continue;
            await saveReceipt(tx, project.id, providerId, status);
            const receipt = await tx.providerReceipt.findUniqueOrThrow({
              where: {
                projectId_providerId: { projectId: project.id, providerId },
              },
            });
            await reconcileReceipt(tx, receipt.id);
          }
        } else if (eventName === "connection.update") {
          const { state } = z.object({ state: z.string() }).parse(data);
          await tx.project.update({
            where: { id: project.id },
            data: {
              instanceStatus: foreignNumber
                ? "disconnected"
                : state === "open"
                  ? "connected"
                  : state === "connecting"
                    ? "connecting"
                    : "disconnected",
            },
          });
        }
      },
      { timeout: 15000 },
    );
    if (foreignNumber) {
      console.warn("TRIAL_FOREIGN_NUMBER_DISCONNECTED", {
        projectId: project.id,
      });
      await logoutEvolutionInstance(instance).catch(() => undefined);
    }
    await notifyChatChanged(project.id);
    // Photo de profil : après la réponse, sans retarder le message ni l’IA.
    if (senders.length)
      after(async () => {
        try {
          const changed = await refreshContactAvatars(prisma, {
            projectId: project.id,
            instanceName: instance,
            remoteJids: senders,
          });
          if (changed) await notifyChatChanged(project.id);
        } catch {
          console.error("[avatar] Vérification des photos reportée.");
        }
      });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Payload invalide" }, { status: 400 });
    }
    console.error("[evolution] Ingestion non confirmée.");
    // Do not acknowledge a database failure: the sender must retry this event.
    return NextResponse.json(
      { error: "Enregistrement indisponible" },
      { status: 503 },
    );
  }
}
