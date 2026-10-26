import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import {
  AudienceSchema,
  BroadcastDraftSchema,
  BROADCAST_LIMITS,
  localDayStart,
  nextPace,
  nextSendingWindow,
  renderBroadcast,
  tomorrowWindow,
  type Audience,
  type RecipientFilter,
} from "./broadcast-shared";
import { chatContactName } from "./chat-privacy";
import { maskContactPhone } from "./contact-details";
import { MessageQuotaError, reserveMessageQuota } from "./message-quota";
import { planAllows, planFeatures, planUpgradeMessage } from "./plan-features";
import { projectBillingStatus } from "./project-status";
import { can } from "./project-permissions";

// Safe to show as is to the user.
export class BroadcastError extends Error {}

type Db = PrismaClient | Prisma.TransactionClient;

const ACTIVE_STATUSES = ["SCHEDULED", "SENDING", "PAUSED"] as const;

/** Audit trail of a broadcast; a null actor is an automatic decision. */
async function logEvent(
  tx: Prisma.TransactionClient,
  broadcastId: string,
  type: "CREATED" | "STARTED" | "PAUSED" | "RESUMED" | "CANCELLED" | "COMPLETED",
  actorId: string | null = null,
  detail: string | null = null,
) {
  await tx.broadcastEvent.create({ data: { broadcastId, type, actorId, detail } });
}

/**
 * Owners and administrators. Creating or resuming needs a plan with broadcasts;
 * pausing or cancelling stays possible after a downgrade, to stop a broadcast.
 */
async function requireBroadcastAdmin(db: Db, projectId: string, userId: string, needsPlan = true) {
  const membership = await db.projectMembership.findUnique({
    where: { userId_projectId: { userId, projectId } },
    include: { project: true },
  });
  if (!membership || membership.project.deletionPending) {
    throw new BroadcastError("Projet indisponible.");
  }
  if (!can(membership.role, "project.manage")) {
    throw new BroadcastError("Seuls les propriétaires et administrateurs gèrent les diffusions.");
  }
  if (needsPlan && !planAllows(membership.project.plan, "broadcast")) {
    throw new BroadcastError(planUpgradeMessage("broadcast"));
  }
  return membership.project;
}

/**
 * Only people who already wrote to the business: implicit consent, and the
 * safest audience for a WhatsApp number. Unsubscribed contacts never qualify.
 */
export function audienceWhere(projectId: string, audience: Audience, now: Date): Prisma.ContactWhereInput {
  return {
    projectId,
    broadcastOptOutAt: null,
    messages: {
      some: {
        senderType: "CLIENT",
        fromMe: false,
        ...(audience.activeWithinDays
          ? { createdAt: { gte: new Date(now.getTime() - audience.activeWithinDays * 86_400_000) } }
          : {}),
      },
    },
    ...(audience.tagIds.length ? { tags: { some: { tagId: { in: audience.tagIds } } } } : {}),
    ...(audience.stages.length ? { pipelineStage: { in: audience.stages } } : {}),
  };
}

async function currentPeriod(db: Db, projectId: string, now: Date) {
  return db.quotaPeriod.findFirst({
    where: { projectId, isCurrent: true, startsAt: { lte: now }, endsAt: { gt: now } },
    orderBy: { startsAt: "desc" },
  });
}

/** Broadcast messages sent this billing period and today, against the plan limits. */
export async function broadcastUsage(db: Db, projectId: string, plan: unknown, now = new Date()) {
  const features = planFeatures(plan);
  const period = await currentPeriod(db, projectId, now);
  const periodStart = period?.startsAt ?? new Date(now.getTime() - 30 * 86_400_000);
  const [monthly, daily, reserved] = await Promise.all([
    db.message.count({ where: { projectId, source: "broadcast", createdAt: { gte: periodStart } } }),
    db.message.count({ where: { projectId, source: "broadcast", createdAt: { gte: localDayStart(now) } } }),
    // Recipients still waiting in an active broadcast are already promised.
    db.broadcastRecipient.count({
      where: { state: "PENDING", broadcast: { projectId, status: { in: [...ACTIVE_STATUSES] } } },
    }),
  ]);
  return {
    monthly: { used: monthly, reserved, limit: features.broadcastMonthly },
    daily: { used: daily, limit: features.broadcastDaily },
    recipientsLimit: features.broadcastRecipients,
    quota: period ? { used: period.used, limit: period.limit } : null,
  };
}

