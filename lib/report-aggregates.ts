// Agrégats d'une semaine, selon docs/rapports-indicateurs.md. Chaque requête est
// filtrée par projectId, s'appuie sur l'index message(projectId, createdAt) et
// ne renvoie que des nombres : aucun contenu de conversation ne sort d'ici.
import type { Prisma } from "../src/generated/prisma/client";
import type { WeekAggregate } from "./report-week";
import type { ReportMetrics } from "./weekly-report";

type Db = Prisma.TransactionClient;

const toNumber = (value: unknown) =>
  value === null || value === undefined ? 0 : Number(value);

async function conversationStats(
  db: Db,
  projectId: string,
  start: Date,
  end: Date,
) {
  const [row] = await db.$queryRaw<Record<string, unknown>[]>`
    WITH semaine AS (
      SELECT m.id, m."contactId", m."createdAt", m."senderType", m."fromMe", m.status, m.source, m."aiSkip"
      FROM message m
      WHERE m."projectId" = ${projectId} AND m."createdAt" >= ${start} AND m."createdAt" < ${end}
    ),
    demandes AS (
      SELECT s.* FROM semaine s
      WHERE s."senderType" = 'CLIENT' AND NOT s."fromMe"
        AND (s."aiSkip" IS NULL OR s."aiSkip" = 'MERGED')
        AND NOT EXISTS (SELECT 1 FROM csat_survey q WHERE q."responseMessageId" = s.id)
    ),
    conversations AS (
      SELECT "contactId", min("createdAt") AS premiere_demande FROM demandes GROUP BY "contactId"
    ),
    par_contact AS (
      SELECT s."contactId",
        bool_or(s."fromMe" AND s.status = 'FAILED' AND s.source IS DISTINCT FROM 'broadcast') AS envoi_echoue,
        bool_or(s."senderType" = 'AGENT' AND s.source IS DISTINCT FROM 'broadcast') AS message_equipe,
        max(s."createdAt") FILTER (
          WHERE s."senderType" = 'BOT' AND s.status IN ('SENT', 'DELIVERED', 'READ')
        ) AS derniere_reponse_ia
      FROM semaine s GROUP BY s."contactId"
    ),
    generation_echouee AS (
      SELECT DISTINCT d."contactId" FROM demandes d JOIN ai_job j ON j."messageId" = d.id
      WHERE j.state = 'FAILED'
         OR (j.state = 'CANCELLED' AND j."errorCode" NOT IN ('AI_MERGED', 'AI_STATE_CHANGED'))
    ),
    reprises AS (
      SELECT DISTINCT e."contactId" FROM contact_event e
      WHERE e."projectId" = ${projectId} AND e."createdAt" >= ${start} AND e."createdAt" < ${end}
        AND e.type IN ('AI_PAUSED', 'AI_PAUSED_BY_REPLY', 'AI_PAUSED_FROM_PHONE')
    ),
    questions AS (
      SELECT DISTINCT g."contactId" FROM knowledge_gap g
      WHERE g."projectId" = ${projectId} AND g."createdAt" >= ${start} AND g."createdAt" < ${end}
        AND g."contactId" IS NOT NULL
    ),
    issues AS (
      SELECT c."contactId",
        CASE
          WHEN p.envoi_echoue OR ge."contactId" IS NOT NULL THEN 'echec'
          WHEN p.message_equipe OR r."contactId" IS NOT NULL THEN 'reprise'
          WHEN q."contactId" IS NOT NULL THEN 'question'
          WHEN p.derniere_reponse_ia IS NULL OR p.derniere_reponse_ia < c.premiere_demande THEN 'sans_reponse'
          ELSE 'autonome'
        END AS issue
      FROM conversations c
      JOIN par_contact p USING ("contactId")
      LEFT JOIN generation_echouee ge USING ("contactId")
      LEFT JOIN reprises r USING ("contactId")
      LEFT JOIN questions q USING ("contactId")
    ),
    motifs AS (
      SELECT (
        SELECT e.type::text FROM contact_event e
        WHERE e."projectId" = ${projectId} AND e."contactId" = i."contactId"
          AND e."createdAt" >= ${start} AND e."createdAt" < ${end}
          AND e.type IN ('AI_PAUSED', 'AI_PAUSED_BY_REPLY', 'AI_PAUSED_FROM_PHONE')
        ORDER BY e."createdAt" LIMIT 1
      ) AS motif
      FROM issues i WHERE i.issue = 'reprise'
    ),
    premieres AS (
      SELECT DISTINCT ON (c."contactId") r."senderType",
        extract(epoch FROM COALESCE(o."finishedAt", r."createdAt") - c.premiere_demande)::float8 AS delai
      FROM conversations c
      JOIN message r ON r."projectId" = ${projectId} AND r."contactId" = c."contactId"
        AND r."createdAt" > c.premiere_demande AND r."createdAt" < ${end}
        AND r."fromMe" AND r.status IN ('SENT', 'DELIVERED', 'READ')
        AND r.source IS DISTINCT FROM 'broadcast'
      LEFT JOIN outbound_job o ON o."messageId" = r.id
      ORDER BY c."contactId", r."createdAt", r.id
    )
    SELECT
      (SELECT count(*) FROM issues)::int AS conversations,
      (SELECT count(*) FROM issues WHERE issue = 'echec')::int AS failed,
      (SELECT count(*) FROM issues WHERE issue = 'reprise')::int AS handover,
      (SELECT count(*) FROM issues WHERE issue = 'question')::int AS gap,
      (SELECT count(*) FROM issues WHERE issue = 'sans_reponse')::int AS unanswered,
      (SELECT count(*) FROM issues WHERE issue = 'autonome')::int AS autonomous,
      (SELECT count(*) FROM motifs WHERE motif = 'AI_PAUSED_BY_REPLY')::int AS app,
      (SELECT count(*) FROM motifs WHERE motif = 'AI_PAUSED_FROM_PHONE')::int AS phone,
      (SELECT count(*) FROM motifs WHERE motif = 'AI_PAUSED')::int AS manual,
      (SELECT count(*) FROM motifs WHERE motif IS NULL)::int AS already_paused,
      (SELECT count(*) FROM premieres WHERE "senderType" = 'BOT')::int AS ai_n,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY delai) FROM premieres WHERE "senderType" = 'BOT') AS ai_median,
      (SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY delai) FROM premieres WHERE "senderType" = 'BOT') AS ai_p90,
      (SELECT count(*) FROM premieres WHERE "senderType" = 'AGENT')::int AS team_n,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY delai) FROM premieres WHERE "senderType" = 'AGENT') AS team_median,
      (SELECT percentile_cont(0.9) WITHIN GROUP (ORDER BY delai) FROM premieres WHERE "senderType" = 'AGENT') AS team_p90`;
  return row;
}

