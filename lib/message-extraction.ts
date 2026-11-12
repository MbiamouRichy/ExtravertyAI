import { randomUUID } from "node:crypto";
import { aiMeter } from "./ai-usage";
import { getBillingAccess } from "./billing-access";
import { Prisma, type PrismaClient } from "../src/generated/prisma/client";
import { readProviderMedia, readStoredMedia } from "./chat-media-server";
import { mediaFeature, planAllows, plansWith } from "./plan-features";
import {
  analyzeImage,
  ImageAnalysisError,
  ImageExtractionSchema,
  IMAGE_ANALYSIS_VERSION,
} from "./image-analysis";
import {
  transcribeAudio,
  TranscriptSchema,
  TranscriptionError,
  TRANSCRIPTION_VERSION,
} from "./audio-transcription";

const MAX_ATTEMPTS = 3;
/** Analyse écartée parce que l’offre du projet n’inclut pas ce média. */
const PLAN_EXCLUDED = "PLAN_EXCLUDED";

/** Message `m` dont l’offre du projet `p` inclut la compréhension du média. */
function mediaAllowedSql() {
  return Prisma.sql`((m.type = 'AUDIO' AND p.plan::text = ANY(${plansWith("audio")}::text[]))
    OR (m.type = 'IMAGE' AND p.plan::text = ANY(${plansWith("images")}::text[])))`;
}

// Atomic claim shared by all worker instances; do not hold a DB transaction during I/O.
export async function claimMessageExtraction(prisma: PrismaClient) {
  // Projet passé à une offre sans ce média : le message n’attend plus d’analyse,
  // donc ni la réponse de l’IA ni Instinct ne restent bloqués derrière lui.
  await prisma.$executeRaw`UPDATE message m SET "extractionStatus" = NULL,
    "extractionAvailableAt" = NULL, "extractionErrorCode" = ${PLAN_EXCLUDED},
    "updatedAt" = clock_timestamp()
    FROM project p WHERE p.id = m."projectId" AND m."extractionStatus" = 'PENDING'
      AND NOT ${mediaAllowedSql()}`;
  await prisma.$executeRaw`UPDATE message SET
    "extractionStatus" = CASE WHEN "extractionAttempts" >= ${MAX_ATTEMPTS} THEN 'FAILED'::"ExtractionStatus" ELSE 'PENDING'::"ExtractionStatus" END,
    "extractionLeaseToken" = NULL, "extractionLeaseUntil" = NULL,
    "extractionAvailableAt" = clock_timestamp(), "extractionErrorCode" = 'LEASE_EXPIRED',
    "updatedAt" = clock_timestamp()
    WHERE "extractionStatus" = 'PROCESSING' AND "extractionLeaseUntil" < clock_timestamp()`;
  const token = randomUUID();
  const [claimed] = await prisma.$queryRaw<
    Array<{ id: string; projectId: string }>
  >`
    WITH candidate AS (
      SELECT m.id FROM message m JOIN project p ON p.id = m."projectId"
      WHERE m.type IN ('AUDIO', 'IMAGE') AND m."senderType" = 'CLIENT' AND NOT m."fromMe"
        AND m."extractionStatus" = 'PENDING' AND m."extractionAttempts" < ${MAX_ATTEMPTS}
        AND m."extractionAvailableAt" <= clock_timestamp()
        AND ${mediaAllowedSql()}
        AND NOT p."deletionPending"
        AND (p.status IN ('active', 'trialing') OR (p."automationPaused" AND p.status = 'paused' AND p."statusBeforePause" IN ('active', 'trialing')))
        AND EXISTS (SELECT 1 FROM quota_period q WHERE q."projectId" = p.id AND q."isCurrent"
          AND q.kind = CASE WHEN p."automationPaused" AND p.status = 'paused' THEN p."statusBeforePause" ELSE p.status END
          AND q."startsAt" <= clock_timestamp() AND q."endsAt" > clock_timestamp())
      ORDER BY m."extractionAvailableAt", m.id LIMIT 1 FOR UPDATE OF m SKIP LOCKED
    )
    UPDATE message m SET "extractionStatus" = 'PROCESSING',
      "extractionAttempts" = m."extractionAttempts" + 1, "extractionLeaseToken" = ${token}::uuid,
      "extractionLeaseUntil" = clock_timestamp() + interval '4 minutes',
      "extractionErrorCode" = NULL, "updatedAt" = clock_timestamp()
    FROM candidate c WHERE m.id = c.id RETURNING m.id, m."projectId"`;
  if (!claimed) return null;
  return prisma.message.findFirst({
    where: {
      id: claimed.id,
      projectId: claimed.projectId,
      extractionLeaseToken: token,
    },
    include: {
      project: { select: { instanceName: true } },
      contact: { select: { remoteJid: true } },
    },
  });
}
type ExtractionJob = NonNullable<
  Awaited<ReturnType<typeof claimMessageExtraction>>
>;

