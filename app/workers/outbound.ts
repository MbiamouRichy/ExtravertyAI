import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL manquant.");
}

const adapter = new PrismaPg({
  connectionString,
  max: 3,
});

const prisma = new PrismaClient({ adapter });

let stopping = false;

process.on("SIGTERM", () => {
  stopping = true;
});

process.on("SIGINT", () => {
  stopping = true;
});

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function notifyProject(projectId: string) {
  // Ne pas importer lib/chat-realtime.ts s'il contient "server-only".
  // Ici, import direct de Pusher depuis le worker.
  const appId = process.env.PUSHER_APP_ID;
  const key = process.env.PUSHER_KEY;
  const secret = process.env.PUSHER_SECRET;
  const cluster = process.env.PUSHER_CLUSTER;

  if (!appId || !key || !secret || !cluster) return;

  try {
    const { default: Pusher } = await import("pusher");

    const pusher = new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    });

    await pusher.trigger(`private-project-${projectId}`, "chat.changed", {
      version: 1,
    });
  } catch {
    console.error("[worker] Notification indisponible.");
  }
}

async function claimNextJob() {
  return prisma.$transaction(async (tx) => {
    const candidate = await tx.outboundJob.findFirst({
      where: { state: "QUEUED" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        projectId: true,
      },
    });

    if (!candidate) return null;

    // Même ordre de verrouillage que l'action : projet, puis contact.
    await tx.$queryRaw`
            SELECT id
            FROM "project"
            WHERE id = ${candidate.projectId}
            FOR UPDATE
        `;

    const job = await tx.outboundJob.findUnique({
      where: { id: candidate.id },
      include: {
        quotaPeriod: true,
        project: true,
        message: {
          include: { contact: true },
        },
      },
    });

    if (!job || job.state !== "QUEUED") return null;

    await tx.$queryRaw`
            SELECT id
            FROM "contact"
            WHERE id = ${job.message.contactId}
              AND "projectId" = ${job.projectId}
            FOR UPDATE
        `;

    const [{ now }] = await tx.$queryRaw<Array<{ now: Date }>>`
            SELECT clock_timestamp() AS now
        `;

    const membership = job.message.agentId
      ? await tx.projectMembership.findUnique({
          where: {
            userId_projectId: {
              userId: job.message.agentId,
              projectId: job.projectId,
            },
          },
          select: { userId: true },
        })
      : null;

    // Ce worker ne traite pour l'instant que les messages agents.
    const allowed =
      job.message.senderType === "AGENT" &&
      !!membership &&
      job.message.contact.projectId === job.projectId &&
      ["active", "trialing"].includes(job.project.status) &&
      job.project.instanceStatus === "connected" &&
      !!job.project.instanceName &&
      job.quotaPeriod.endsAt > now;

    if (!allowed) {
      await tx.outboundJob.update({
        where: { id: job.id },
        data: {
          state: "CANCELLED",
          finishedAt: now,
          errorCode: "PRE_SEND_CHECK_REJECTED",
        },
      });

      await tx.message.updateMany({
        where: {
          id: job.messageId,
          status: "PENDING",
        },
        data: {
          status: "FAILED",
          errorMessage: "CANCELLED_BEFORE_SEND",
        },
      });

      return {
        cancelled: true as const,
        projectId: job.projectId,
      };
    }

    const claimed = await tx.outboundJob.updateMany({
      where: {
        id: job.id,
        state: "QUEUED",
      },
      data: {
        state: "DISPATCHING",
        startedAt: now,
      },
    });

    if (claimed.count !== 1) return null;

    return {
      cancelled: false as const,
      jobId: job.id,
      projectId: job.projectId,
      messageId: job.messageId,
      instanceName: job.project.instanceName,
      remoteJid: job.message.contact.remoteJid,
      content: job.message.content,
    };
  });
}

async function markUncertain(jobId: string, code: string) {
  await prisma.outboundJob.updateMany({
    where: {
      id: jobId,
      state: { in: ["DISPATCHING", "UNCERTAIN"] },
    },
    data: {
      state: "UNCERTAIN",
      errorCode: code,
    },
  });
}

