import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { notifyChatChanged } from "@/lib/chat-realtime";
import {
  deliveryStatus,
  ingestMessage,
  reconcileReceipt,
  saveReceipt,
} from "@/lib/evolution-ingestion";

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
    const project = await prisma.project.findUnique({
      where: { instanceName: instance },
      select: { id: true },
    });
    if (!project)
      return NextResponse.json({ error: "Instance inconnue" }, { status: 404 });
    const eventName = event.toLowerCase().replaceAll("_", ".");
    await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM project WHERE id = ${project.id} FOR UPDATE`;
        if (eventName === "messages.upsert") {
          const envelope = z
            .object({ messages: z.array(z.unknown()) })
            .safeParse(data);
          const messages = envelope.success
            ? envelope.data.messages
            : Array.isArray(data)
              ? data
              : [data];
          for (const message of messages)
            await ingestMessage(tx, project.id, message);
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
              instanceStatus:
                state === "open"
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
    await notifyChatChanged(project.id);
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
