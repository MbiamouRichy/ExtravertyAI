import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "../src/generated/prisma/client";
import { AgentConfigSchema } from "./agent-config";
import { generateReply } from "./ai-jobs";
import { fitHistory } from "./ai-history";
import { aiMeter } from "./ai-usage";
import { nextSendingWindow, personalise } from "./broadcast-shared";
import { SILENCE_MARKER, splitConversationEnd } from "./conversation-end";
import {
  FOLLOW_UP_LIMITS,
  FOLLOW_UP_SOURCE,
  FollowUpSettingsSchema,
  type FollowUpSettings,
  type FollowUpStage,
  type FollowUpStats,
} from "./follow-ups-shared";
import { knowledgeContext } from "./knowledge";
import { messageAiContent } from "./message-ai-content";
import { MessageQuotaError, reserveMessageQuota } from "./message-quota";
import { splitMissingInfo } from "./missing-info";
import { planFeatures, plansWith, requirePlanFeature } from "./plan-features";
import { SettingsError, requireProjectAdmin } from "./project-settings";
import { projectTimeZone } from "./time-zones";

export * from "./follow-ups-shared";

const DAY_MS = 86_400_000;
/** Bail le temps de rédiger : un autre worker ne prépare pas la même relance. */
const LEASE_MS = 3 * 60_000;
/** Après un échec (IA indisponible, quota épuisé), le contact attend avant un nouvel essai. */
const RETRY_MS = 15 * 60_000;

/* -------------------------------------------------------------------------- */
/* Réglages                                                                    */
/* -------------------------------------------------------------------------- */

export function followUpSettings(project: {
  followUpEnabled: boolean;
  followUpInterestedDays: number;
  followUpQuoteDays: number;
  followUpMax: number;
  followUpTemplate: string;
}): FollowUpSettings {
  return {
    enabled: project.followUpEnabled,
    interestedDays: project.followUpInterestedDays,
    quoteDays: project.followUpQuoteDays,
    max: project.followUpMax,
    template: project.followUpTemplate,
  };
}

/**
 * Propriétaires et administrateurs. Activer demande l'offre Business ;
 * couper les relances reste possible après un changement d'offre.
 */