async function loadMedia(job: ExtractionJob) {
  if (job.mediaUrl?.startsWith("chat-media/" + job.projectId + "/"))
    return readStoredMedia(job.mediaUrl, job.projectId);
  if (!job.evolutionId) {
    if (job.type === "IMAGE")
      throw new ImageAnalysisError("IMAGE_MEDIA_MISSING", false);
    throw new TranscriptionError("TRANSCRIPTION_MEDIA_MISSING", false);
  }
  // Never fetch a URL taken from the webhook. Use the configured authenticated provider.
  return readProviderMedia({
    evolutionId: job.evolutionId,
    fromMe: job.fromMe,
    type: job.type,
    remoteJid: job.contact.remoteJid,
    instanceName: job.project.instanceName,
  });
}

export async function runMessageExtraction(
  prisma: PrismaClient,
  job: ExtractionJob,
  transcribe = transcribeAudio,
  load = loadMedia,
  analyze = analyzeImage,
) {
  try {
    const current = await prisma.message.findFirst({
      where: {
        id: job.id,
        projectId: job.projectId,
        extractionStatus: "PROCESSING",
        extractionLeaseToken: job.extractionLeaseToken,
        extractionLeaseUntil: { gt: new Date() },
        project: { deletionPending: false },
      },
      select: { project: { select: { plan: true } } },
    });
    if (!current) return;
    // Changement d’offre depuis la réservation : aucun appel payant.
    const feature = mediaFeature(job.type);
    if (!feature || !planAllows(current.project.plan, feature)) {
      await prisma.message.updateMany({
        where: {
          id: job.id,
          projectId: job.projectId,
          extractionLeaseToken: job.extractionLeaseToken,
        },
        data: {
          extractionStatus: null,
          extractionAvailableAt: null,
          extractionLeaseToken: null,
          extractionLeaseUntil: null,
          extractionErrorCode: PLAN_EXCLUDED,
        },
      });
      return;
    }
    if (!(await getBillingAccess(prisma, job.projectId)).allowed) {
      await prisma.message.updateMany({
        where: {
          id: job.id,
          projectId: job.projectId,
          extractionLeaseToken: job.extractionLeaseToken,
        },
        data: {
          extractionStatus: "PENDING",
          extractionAttempts: { decrement: 1 },
          extractionLeaseToken: null,
          extractionLeaseUntil: null,
        },
      });
      return;
    }
    const media = await load(job);
    const result =
      job.type === "IMAGE"
        ? ImageExtractionSchema.parse(
            await analyze(media, aiMeter(prisma, job.projectId, "image")),
          )
        : TranscriptSchema.parse(
            await transcribe(media, aiMeter(prisma, job.projectId, "audio")),
          );
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM project WHERE id = ${job.projectId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM contact WHERE id = ${job.contactId} FOR UPDATE`;
      const saved = await tx.message.updateMany({
        where: {
          id: job.id,
          projectId: job.projectId,
          extractionStatus: "PROCESSING",
          extractionLeaseToken: job.extractionLeaseToken,
          extractionLeaseUntil: { gt: new Date() },
          project: { deletionPending: false },
        },
        data: {
          extractedText: result.text,
          extractionStatus: "COMPLETED",
          extractionModel: result.model,
          extractionVersion:
            job.type === "IMAGE"
              ? IMAGE_ANALYSIS_VERSION
              : TRANSCRIPTION_VERSION,
          extractedAt: new Date(),
          extractionLeaseToken: null,
          extractionLeaseUntil: null,
          extractionErrorCode: null,
        },
      });
      if (!saved.count) return;
      // Invalidate even if a newer message was already classified. Fence any old analysis.
      await tx.contact.updateMany({
        where: { id: job.contactId, projectId: job.projectId },
        data: {
          instinctSourceId: null,
          instinctClassification: null,
          instinctInteresting: false,
          instinctLeaseToken: null,
          instinctLeaseUntil: null,
        },
      });
    });
  } catch (error) {
    const permanent =
      ((error instanceof TranscriptionError ||
        error instanceof ImageAnalysisError) &&
        !error.retryable) ||
      (error instanceof Error &&
        ["MEDIA_INVALID", "MEDIA_TOO_LARGE"].includes(error.message));
    await prisma.message.updateMany({
      where: {
        id: job.id,
        projectId: job.projectId,
        extractionStatus: "PROCESSING",
        extractionLeaseToken: job.extractionLeaseToken,
      },
      data: {
        extractionStatus:
          permanent || job.extractionAttempts >= MAX_ATTEMPTS
            ? "FAILED"
            : "PENDING",
        extractionAvailableAt: new Date(
          Date.now() + 15_000 * 2 ** job.extractionAttempts,
        ),
        extractionLeaseToken: null,
        extractionLeaseUntil: null,
        extractionErrorCode:
          error instanceof TranscriptionError ||
          error instanceof ImageAnalysisError
            ? error.code
            : job.type === "IMAGE"
              ? "IMAGE_ANALYSIS_FAILED"
              : "TRANSCRIPTION_FAILED",
      },
    });
  }
}