/** Live count for the composer, without creating anything. */
export async function estimateAudience(
  db: PrismaClient,
  input: { projectId: string; userId: string; audience: unknown },
) {
  const project = await requireBroadcastAdmin(db, input.projectId, input.userId);
  const audience = AudienceSchema.parse(input.audience);
  const now = new Date();
  const [count, optedOut] = await Promise.all([
    db.contact.count({ where: audienceWhere(input.projectId, audience, now) }),
    db.contact.count({
      where: { ...audienceWhere(input.projectId, audience, now), broadcastOptOutAt: { not: null } },
    }),
  ]);
  return { count, optedOut, limit: planFeatures(project.plan).broadcastRecipients };
}

export type BroadcastInput = {
  projectId: string;
  userId: string;
  requestId: string;
  name: string;
  content: string;
  nameFallback?: string;
  audience: unknown;
  /** Null: as soon as possible (within business hours). */
  scheduledAt: Date | null;
  media?: { key: string; type: "IMAGE" } | null;
};

export async function createBroadcast(db: PrismaClient, input: BroadcastInput) {
  const draft = BroadcastDraftSchema.parse(input);
  const audience = AudienceSchema.parse(input.audience);
  return db.$transaction(
    async (tx) => {
      // Same lock as every send: limits and quota are checked without race.
      const [locked] = await tx.$queryRaw<Array<{ now: Date }>>`
        SELECT clock_timestamp() AS now FROM project WHERE id = ${input.projectId} FOR UPDATE`;
      if (!locked) throw new BroadcastError("Projet indisponible.");
      const { now } = locked;
      const project = await requireBroadcastAdmin(tx, input.projectId, input.userId);

      const existing = await tx.broadcast.findUnique({ where: { requestId: input.requestId } });
      if (existing) {
        if (existing.projectId !== input.projectId || existing.createdById !== input.userId) {
          throw new BroadcastError("Cet identifiant de demande a déjà été utilisé.");
        }
        return existing;
      }

      const scheduledAt = input.scheduledAt ?? now;
      if (scheduledAt.getTime() > now.getTime() + BROADCAST_LIMITS.scheduleMaxDays * 86_400_000) {
        throw new BroadcastError(`Programmez la diffusion dans les ${BROADCAST_LIMITS.scheduleMaxDays} prochains jours.`);
      }
      if (scheduledAt.getTime() < now.getTime() - 5 * 60_000) {
        throw new BroadcastError("La date d’envoi est déjà passée.");
      }

      const active = await tx.broadcast.findFirst({
        where: { projectId: input.projectId, status: { in: [...ACTIVE_STATUSES] } },
        select: { name: true },
      });
      if (active) {
        throw new BroadcastError(
          `« ${active.name} » est encore en cours. Une seule diffusion à la fois protège votre numéro : attendez sa fin ou annulez-la.`,
        );
      }

      const contacts = await tx.contact.findMany({
        where: audienceWhere(input.projectId, audience, now),
        select: { id: true },
        orderBy: { id: "asc" },
      });
      if (!contacts.length) {
        throw new BroadcastError("Aucun contact ne correspond à ces critères.");
      }
      const usage = await broadcastUsage(tx, input.projectId, project.plan, now);
      if (contacts.length > usage.recipientsLimit) {
        throw new BroadcastError(
          `${contacts.length.toLocaleString("fr-FR")} contacts correspondent : votre offre permet ${usage.recipientsLimit.toLocaleString("fr-FR")} contacts par diffusion. Affinez le ciblage.`,
        );
      }
      const monthlyLeft = usage.monthly.limit - usage.monthly.used - usage.monthly.reserved;
      if (contacts.length > monthlyLeft) {
        throw new BroadcastError(
          `Il vous reste ${Math.max(0, monthlyLeft).toLocaleString("fr-FR")} messages de diffusion ce mois-ci pour ${contacts.length.toLocaleString("fr-FR")} contacts ciblés.`,
        );
      }
      if (usage.quota && contacts.length > usage.quota.limit - usage.quota.used) {
        throw new BroadcastError(
          `Votre quota de messages ne suffit pas : ${Math.max(0, usage.quota.limit - usage.quota.used).toLocaleString("fr-FR")} restants pour ${contacts.length.toLocaleString("fr-FR")} contacts.`,
        );
      }

      const broadcast = await tx.broadcast.create({
        data: {
          projectId: input.projectId,
          createdById: input.userId,
          requestId: input.requestId,
          name: draft.name,
          content: draft.content,
          nameFallback: draft.nameFallback,
          mediaUrl: input.media?.key ?? null,
          mediaType: input.media?.type ?? null,
          audience,
          scheduledAt,
          nextSendAt: scheduledAt,
          recipientCount: contacts.length,
        },
      });
      await tx.broadcastRecipient.createMany({
        data: contacts.map((contact) => ({ broadcastId: broadcast.id, contactId: contact.id })),
      });
      await logEvent(tx, broadcast.id, "CREATED", input.userId, input.scheduledAt ? "SCHEDULED" : null);
      return broadcast;
    },
    { timeout: 30_000, maxWait: 10_000 },
  );
}