export async function saveFollowUpSettings(
  db: PrismaClient,
  input: { projectId: string; userId: string; settings: unknown },
) {
  const settings = FollowUpSettingsSchema.parse(input.settings);
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${input.projectId} FOR UPDATE`;
    const { project } = await requireProjectAdmin(tx, input.projectId, input.userId);
    if (project.deletionPending) throw new SettingsError("Ce projet est en cours de suppression.");
    if (settings.enabled) requirePlanFeature(project.plan, "followUps");
    await tx.project.update({
      where: { id: input.projectId },
      data: {
        followUpEnabled: settings.enabled,
        followUpInterestedDays: settings.interestedDays,
        followUpQuoteDays: settings.quoteDays,
        followUpMax: settings.max,
        followUpTemplate: settings.template,
      },
    });
  });
  return settings;
}

/* -------------------------------------------------------------------------- */
/* Éligibilité                                                                 */
/* -------------------------------------------------------------------------- */

type Candidate = {
  id: string;
  projectId: string;
  stage: FollowUpStage;
  /** Dernier échange, dans un sens ou dans l'autre : point de départ du délai. */
  lastActivityAt: Date;
};

/**
 * Un prospect « Intéressé » ou « Devis envoyé » dont la conversation est
 * silencieuse depuis le délai de son étape, et seulement si :
 * - le client a déjà écrit (consentement implicite) et sa dernière demande a
 *   reçu une réponse, ou l'IA l'a volontairement laissée sans réponse
 *   (« merci », « je vais réfléchir ») : un client qui attend une réponse
 *   n'est jamais relancé à la place de cette réponse ;
 * - l'IA est active (aucun membre n'a repris la main), pas de STOP, la
 *   conversation n'est pas résolue ;
 * - moins de relances que le maximum depuis le dernier message du client ;
 * - le délai est dépassé depuis moins de quelques jours : activer la fonction
 *   ne réveille pas des conversations anciennes ;
 * - aucun envoi ni réponse de l'IA n'est en cours pour ce contact.
 */
function eligibleContacts(now: Date, scope: Prisma.Sql) {
  return Prisma.sql`
    SELECT c.id, c."projectId", c."pipelineStage"::text AS stage, la.at AS "lastActivityAt"
    FROM contact c
    JOIN project p ON p.id = c."projectId"
    CROSS JOIN LATERAL (
      SELECT m."createdAt" AS at, m."aiSkip"::text AS skip FROM message m
      WHERE m."contactId" = c.id AND NOT m."fromMe"
      ORDER BY m."createdAt" DESC, m.id DESC LIMIT 1
    ) lc
    CROSS JOIN LATERAL (
      SELECT max(m."createdAt") AS at FROM message m
      WHERE m."contactId" = c.id AND (NOT m."fromMe" OR m.status <> 'FAILED')
    ) la
    CROSS JOIN LATERAL (
      SELECT CASE c."pipelineStage"
        WHEN 'INTERESTED' THEN p."followUpInterestedDays"
        WHEN 'QUOTE_SENT' THEN p."followUpQuoteDays"
        ELSE 0 END AS days
    ) d
    WHERE ${scope}
      AND p."followUpEnabled" AND p.plan::text = ANY(${plansWith("followUps")}::text[])
      AND NOT p."deletionPending" AND NOT p."automationPaused"
      AND p."agentSetupCompletedAt" IS NOT NULL AND p."instanceStatus" = 'connected'
      AND c."pipelineStage" IN ('INTERESTED', 'QUOTE_SENT') AND d.days > 0
      AND c."aiActive" AND c."broadcastOptOutAt" IS NULL AND c."resolvedAt" IS NULL
      AND la.at + make_interval(days => d.days) <= ${now}
      AND la.at + make_interval(days => d.days + ${FOLLOW_UP_LIMITS.graceDays}::int) > ${now}
      AND (
        lc.skip IN ('SILENCE', 'QUIET_ACK')
        OR EXISTS (
          SELECT 1 FROM message o
          WHERE o."contactId" = c.id AND o."fromMe" AND o.status <> 'FAILED' AND o."createdAt" > lc.at
        )
      )
      AND (
        SELECT count(*) FROM message f
        WHERE f."contactId" = c.id AND f."fromMe" AND f.source = ${FOLLOW_UP_SOURCE}
          AND f.status <> 'FAILED' AND f."createdAt" > lc.at
      ) < p."followUpMax"
      AND (c."followUpDeclinedAt" IS NULL OR c."followUpDeclinedAt" < la.at)
      AND NOT EXISTS (
        SELECT 1 FROM outbound_job j JOIN message jm ON jm.id = j."messageId"
        WHERE jm."contactId" = c.id AND j.state IN ('QUEUED', 'DISPATCHING', 'UNCERTAIN')
      )
      AND NOT EXISTS (
        SELECT 1 FROM ai_job a WHERE a."contactId" = c.id AND a.state IN ('QUEUED', 'GENERATING')
      )`;
}

/**
 * Projets qui peuvent relancer maintenant : offre, heures ouvrées de leurs
 * clients, rythme (limite sur 24 h, écart entre deux relances) et quota restant,
 * pour ne jamais payer une rédaction qui ne pourrait pas partir.
 */
async function readyProjects(db: PrismaClient, now: Date) {
  const projects = await db.project.findMany({
    where: {
      followUpEnabled: true,
      plan: { in: plansWith("followUps") },
      deletionPending: false,
      automationPaused: false,
      agentSetupCompletedAt: { not: null },
      instanceStatus: "connected",
      status: { in: ["active", "trialing"] },
    },
    select: { id: true, plan: true, status: true, timeZone: true },
  });
  const open = projects.filter(
    (project) => nextSendingWindow(now, projectTimeZone(project.timeZone)).getTime() <= now.getTime(),
  );
  if (!open.length) return [];
  const ids = open.map((project) => project.id);
  const [recent, periods] = await Promise.all([
    db.message.groupBy({
      by: ["projectId"],
      where: {
        projectId: { in: ids },
        source: FOLLOW_UP_SOURCE,
        fromMe: true,
        createdAt: { gt: new Date(now.getTime() - DAY_MS) },
      },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    db.quotaPeriod.findMany({
      where: { projectId: { in: ids }, isCurrent: true, startsAt: { lte: now }, endsAt: { gt: now } },
      select: { projectId: true, kind: true, used: true, limit: true },
    }),
  ]);
  return open
    .filter((project) => {
      const sent = recent.find((row) => row.projectId === project.id);
      const last = sent?._max.createdAt?.getTime() ?? 0;
      const period = periods.find(
        (row) => row.projectId === project.id && row.kind === project.status,
      );
      return (
        (sent?._count._all ?? 0) < planFeatures(project.plan).followUpDaily &&
        now.getTime() - last >= FOLLOW_UP_LIMITS.projectSpacingMs &&
        !!period &&
        period.used < period.limit
      );
    })
    .map((project) => project.id);
}

/** Le contact le plus ancien en attente, réservé par un bail le temps de rédiger. */
async function claimFollowUp(db: PrismaClient, now: Date) {
  const projectIds = await readyProjects(db, now);
  if (!projectIds.length) return null;
  const candidates = await db.$queryRaw<Candidate[]>`${eligibleContacts(
    now,
    Prisma.sql`c."projectId" = ANY(${projectIds}::text[])
      AND (c."followUpLeaseUntil" IS NULL OR c."followUpLeaseUntil" < ${now})`,
  )}
    ORDER BY la.at, c.id
    LIMIT 5`;
  for (const candidate of candidates) {
    const token = randomUUID();
    // Réservation atomique : deux workers ne relancent jamais le même contact.
    const leased = await db.contact.updateMany({
      where: {
        id: candidate.id,
        OR: [{ followUpLeaseUntil: null }, { followUpLeaseUntil: { lt: now } }],
      },
      data: {
        followUpLeaseToken: token,
        followUpLeaseUntil: new Date(now.getTime() + LEASE_MS),
      },
    });
    if (leased.count) return { ...candidate, token };
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Rédaction                                                                   */
/* -------------------------------------------------------------------------- */

/** Consigne de l'IA à la place de « réponds au dernier message du client ». */
export function followUpInstruction(stage: FollowUpStage, days: number) {
  const context =
    stage === "QUOTE_SENT"
      ? "un prix ou un devis lui a été transmis et il n’a pas encore donné sa réponse"
      : "il s’est montré intéressé sans aller plus loin";
  return `
Relance d’un prospect (ce message n’est pas une réponse) :
- Le client n’a plus écrit depuis ${days} jour${days > 1 ? "s" : ""} : ${context}.
- Rédige un seul message de relance, deux phrases au plus, chaleureux et sans pression, dans la langue de la conversation.
- Rappelle en quelques mots ce dont il était question, puis propose la prochaine étape ou ton aide par une question simple.
- Ne répète pas un message déjà envoyé et n’invente ni prix, ni remise, ni délai absents de la conversation ou de tes informations.
- Si une relance serait déplacée (le client a refusé, a déjà acheté, a demandé à ne plus être contacté, ou l’échange est clairement terminé), réponds uniquement ${SILENCE_MARKER}.`;
}

type Draft = { text: string } | { declined: true };

async function draftFollowUp(
  db: PrismaClient,
  candidate: Candidate,
  now: Date,
  generate: typeof generateReply,
): Promise<Draft> {
  const [project, contact] = await Promise.all([
    db.project.findUniqueOrThrow({ where: { id: candidate.projectId } }),
    db.contact.findUniqueOrThrow({
      where: { id: candidate.id },
      select: { name: true, pushName: true },
    }),
  ]);
  // Message type de l'équipe : envoyé tel quel, avec le prénom du client.
  if (project.followUpTemplate.trim()) {
    const text = personalise(project.followUpTemplate, contact);
    return text ? { text } : { declined: true };
  }
  const history = await db.message.findMany({
    where: {
      contactId: candidate.id,
      projectId: candidate.projectId,
      OR: [{ fromMe: false }, { fromMe: true, status: { in: ["SENT", "DELIVERED", "READ"] } }],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: planFeatures(project.plan).contextMessages,
  });
  const ordered = history.reverse();
  const knowledge = await knowledgeContext(
    db,
    candidate.projectId,
    project.currency,
    ordered.filter((message) => !message.fromMe).map((message) => messageAiContent(message)),
  ).catch(() => ({ block: "" }));
  const prompt = fitHistory(
    ordered.map((message) => ({
      role: message.fromMe ? "assistant" : "user",
      content: messageAiContent(message).slice(0, 4096),
    })),
  );
  const days = Math.max(1, Math.floor((now.getTime() - candidate.lastActivityAt.getTime()) / DAY_MS));
  const raw = await generate(
    prompt,
    project.name,
    contact.name || contact.pushName || "Client",
    AgentConfigSchema.parse(project),
    {
      knowledge: knowledge.block,
      task: followUpInstruction(candidate.stage, days),
      meter: aiMeter(db, candidate.projectId, "follow_up"),
    },
  );
  const closing = splitConversationEnd(raw);
  if (closing.silent) return { declined: true };
  const text = splitMissingInfo(closing.text).text.trim();
  return text ? { text } : { declined: true };
}

/* -------------------------------------------------------------------------- */
/* Envoi                                                                       */
/* -------------------------------------------------------------------------- */

export type FollowUpTick =
  | { projectId: string; contactId: string; outcome: "sent" | "declined" | "skipped" | "failed" }
  | null;

/**
 * Prépare et met en file au plus une relance. La rédaction a lieu hors
 * transaction ; l'envoi revérifie tout sous verrou (le client a pu répondre ou
 * un membre reprendre la main entre-temps) et rejoint la file d'envoi normale.
 * Appelé en boucle par le worker IA.
 */
export async function runFollowUpTick(
  db: PrismaClient,
  options: { now?: Date; generate?: typeof generateReply } = {},
): Promise<FollowUpTick> {
  const now = options.now ?? new Date();
  const candidate = await claimFollowUp(db, now);
  if (!candidate) return null;
  const result = (outcome: NonNullable<FollowUpTick>["outcome"]): FollowUpTick => ({
    projectId: candidate.projectId,
    contactId: candidate.id,
    outcome,
  });
  const release = (data: Prisma.ContactUpdateManyMutationInput) =>
    db.contact.updateMany({
      where: { id: candidate.id, followUpLeaseToken: candidate.token },
      data: { followUpLeaseToken: null, ...data },
    });

  let draft: Draft;
  try {
    draft = await draftFollowUp(db, candidate, now, options.generate ?? generateReply);
  } catch {
    await release({ followUpLeaseUntil: new Date(now.getTime() + RETRY_MS) });
    console.error("[follow-ups] Rédaction indisponible, nouvel essai différé.");
    return result("failed");
  }
  if ("declined" in draft) {
    // L'IA juge la relance déplacée : pas de nouvel essai avant un nouvel échange.
    await release({ followUpLeaseUntil: null, followUpDeclinedAt: candidate.lastActivityAt });
    return result("declined");
  }

  try {
    return await db.$transaction(async (tx) => {
      // Même ordre de verrous que chaque envoi : projet, puis contact.
      await tx.$queryRaw`SELECT id FROM project WHERE id = ${candidate.projectId} FOR UPDATE`;
      await tx.$queryRaw`SELECT id FROM contact WHERE id = ${candidate.id} FOR UPDATE`;
      const [still] = await tx.$queryRaw<Candidate[]>`${eligibleContacts(
        now,
        Prisma.sql`c.id = ${candidate.id} AND c."followUpLeaseToken" = ${candidate.token}`,
      )}`;
      if (!still) {
        await tx.contact.updateMany({
          where: { id: candidate.id, followUpLeaseToken: candidate.token },
          data: { followUpLeaseToken: null, followUpLeaseUntil: null },
        });
        return result("skipped");
      }
      const [project, contact] = await Promise.all([
        tx.project.findUniqueOrThrow({
          where: { id: candidate.projectId },
          select: { agentConfigVersion: true },
        }),
        tx.contact.findUniqueOrThrow({ where: { id: candidate.id }, select: { aiVersion: true } }),
      ]);
      const quota = await reserveMessageQuota(tx, candidate.projectId);
      const message = await tx.message.create({
        data: {
          projectId: candidate.projectId,
          contactId: candidate.id,
          content: draft.text,
          senderType: "BOT",
          fromMe: true,
          status: "PENDING",
          source: FOLLOW_UP_SOURCE,
          createdAt: now,
        },
      });
      await tx.outboundJob.create({
        data: {
          projectId: candidate.projectId,
          messageId: message.id,
          requestId: randomUUID(),
          quotaPeriodId: quota.quotaPeriodId,
          // Annulée à l'envoi si un membre reprend la main ou si l'agent change.
          aiVersion: contact.aiVersion,
          agentConfigVersion: project.agentConfigVersion,
        },
      });
      await tx.contact.update({
        where: { id: candidate.id },
        data: { lastMessageAt: now, followUpLeaseToken: null, followUpLeaseUntil: null },
      });
      return result("sent");
    });
  } catch (error) {
    await release({ followUpLeaseUntil: new Date(now.getTime() + RETRY_MS) });
    if (error instanceof MessageQuotaError) return result("skipped");
    console.error("[follow-ups] Mise en file impossible, nouvel essai différé.");
    return result("failed");
  }
}

/* -------------------------------------------------------------------------- */
/* Suivi                                                                       */
/* -------------------------------------------------------------------------- */

/** Relances envoyées, réponses obtenues sous 7 jours et ventes conclues ensuite (30 derniers jours par défaut). */
export async function followUpStats(
  db: PrismaClient,
  projectId: string,
  since: Date = new Date(Date.now() - 30 * DAY_MS),
): Promise<FollowUpStats> {
  const [[sent], [won]] = await Promise.all([
    db.$queryRaw<Array<{ sent: number; replied: number }>>`
      SELECT count(*)::int AS sent,
        count(*) FILTER (WHERE EXISTS (
          SELECT 1 FROM message r
          WHERE r."contactId" = f."contactId" AND NOT r."fromMe"
            AND r."createdAt" > f."createdAt" AND r."createdAt" <= f."createdAt" + interval '7 days'
        ))::int AS replied
      FROM message f
      WHERE f."projectId" = ${projectId} AND f.source = ${FOLLOW_UP_SOURCE} AND f."fromMe"
        AND f.status <> 'FAILED' AND f."createdAt" >= ${since}`,
    db.$queryRaw<Array<{ won: number; value: number }>>`
      SELECT count(*)::int AS won, COALESCE(sum(c."dealValue"), 0)::bigint::float8 AS value
      FROM contact c
      WHERE c."projectId" = ${projectId} AND c."pipelineStage" = 'WON'
        AND EXISTS (
          SELECT 1 FROM message f
          WHERE f."contactId" = c.id AND f.source = ${FOLLOW_UP_SOURCE} AND f."fromMe"
            AND f.status <> 'FAILED' AND f."createdAt" >= ${since}
            AND f."createdAt" <= c."stageChangedAt"
        )`,
  ]);
  return {
    sent: sent?.sent ?? 0,
    replied: sent?.replied ?? 0,
    won: won?.won ?? 0,
    wonValue: Number(won?.value ?? 0),
  };
}
