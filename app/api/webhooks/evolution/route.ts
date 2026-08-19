import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { z } from "zod";
import { InstanceStatus } from "@/src/generated/prisma/client";
// IMPORT DE L'ENUM PRISMA (Adapte le chemin si nécessaire)

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

// CORRECTION DE 'any' -> Record<string, unknown> | undefined
async function processIncomingMessages(instanceName: string, data: unknown) {
  if (!data) return;
  // Ta logique métier ici
  console.log(`[Webhook] 📩 Message reçu pour ${instanceName}:`, data);
}