async function lockBroadcast(tx: Prisma.TransactionClient, input: { projectId: string; broadcastId: string }) {
  const [row] = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM broadcast WHERE id = ${input.broadcastId} AND "projectId" = ${input.projectId} FOR UPDATE`;
  if (!row) throw new BroadcastError("Diffusion introuvable.");
  return tx.broadcast.findUniqueOrThrow({ where: { id: row.id } });
}

type BroadcastAction = { projectId: string; userId: string; broadcastId: string };

export async function pauseBroadcast(db: PrismaClient, input: BroadcastAction) {
  return db.$transaction(async (tx) => {
    await requireBroadcastAdmin(tx, input.projectId, input.userId, false);
    const broadcast = await lockBroadcast(tx, input);
    if (!["SCHEDULED", "SENDING"].includes(broadcast.status)) {
      throw new BroadcastError("Cette diffusion ne peut pas être mise en pause.");
    }
    await logEvent(tx, broadcast.id, "PAUSED", input.userId, "MANUAL");
    return tx.broadcast.update({
      where: { id: broadcast.id },
      data: { status: "PAUSED", pauseReason: "MANUAL" },
    });
  });
}

export async function resumeBroadcast(db: PrismaClient, input: BroadcastAction) {
  return db.$transaction(async (tx) => {
    await requireBroadcastAdmin(tx, input.projectId, input.userId);
    const broadcast = await lockBroadcast(tx, input);
    if (broadcast.status !== "PAUSED") throw new BroadcastError("Cette diffusion n’est pas en pause.");
    const author = broadcast.createdById
      ? await tx.projectMembership.findUnique({
          where: { userId_projectId: { userId: broadcast.createdById, projectId: input.projectId } },
          select: { id: true },
        })
      : null;
    const now = new Date();
    await logEvent(tx, broadcast.id, "RESUMED", input.userId, author ? null : "TAKEN_OVER");
    return tx.broadcast.update({
      where: { id: broadcast.id },
      data: {
        status: broadcast.startedAt ? "SENDING" : "SCHEDULED",
        pauseReason: null,
        nextSendAt: broadcast.scheduledAt > now ? broadcast.scheduledAt : now,
        // Messages leave on behalf of a current member: whoever resumes takes over.
        ...(author ? {} : { createdById: input.userId }),
      },
    });
  });
}

export async function cancelBroadcast(db: PrismaClient, input: BroadcastAction) {
  return db.$transaction(async (tx) => {
    await requireBroadcastAdmin(tx, input.projectId, input.userId, false);
    const broadcast = await lockBroadcast(tx, input);
    if (!ACTIVE_STATUSES.includes(broadcast.status as (typeof ACTIVE_STATUSES)[number])) {
      throw new BroadcastError("Cette diffusion est déjà terminée.");
    }
    await tx.broadcastRecipient.updateMany({
      where: { broadcastId: broadcast.id, state: "PENDING" },
      data: { state: "SKIPPED", skipReason: "CANCELLED" },
    });
    await logEvent(tx, broadcast.id, "CANCELLED", input.userId);
    return tx.broadcast.update({
      where: { id: broadcast.id },
      data: { status: "CANCELLED", pauseReason: null, finishedAt: new Date() },
    });
  });
}

export type TickResult = { projectId: string; broadcastId: string; sent: boolean } | null;

/**
 * Sends at most one message of the most overdue broadcast. The message joins
 * the regular outbound queue one at a time, so conversations of every project
 * never wait behind a broadcast. Called in a loop by the outbound worker.
 */
export async function runBroadcastTick(
  db: PrismaClient,
  options: { now?: Date; random?: () => number } = {},
): Promise<TickResult> {
  return db.$transaction(async (tx) => {
    const now = options.now ?? new Date();
    const [candidate] = await tx.$queryRaw<Array<{ id: string; projectId: string }>>`
      SELECT id, "projectId" FROM broadcast
      WHERE status IN ('SCHEDULED', 'SENDING') AND "nextSendAt" <= ${now}
      ORDER BY "nextSendAt", id
      LIMIT 1
      FOR UPDATE SKIP LOCKED`;
    if (!candidate) return null;
    // Lock order shared with every send: broadcast, then project, then contact.
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${candidate.projectId} FOR UPDATE`;
    const broadcast = await tx.broadcast.findUniqueOrThrow({
      where: { id: candidate.id },
      include: { project: true },
    });
    const { project } = broadcast;
    const result = (sent: boolean): TickResult => ({ projectId: project.id, broadcastId: broadcast.id, sent });
    const pause = async (reason: string) => {
      await tx.broadcast.update({ where: { id: broadcast.id }, data: { status: "PAUSED", pauseReason: reason } });
      await logEvent(tx, broadcast.id, "PAUSED", null, reason);
      return result(false);
    };
    const wait = async (until: Date, reason: string) => {
      await tx.broadcast.update({ where: { id: broadcast.id }, data: { nextSendAt: until, pauseReason: reason } });
      return result(false);
    };

    if (project.deletionPending) {
      await tx.broadcast.update({
        where: { id: broadcast.id },
        data: { status: "CANCELLED", finishedAt: now },
      });
      return result(false);
    }
    if (!planAllows(project.plan, "broadcast")) return pause("PLAN");
    if (project.automationPaused) return pause("PROJECT_PAUSED");
    if (!["active", "trialing"].includes(projectBillingStatus(project))) return pause("PROJECT_INACTIVE");
    const author = broadcast.createdById
      ? await tx.projectMembership.findUnique({
          where: { userId_projectId: { userId: broadcast.createdById, projectId: project.id } },
          select: { id: true },
        })
      : null;
    if (!author) return pause("AUTHOR_LEFT");
    if (project.instanceStatus !== "connected" || !project.instanceName) {
      return wait(new Date(now.getTime() + 60_000), "DISCONNECTED");
    }
    const opening = nextSendingWindow(now);
    if (opening > now) return wait(opening, "OUTSIDE_WINDOW");

    const features = planFeatures(project.plan);
    const period = await currentPeriod(tx, project.id, now);
    const [monthly, daily] = await Promise.all([
      tx.message.count({
        where: {
          projectId: project.id,
          source: "broadcast",
          createdAt: { gte: period?.startsAt ?? new Date(now.getTime() - 30 * 86_400_000) },
        },
      }),
      tx.message.count({ where: { projectId: project.id, source: "broadcast", createdAt: { gte: localDayStart(now) } } }),
    ]);
    if (monthly >= features.broadcastMonthly) return pause("MONTHLY_LIMIT");
    if (daily >= features.broadcastDaily) return wait(tomorrowWindow(now), "DAILY_LIMIT");

    const [next] = await tx.$queryRaw<Array<{ id: string; contactId: string }>>`
      SELECT id, "contactId" FROM broadcast_recipient
      WHERE "broadcastId" = ${broadcast.id} AND state = 'PENDING'
      ORDER BY id
      LIMIT 1
      FOR UPDATE SKIP LOCKED`;
    if (!next) {
      await tx.broadcast.update({
        where: { id: broadcast.id },
        data: { status: "COMPLETED", pauseReason: null, finishedAt: now },
      });
      await logEvent(tx, broadcast.id, "COMPLETED");
      return result(false);
    }
    await tx.$queryRaw`SELECT id FROM contact WHERE id = ${next.contactId} FOR UPDATE`;
    const contact = await tx.contact.findUnique({ where: { id: next.contactId } });
    if (!contact || contact.projectId !== project.id || contact.broadcastOptOutAt) {
      await tx.broadcastRecipient.update({
        where: { id: next.id },
        data: { state: "SKIPPED", skipReason: "OPTED_OUT" },
      });
      // No message left: the next recipient may go right away.
      return result(false);
    }

    let quota: Awaited<ReturnType<typeof reserveMessageQuota>>;
    try {
      quota = await reserveMessageQuota(tx, project.id);
    } catch (error) {
      if (error instanceof MessageQuotaError) return pause(error.code);
      throw error;
    }
    const message = await tx.message.create({
      data: {
        projectId: project.id,
        contactId: contact.id,
        agentId: broadcast.createdById,
        content: renderBroadcast(broadcast.content, contact, broadcast.nameFallback),
        senderType: "AGENT",
        status: "PENDING",
        type: broadcast.mediaType ?? "TEXT",
        mediaUrl: broadcast.mediaUrl,
        fromMe: true,
        source: "broadcast",
      },
    });
    await tx.outboundJob.create({
      data: {
        projectId: project.id,
        messageId: message.id,
        requestId: randomUUID(),
        quotaPeriodId: quota.quotaPeriodId,
      },
    });
    await tx.broadcastRecipient.update({
      where: { id: next.id },
      data: { state: "QUEUED", messageId: message.id, queuedAt: now },
    });
    if (!broadcast.startedAt) await logEvent(tx, broadcast.id, "STARTED");
    // The AI keeps its state: replies are handled as in any conversation.
    await tx.contact.update({ where: { id: contact.id }, data: { lastMessageAt: message.createdAt } });
    await tx.broadcast.update({
      where: { id: broadcast.id },
      data: {
        status: "SENDING",
        startedAt: broadcast.startedAt ?? now,
        pauseReason: null,
        nextSendAt: nextPace(now, options.random),
      },
    });
    return result(true);
  });
}

