import type { PrismaClient } from "../src/generated/prisma/client";
import { latestStatus } from "./evolution-ingestion";

export function createOutboundProcessor(
  prisma: PrismaClient,
  notifyProject: (projectId: string) => Promise<void>,
) {
  function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
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

      const contact = await tx.contact.findUnique({
        where: { id: job.message.contactId },
      });
      const unresolvedEcho =
        job.message.senderType === "BOT" && contact
          ? await tx.providerReceipt.findFirst({
              where: {
                projectId: job.projectId,
                remoteJid: contact.remoteJid,
                resolved: false,
                content: { not: null },
              },
            })
          : null;
      const senderAllowed =
        job.message.senderType === "AGENT"
          ? !!membership
          : job.message.senderType === "BOT" &&
            !!job.project.agentSetupCompletedAt &&
            !job.project.automationPaused &&
            job.agentConfigVersion === job.project.agentConfigVersion &&
            !!contact?.aiActive &&
            job.aiVersion === contact.aiVersion &&
            !unresolvedEcho;
      const allowed =
        !job.project.deletionPending &&
        senderAllowed &&
        contact?.projectId === job.projectId &&
        ["active", "trialing"].includes(job.project.status) &&
        job.project.instanceStatus === "connected" &&
        !!job.project.instanceName &&
        job.quotaPeriod.isCurrent &&
        job.quotaPeriod.kind === job.project.status &&
        job.quotaPeriod.startsAt <= now &&
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
        typing: job.project.whatsappTyping,
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
            delay: job.typing ? 1200 : 0,
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
        await tx.$queryRaw`SELECT id FROM project WHERE id = ${job.projectId} FOR UPDATE`;
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
          where: {
            projectId_evolutionId: {
              projectId: job.projectId,
              evolutionId: providerId!,
            },
          },
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

        const receipt = await tx.providerReceipt.findUnique({
          where: {
            projectId_providerId: {
              projectId: job.projectId,
              providerId: providerId!,
            },
          },
        });
        await tx.message.update({
          where: { id: job.messageId },
          data: {
            evolutionId: providerId,
            status: latestStatus(
              current.message.status,
              receipt?.status || "SENT",
            ),
            errorMessage: null,
          },
        });
        if (receipt)
          await tx.providerReceipt.update({
            where: { id: receipt.id },
            data: { resolved: true },
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
          providerId
            ? "ACK_PERSISTENCE_UNCONFIRMED"
            : "TRANSPORT_RESULT_UNKNOWN",
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

  return { claimNextJob, dispatch, recoverInterruptedDispatches };
}