async function dispatch(
  job: Exclude<Awaited<ReturnType<typeof claimNextJob>>, null>,
) {
  if (job.cancelled) {
    await notifyProject(job.projectId);
    return;
  }

  const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const apiKey = process.env.EVOLUTION_API_KEY;

  // Vérifié aussi au démarrage. Si la config disparaît,
  // aucune nouvelle tentative implicite.
  if (!baseUrl || !apiKey) {
    await markUncertain(job.jobId, "CONFIG_UNAVAILABLE");
    return;
  }

  let providerId: string | undefined;

  try {
    // Adaptateur correspondant au format de TON code actuel.
    // À valider sur l'image Evolution réellement installée.
    const response = await fetch(
      `${baseUrl}/message/sendText/${encodeURIComponent(job.instanceName)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
        },
        body: JSON.stringify({
          number: job.remoteJid,
          text: job.content,
        }),
        signal: AbortSignal.timeout(15_000),
        cache: "no-store",
      },
    );

    const payload: unknown = await response.json().catch(() => null);

    if (isRecord(payload) && isRecord(payload.key)) {
      const id = payload.key.id;

      if (typeof id === "string" && id.length > 0 && id.length <= 250) {
        providerId = id;
      }
    }

    // En attendant le contrat exact de ta version, on ne classe
    // pas arbitrairement les 4xx/5xx comme définitivement non envoyés.
    if (!response.ok || !providerId) {
      await markUncertain(
        job.jobId,
        response.ok
          ? "ACK_WITHOUT_MESSAGE_ID"
          : `PROVIDER_HTTP_${response.status}`,
      );

      return;
    }

    // Sauvegarde de la preuve d'identité avant le rapprochement Message.
    await prisma.outboundJob.updateMany({
      where: {
        id: job.jobId,
        state: { in: ["DISPATCHING", "UNCERTAIN"] },
      },
      data: {
        providerMessageId: providerId,
      },
    });

    type PrismaTransactionClient = Parameters<
      Parameters<typeof prisma.$transaction>[0]
    >[0];

    await prisma.$transaction(async (tx: PrismaTransactionClient) => {
      const current = await tx.outboundJob.findUnique({
        where: { id: job.jobId },
        include: { message: true },
      });

      if (!current || !["DISPATCHING", "UNCERTAIN"].includes(current.state)) {
        return;
      }

      // Si l'ancien webhook a déjà créé un autre message avec cet ID,
      // ne pas fusionner silencieusement des données ici.
      const collision = await tx.message.findUnique({
        where: { evolutionId: providerId },
        select: { id: true },
      });

      if (collision && collision.id !== job.messageId) {
        await tx.outboundJob.update({
          where: { id: job.jobId },
          data: {
            state: "UNCERTAIN",
            errorCode: "PROVIDER_ID_RECONCILIATION_REQUIRED",
          },
        });

        return;
      }

      await tx.message.update({
        where: { id: job.messageId },
        data: {
          evolutionId: providerId,
          // Ne pas faire régresser un accusé reçu entre-temps.
          ...(current.message.status === "PENDING"
            ? { status: "SENT" as const }
            : {}),
          errorMessage: null,
        },
      });

      await tx.outboundJob.update({
        where: { id: job.jobId },
        data: {
          state: "ACCEPTED",
          finishedAt: new Date(),
          errorCode: null,
        },
      });
    });
  } catch {
    // Ne jamais remettre ce job dans QUEUED.
    // Un appel réseau a pu être accepté.
    try {
      await markUncertain(
        job.jobId,
        providerId ? "ACK_PERSISTENCE_UNCONFIRMED" : "TRANSPORT_RESULT_UNKNOWN",
      );
    } catch {
      // Si PostgreSQL est indisponible, le récupérateur traitera
      // ultérieurement DISPATCHING comme UNCERTAIN.
      console.error("[worker] Résultat non enregistré.");
    }
  } finally {
    await notifyProject(job.projectId);
  }
}

async function recoverInterruptedDispatches() {
  // Un dispatch interrompu n'est jamais relancé automatiquement.
  await prisma.$executeRaw`
        UPDATE "outbound_job"
        SET
            state = 'UNCERTAIN',
            "errorCode" = 'WORKER_INTERRUPTED',
            "updatedAt" = clock_timestamp()
        WHERE state = 'DISPATCHING'
          AND "startedAt" < clock_timestamp() - interval '2 minutes'
    `;
}

async function main() {
  if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY) {
    throw new Error("Configuration Evolution manquante.");
  }

  let lastRecovery = 0;

  while (!stopping) {
    try {
      if (Date.now() - lastRecovery > 30_000) {
        await recoverInterruptedDispatches();
        lastRecovery = Date.now();
      }

      const job = await claimNextJob();

      if (!job) {
        await sleep(500);
        continue;
      }

      await dispatch(job);
    } catch {
      console.error("[worker] Cycle interrompu.");
      await sleep(2000);
    }
  }
}

main()
  .catch(() => {
    console.error("[worker] Arrêt sur erreur.");
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