export type BroadcastStats = {
  total: number;
  pending: number;
  skipped: number;
  queued: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
  replied: number;
};

/** Delivery, reads and replies within 7 days, for a list of broadcasts. */
export async function broadcastStats(db: Db, broadcastIds: string[]) {
  const stats = new Map<string, BroadcastStats>();
  if (!broadcastIds.length) return stats;
  const rows = await db.$queryRaw<Array<{ broadcastId: string } & Record<keyof BroadcastStats, number>>>`
    SELECT r."broadcastId",
      count(*)::int AS total,
      count(*) FILTER (WHERE r.state = 'PENDING')::int AS pending,
      count(*) FILTER (WHERE r.state = 'SKIPPED')::int AS skipped,
      count(*) FILTER (WHERE r.state = 'QUEUED')::int AS queued,
      count(*) FILTER (WHERE m.status IN ('SENT', 'DELIVERED', 'READ'))::int AS sent,
      count(*) FILTER (WHERE m.status IN ('DELIVERED', 'READ'))::int AS delivered,
      count(*) FILTER (WHERE m.status = 'READ')::int AS read,
      count(*) FILTER (WHERE m.status = 'FAILED')::int AS failed,
      count(*) FILTER (WHERE r."queuedAt" IS NOT NULL AND EXISTS (
        SELECT 1 FROM message c
        WHERE c."contactId" = r."contactId" AND c."senderType" = 'CLIENT' AND c."fromMe" = false
          AND c."createdAt" > r."queuedAt" AND c."createdAt" < r."queuedAt" + interval '7 days'
      ))::int AS replied
    FROM broadcast_recipient r
    LEFT JOIN message m ON m.id = r."messageId"
    WHERE r."broadcastId" = ANY(${broadcastIds})
    GROUP BY r."broadcastId"`;
  for (const { broadcastId, ...row } of rows) stats.set(broadcastId, row);
  return stats;
}