async function weekCounts(db: Db, projectId: string, start: Date, end: Date) {
  const [row] = await db.$queryRaw<Record<string, unknown>[]>`
    SELECT
      (SELECT count(*) FROM knowledge_gap g
        WHERE g."projectId" = ${projectId} AND g."createdAt" >= ${start} AND g."createdAt" < ${end})::int AS gaps_new,
      (SELECT count(*) FROM knowledge_gap g
        WHERE g."projectId" = ${projectId} AND g."createdAt" < ${end}
          AND (g."resolvedAt" IS NULL OR g."resolvedAt" >= ${end}))::int AS gaps_open,
      (SELECT count(*) FROM csat_survey s
        WHERE s."projectId" = ${projectId} AND s."sentAt" >= ${start} AND s."sentAt" < ${end})::int AS csat_sent,
      (SELECT count(*) FROM csat_survey s
        WHERE s."projectId" = ${projectId} AND s."sentAt" >= ${start} AND s."sentAt" < ${end}
          AND s."respondedAt" < ${end} AND s.score IS NOT NULL)::int AS csat_responses,
      (SELECT avg(s.score)::float8 FROM csat_survey s
        WHERE s."projectId" = ${projectId} AND s."sentAt" >= ${start} AND s."sentAt" < ${end}
          AND s."respondedAt" < ${end} AND s.score IS NOT NULL) AS csat_mean,
      (SELECT count(*) FROM csat_survey s
        WHERE s."projectId" = ${projectId} AND s."sentAt" >= ${start} AND s."sentAt" < ${end}
          AND s."respondedAt" < ${end} AND s.score <= 2)::int AS csat_low,
      (SELECT count(*) FROM ai_feedback f
        WHERE f."projectId" = ${projectId} AND f."createdAt" >= ${start} AND f."createdAt" < ${end})::int AS votes,
      (SELECT count(*) FROM ai_feedback f
        WHERE f."projectId" = ${projectId} AND f."createdAt" >= ${start} AND f."createdAt" < ${end}
          AND f.rating = 'DOWN')::int AS votes_down,
      (SELECT count(*) FROM message m
        WHERE m."projectId" = ${projectId} AND m."createdAt" >= ${start} AND m."createdAt" < ${end}
          AND m."fromMe" AND m.status IN ('SENT', 'DELIVERED', 'READ', 'FAILED'))::int AS attempted,
      (SELECT count(*) FROM message m
        WHERE m."projectId" = ${projectId} AND m."createdAt" >= ${start} AND m."createdAt" < ${end}
          AND m."fromMe" AND m.status = 'FAILED')::int AS send_failed,
      (SELECT count(*) FROM message m
        WHERE m."projectId" = ${projectId} AND m."createdAt" >= ${start} AND m."createdAt" < ${end}
          AND m."fromMe" AND m.status = 'FAILED' AND m.source = 'broadcast')::int AS broadcast_failed,
      (SELECT count(*) FROM message m JOIN ai_job j ON j."messageId" = m.id
        WHERE m."projectId" = ${projectId} AND m."createdAt" >= ${start} AND m."createdAt" < ${end}
          AND (j.state = 'FAILED'
            OR (j.state = 'CANCELLED' AND j."errorCode" NOT IN ('AI_MERGED', 'AI_STATE_CHANGED'))))::int AS ai_failed,
      (SELECT count(*) FROM settings_audit a
        WHERE a."projectId" = ${projectId} AND a."createdAt" >= ${start} AND a."createdAt" < ${end}
          AND a.action = 'agent.updated')::int AS agent_updates,
      (SELECT count(*) FROM message m
        WHERE m."projectId" = ${projectId} AND m."createdAt" >= ${start} AND m."createdAt" < ${end}
          AND m.source = 'broadcast')::int AS broadcast_recipients`;
  return row;
}