export async function listBroadcasts(db: PrismaClient, projectId: string) {
  const broadcasts = await db.broadcast.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { createdBy: { select: { name: true } } },
  });
  const stats = await broadcastStats(db, broadcasts.map((broadcast) => broadcast.id));
  return broadcasts.map((broadcast) => ({ ...broadcast, stats: stats.get(broadcast.id) ?? null }));
}

/** Recipients of one broadcast, 50 at a time, with what happened to each. */
export async function broadcastRecipients(
  db: PrismaClient,
  input: { projectId: string; broadcastId: string; cursor?: string | null },
) {
  const rows = await db.broadcastRecipient.findMany({
    where: { broadcastId: input.broadcastId, broadcast: { projectId: input.projectId } },
    orderBy: { id: "asc" },
    take: 51,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    include: {
      contact: { select: { id: true, name: true, pushName: true, phone: true } },
      message: { select: { status: true, createdAt: true } },
    },
  });
  return { rows: rows.slice(0, 50), nextCursor: rows.length > 50 ? rows[49].id : null };
}

/**
 * STOP unsubscribes from broadcasts, START subscribes back. Journaled in the
 * conversation; called by the ingestion inside its transaction.
 */
export async function applyBroadcastKeyword(
  tx: Prisma.TransactionClient,
  contact: { id: string; projectId: string; broadcastOptOutAt: Date | null },
  keyword: "OPT_OUT" | "OPT_IN",
) {
  if (keyword === "OPT_OUT" && !contact.broadcastOptOutAt) {
    await tx.contact.update({ where: { id: contact.id }, data: { broadcastOptOutAt: new Date() } });
    await tx.contactEvent.create({
      data: { projectId: contact.projectId, contactId: contact.id, type: "BROADCAST_OPT_OUT" },
    });
    return true;
  }
  if (keyword === "OPT_IN" && contact.broadcastOptOutAt) {
    await tx.contact.update({ where: { id: contact.id }, data: { broadcastOptOutAt: null } });
    await tx.contactEvent.create({
      data: { projectId: contact.projectId, contactId: contact.id, type: "BROADCAST_OPT_IN" },
    });
    return true;
  }
  return false;
}

/** Recipients of a page who answered within 7 days of their message. */
export async function repliedRecipientIds(db: Db, recipientIds: string[]) {
  if (!recipientIds.length) return new Set<string>();
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT r.id FROM broadcast_recipient r
    WHERE r.id = ANY(${recipientIds}) AND r."queuedAt" IS NOT NULL AND EXISTS (
      SELECT 1 FROM message c
      WHERE c."contactId" = r."contactId" AND c."senderType" = 'CLIENT' AND c."fromMe" = false
        AND c."createdAt" > r."queuedAt" AND c."createdAt" < r."queuedAt" + interval '7 days'
    )`;
  return new Set(rows.map((row) => row.id));
}

/** Members who handle conversations read broadcasts; managing them stays reserved to administrators. */
export async function requireBroadcastViewer(db: Db, projectId: string, userId: string) {
  const membership = await db.projectMembership.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { role: true, project: { select: { deletionPending: true, plan: true } } },
  });
  // Same answer for « no access » and « does not exist »: nothing leaks.
  if (
    !membership ||
    membership.project.deletionPending ||
    !can(membership.role, "pipeline.view")
  )
    throw new BroadcastError("Diffusion introuvable.");
  return membership;
}

async function requireBroadcast(db: Db, input: { projectId: string; userId: string; broadcastId: string }) {
  await requireBroadcastViewer(db, input.projectId, input.userId);
  const broadcast = await db.broadcast.findFirst({
    where: { id: input.broadcastId, projectId: input.projectId },
    select: { id: true, mediaUrl: true },
  });
  if (!broadcast) throw new BroadcastError("Diffusion introuvable.");
  return broadcast;
}

type Person = { name: string | null; pushName: string | null; phone: string | null };

/** What the browser may know about a contact: a display name and a masked number. */
function publicContact(contactId: string, person: Person) {
  return {
    id: contactId,
    name: chatContactName(person),
    maskedPhone: maskContactPhone(person.phone),
  };
}

export type PublicContact = ReturnType<typeof publicContact>;

export type RecipientRow = {
  id: string;
  contact: PublicContact;
  state: "PENDING" | "QUEUED" | "SKIPPED";
  skipReason: string | null;
  messageStatus: string | null;
  queuedAt: string | null;
  replied: boolean;
};

const PAGE_SIZE = 30;

/** Recipients of a broadcast, filtered and searched by name, 30 at a time. */
export async function listRecipients(
  db: Db,
  input: {
    projectId: string;
    userId: string;
    broadcastId: string;
    filter: RecipientFilter;
    query?: string;
    cursor?: string | null;
  },
) {
  await requireBroadcast(db, input);
  const query = (input.query ?? "").trim().slice(0, 60);
  const cursor = input.cursor ?? null;
  const rows = await db.$queryRaw<
    Array<
      Person & {
        id: string;
        contactId: string;
        state: RecipientRow["state"];
        skipReason: string | null;
        queuedAt: Date | null;
        messageStatus: string | null;
        replied: boolean;
      }
    >
  >`
    SELECT r.id, r."contactId", r.state::text AS state, r."skipReason", r."queuedAt",
      m.status::text AS "messageStatus", c.name, c."pushName", c.phone,
      (r."queuedAt" IS NOT NULL AND EXISTS (
        SELECT 1 FROM message reply
        WHERE reply."contactId" = r."contactId" AND reply."senderType" = 'CLIENT' AND reply."fromMe" = false
          AND reply."createdAt" > r."queuedAt" AND reply."createdAt" < r."queuedAt" + interval '7 days'
      )) AS replied
    FROM broadcast_recipient r
    JOIN contact c ON c.id = r."contactId"
    LEFT JOIN message m ON m.id = r."messageId"
    WHERE r."broadcastId" = ${input.broadcastId}
      AND (${cursor}::text IS NULL OR r.id > ${cursor})
      AND (${query} = ''
        OR strpos(lower(coalesce(c.name, '')), lower(${query})) > 0
        OR strpos(lower(coalesce(c."pushName", '')), lower(${query})) > 0)
      AND (
        ${input.filter} = 'all'
        OR (${input.filter} = 'pending' AND (r.state = 'PENDING' OR (r.state = 'QUEUED' AND m.status = 'PENDING')))
        OR (${input.filter} = 'sent' AND m.status = 'SENT')
        OR (${input.filter} = 'delivered' AND m.status = 'DELIVERED')
        OR (${input.filter} = 'read' AND m.status = 'READ')
        OR (${input.filter} = 'failed' AND r.state = 'QUEUED' AND (m.id IS NULL OR m.status = 'FAILED'))
        OR (${input.filter} = 'skipped' AND r.state = 'SKIPPED')
        OR (${input.filter} = 'replied' AND r."queuedAt" IS NOT NULL AND EXISTS (
          SELECT 1 FROM message reply
          WHERE reply."contactId" = r."contactId" AND reply."senderType" = 'CLIENT' AND reply."fromMe" = false
            AND reply."createdAt" > r."queuedAt" AND reply."createdAt" < r."queuedAt" + interval '7 days'
        ))
      )
    ORDER BY r.id
    LIMIT ${PAGE_SIZE + 1}`;
  const page = rows.slice(0, PAGE_SIZE);
  return {
    rows: page.map(
      (row): RecipientRow => ({
        id: row.id,
        contact: publicContact(row.contactId, row),
        state: row.state,
        skipReason: row.skipReason,
        messageStatus: row.messageStatus,
        queuedAt: row.queuedAt?.toISOString() ?? null,
        replied: row.replied,
      }),
    ),
    nextCursor: rows.length > PAGE_SIZE ? page.at(-1)!.id : null,
  };
}

/** Number of recipients behind each filter chip. */
export async function recipientFilterCounts(db: Db, broadcastId: string) {
  const [row] = await db.$queryRaw<Array<Record<RecipientFilter, number>>>`
    SELECT
      count(*)::int AS "all",
      count(*) FILTER (WHERE r.state = 'PENDING' OR (r.state = 'QUEUED' AND m.status = 'PENDING'))::int AS pending,
      count(*) FILTER (WHERE m.status = 'SENT')::int AS sent,
      count(*) FILTER (WHERE m.status = 'DELIVERED')::int AS delivered,
      count(*) FILTER (WHERE m.status = 'READ')::int AS read,
      count(*) FILTER (WHERE r.state = 'QUEUED' AND (m.id IS NULL OR m.status = 'FAILED'))::int AS failed,
      count(*) FILTER (WHERE r.state = 'SKIPPED')::int AS skipped,
      count(*) FILTER (WHERE r."queuedAt" IS NOT NULL AND EXISTS (
        SELECT 1 FROM message reply
        WHERE reply."contactId" = r."contactId" AND reply."senderType" = 'CLIENT' AND reply."fromMe" = false
          AND reply."createdAt" > r."queuedAt" AND reply."createdAt" < r."queuedAt" + interval '7 days'
      ))::int AS replied
    FROM broadcast_recipient r
    LEFT JOIN message m ON m.id = r."messageId"
    WHERE r."broadcastId" = ${broadcastId}`;
  return row;
}

export type ReplyRow = {
  id: string;
  contact: PublicContact;
  content: string;
  type: string;
  createdAt: string;
};

const ReplyCursor = z.object({ at: z.string().datetime(), id: z.string().cuid() });

/** Messages received in the 7 days after each broadcast message, newest first. */
export async function listReplies(
  db: Db,
  input: { projectId: string; userId: string; broadcastId: string; cursor?: string | null },
) {
  await requireBroadcast(db, input);
  let cursor: z.infer<typeof ReplyCursor> | null = null;
  if (input.cursor) {
    try {
      cursor = ReplyCursor.parse(JSON.parse(Buffer.from(input.cursor, "base64url").toString()));
    } catch {
      throw new BroadcastError("Page invalide.");
    }
  }
  const before = cursor ? new Date(cursor.at) : null;
  const beforeId = cursor?.id ?? null;
  const rows = await db.$queryRaw<
    Array<Person & { id: string; contactId: string; content: string; type: string; createdAt: Date }>
  >`
    SELECT reply.id, left(reply.content, 500) AS content, reply.type::text AS type, reply."createdAt",
      c.id AS "contactId", c.name, c."pushName", c.phone
    FROM broadcast_recipient r
    JOIN contact c ON c.id = r."contactId"
    JOIN message reply ON reply."contactId" = r."contactId"
      AND reply."senderType" = 'CLIENT' AND reply."fromMe" = false
      AND reply."createdAt" > r."queuedAt" AND reply."createdAt" < r."queuedAt" + interval '7 days'
    WHERE r."broadcastId" = ${input.broadcastId} AND r."queuedAt" IS NOT NULL
      AND (${before}::timestamp IS NULL OR (reply."createdAt", reply.id) < (${before}::timestamp, ${beforeId}::text))
    ORDER BY reply."createdAt" DESC, reply.id DESC
    LIMIT ${PAGE_SIZE + 1}`;
  const page = rows.slice(0, PAGE_SIZE);
  const last = page.at(-1);
  return {
    rows: page.map(
      (row): ReplyRow => ({
        id: row.id,
        contact: publicContact(row.contactId, row),
        content: row.content,
        type: row.type,
        createdAt: row.createdAt.toISOString(),
      }),
    ),
    nextCursor:
      rows.length > PAGE_SIZE && last
        ? Buffer.from(JSON.stringify({ at: last.createdAt.toISOString(), id: last.id })).toString("base64url")
        : null,
  };
}

export type OptOutRow = { contact: PublicContact; optedOutAt: string };

/** Contacts who answered STOP: read-only, only the client can subscribe back. */
export async function listOptedOut(
  db: PrismaClient,
  input: { projectId: string; userId: string; cursor?: string | null },
) {
  await requireBroadcastViewer(db, input.projectId, input.userId);
  const rows = await db.contact.findMany({
    where: { projectId: input.projectId, broadcastOptOutAt: { not: null } },
    orderBy: [{ broadcastOptOutAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: { id: true, name: true, pushName: true, phone: true, broadcastOptOutAt: true },
  });
  const page = rows.slice(0, PAGE_SIZE);
  return {
    rows: page.map(
      (row): OptOutRow => ({ contact: publicContact(row.id, row), optedOutAt: row.broadcastOptOutAt!.toISOString() }),
    ),
    nextCursor: rows.length > PAGE_SIZE ? page.at(-1)!.id : null,
  };
}

export async function broadcastTimeline(db: Db, broadcastId: string) {
  const events = await db.broadcastEvent.findMany({
    where: { broadcastId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 100,
    select: { id: true, type: true, detail: true, createdAt: true, actor: { select: { name: true } } },
  });
  return events.map((event) => ({
    id: event.id,
    type: event.type,
    detail: event.detail,
    createdAt: event.createdAt.toISOString(),
    actor: event.actor?.name?.trim().split(/\s+/)[0] ?? null,
  }));
}
export type TimelineEvent = Awaited<ReturnType<typeof broadcastTimeline>>[number];

/** Storage key of the broadcast image, after the same access check as the page. */
export async function broadcastImageKey(
  db: Db,
  input: { projectId: string; userId: string; broadcastId: string },
) {
  const broadcast = await requireBroadcast(db, input);
  if (!broadcast.mediaUrl) throw new BroadcastError("Diffusion introuvable.");
  return broadcast.mediaUrl;
}