async function waitingAtClose(db: Db, projectId: string, end: Date) {
  const since = new Date(end.getTime() - 14 * 86_400_000);
  const hourBefore = new Date(end.getTime() - 3_600_000);
  const dayBefore = new Date(end.getTime() - 86_400_000);
  const [row] = await db.$queryRaw<Record<string, unknown>[]>`
    WITH derniers AS (
      SELECT DISTINCT ON (m."contactId") m."contactId", m."senderType", m."fromMe", m."createdAt"
      FROM message m
      WHERE m."projectId" = ${projectId} AND m."createdAt" >= ${since} AND m."createdAt" < ${end}
        AND m.source IS DISTINCT FROM 'broadcast'
        AND (m."senderType" <> 'CLIENT' OR m."aiSkip" IS NULL OR m."aiSkip" = 'MERGED')
        AND NOT EXISTS (SELECT 1 FROM csat_survey q WHERE q."responseMessageId" = m.id)
      ORDER BY m."contactId", m."createdAt" DESC, m.id DESC
    )
    SELECT count(*)::int AS total,
      count(*) FILTER (WHERE d."createdAt" < ${dayBefore})::int AS over24h,
      count(*) FILTER (WHERE NOT c."aiActive")::int AS manual
    FROM derniers d
    JOIN contact c ON c.id = d."contactId" AND c."projectId" = ${projectId}
    WHERE d."senderType" = 'CLIENT' AND NOT d."fromMe" AND d."createdAt" < ${hourBefore}
      AND (c."resolvedAt" IS NULL OR c."resolvedAt" >= ${end})`;
  return row;
}

export async function collectWeekAggregate(
  db: Db,
  projectId: string,
  start: Date,
  end: Date,
  legacy: ReportMetrics,
): Promise<WeekAggregate> {
  const c = await conversationStats(db, projectId, start, end);
  const w = await weekCounts(db, projectId, start, end);
  const q = await waitingAtClose(db, projectId, end);
  const n = toNumber;
  const mean =
    w.csat_mean === null || w.csat_mean === undefined
      ? null
      : Number(w.csat_mean);
  return {
    weekStart: start,
    weekEnd: end,
    conversations: n(c.conversations),
    outcome: {
      failed: n(c.failed),
      handover: n(c.handover),
      gap: n(c.gap),
      unanswered: n(c.unanswered),
      autonomous: n(c.autonomous),
    },
    handoverReasons: {
      app: n(c.app),
      phone: n(c.phone),
      manual: n(c.manual),
      alreadyPaused: n(c.already_paused),
    },
    gapsNew: n(w.gaps_new),
    gapsOpenAtClose: n(w.gaps_open),
    gapTopics: [],
    aiReply: { n: n(c.ai_n), median: n(c.ai_median), p90: n(c.ai_p90) },
    teamReply: { n: n(c.team_n), median: n(c.team_median), p90: n(c.team_p90) },
    csat: {
      sent: n(w.csat_sent),
      responses: n(w.csat_responses),
      mean,
      low: n(w.csat_low),
    },
    feedback: { votes: n(w.votes), down: n(w.votes_down) },
    sends: {
      attempted: n(w.attempted),
      failed: n(w.send_failed),
      broadcastFailed: n(w.broadcast_failed),
    },
    aiJobsFailed: n(w.ai_failed),
    waiting: { total: n(q.total), over24h: n(q.over24h), manual: n(q.manual) },
    annotations: {
      agentUpdates: n(w.agent_updates),
      broadcastRecipients: n(w.broadcast_recipients),
    },
    legacy,
  };
}
