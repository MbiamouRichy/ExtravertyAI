"use server";

import prisma from "@/lib/prisma";
import { getAnalyticsAccess } from "@/lib/analytics-access";
import { isAnalyticsPeriod } from "@/lib/analytics";
import {
  PERIOD_DAYS,
  bucketKeyFor,
  bucketLabel,
  buildBucketKeys,
  computeDeltaPct,
  computeDeltaPts,
  getBucketMode,
  type AnalyticsOverview,
  type AnalyticsPeriod,
  type DiscussionPoint,
  type MessageStatusKey,
  type SourceDatum,
  type StatusDatum,
  type TopContactRow,
  type VolumePoint,
} from "@/lib/analytics";

const DAY_MS = 86_400_000;

const STATUS_ORDER: MessageStatusKey[] = [
  "READ",
  "DELIVERED",
  "SENT",
  "PENDING",
  "FAILED",
];

export async function getAnalyticsOverview(
  projectId: string,
  period: AnalyticsPeriod,
): Promise<AnalyticsOverview> {
  const access = await getAnalyticsAccess(projectId);

  if (access.status !== "authorized") {
    throw new Error("Accès aux statistiques indisponible.");
  }

  // Les annotations TypeScript ne valident pas les arguments à l'exécution.
  if (!isAnalyticsPeriod(period)) {
    throw new Error("Période invalide.");
  }

  const days = PERIOD_DAYS[period];
  const end = new Date();
  const start = new Date(end.getTime() - days * DAY_MS);
  const previousStart = new Date(start.getTime() - days * DAY_MS);

  const currentRange = { gte: start, lt: end };
  const previousRange = { gte: previousStart, lt: start };
  const sentSenderTypes: ("BOT" | "AGENT")[] = ["BOT", "AGENT"];

  // Requêtes exécutées en parallèle.
  // Il s'agit de plusieurs requêtes DB, pas d'un unique aller-retour SQL.
  const [
    messages,
    previousClientCount,
    previousBotCount,
    previousSentCount,
    newContacts,
    previousDiscussionsCount,
    activeContactsCount,
    previousActiveContactsCount,
    readCount,
    previousReadCount,
    statusGroups,
    sourceGroups,
    contactGroups,
    lastActivityGroups,
  ] = await Promise.all([
    prisma.message.findMany({
      where: { projectId, createdAt: currentRange },
      select: { createdAt: true, senderType: true },
    }),
    prisma.message.count({
      where: { projectId, senderType: "CLIENT", createdAt: previousRange },
    }),
    prisma.message.count({
      where: { projectId, senderType: "BOT", createdAt: previousRange },
    }),
    prisma.message.count({
      where: {
        projectId,
        senderType: { in: sentSenderTypes },
        createdAt: previousRange,
      },
    }),
    prisma.contact.findMany({
      where: { projectId, createdAt: currentRange },
      select: { createdAt: true },
    }),
    prisma.contact.count({ where: { projectId, createdAt: previousRange } }),
    prisma.contact.count({
      where: { projectId, messages: { some: { createdAt: currentRange } } },
    }),
    prisma.contact.count({
      where: { projectId, messages: { some: { createdAt: previousRange } } },
    }),
    prisma.message.count({
      where: {
        projectId,
        senderType: { in: sentSenderTypes },
        status: "READ",
        createdAt: currentRange,
      },
    }),
    prisma.message.count({
      where: {
        projectId,
        senderType: { in: sentSenderTypes },
        status: "READ",
        createdAt: previousRange,
      },
    }),
    prisma.message.groupBy({
      by: ["status"],
      where: {
        projectId,
        senderType: { in: sentSenderTypes },
        createdAt: currentRange,
      },
      _count: { _all: true },
    }),
    prisma.message.groupBy({
      by: ["source"],
      where: { projectId, senderType: "CLIENT", createdAt: currentRange },
      _count: { _all: true },
    }),
    prisma.message.groupBy({
      by: ["contactId", "senderType"],
      where: { projectId, createdAt: currentRange },
      _count: { _all: true },
    }),
    prisma.message.groupBy({
      by: ["contactId"],
      where: { projectId, createdAt: currentRange },
      _max: { createdAt: true },
    }),
  ]);

  // ------------------------------ KPIs ------------------------------
  const receivedCount = messages.filter(
    (m) => m.senderType === "CLIENT",
  ).length;
  const botCount = messages.filter((m) => m.senderType === "BOT").length;
  const sentCount = messages.filter(
    (message) => message.senderType === "BOT" || message.senderType === "AGENT",
  ).length;

  const readRate = sentCount > 0 ? (readCount / sentCount) * 100 : null;
  const previousReadRate =
    previousSentCount > 0
      ? (previousReadCount / previousSentCount) * 100
      : null;
  const aiAutonomy = sentCount > 0 ? (botCount / sentCount) * 100 : null;
  const previousAiAutonomy =
    previousSentCount > 0 ? (previousBotCount / previousSentCount) * 100 : null;

  const kpis: AnalyticsOverview["kpis"] = {
    received: {
      current: receivedCount,
      previous: previousClientCount,
      deltaPct: computeDeltaPct(receivedCount, previousClientCount),
    },
    sent: {
      current: sentCount,
      previous: previousSentCount,
      deltaPct: computeDeltaPct(sentCount, previousSentCount),
    },
    discussions: {
      current: newContacts.length,
      previous: previousDiscussionsCount,
      deltaPct: computeDeltaPct(newContacts.length, previousDiscussionsCount),
    },
    activeContacts: {
      current: activeContactsCount,
      previous: previousActiveContactsCount,
      deltaPct: computeDeltaPct(
        activeContactsCount,
        previousActiveContactsCount,
      ),
    },
    readRate: {
      current: readRate,
      previous: previousReadRate,
      deltaPts: computeDeltaPts(readRate, previousReadRate),
    },
    aiAutonomy: {
      current: aiAutonomy,
      previous: previousAiAutonomy,
      deltaPts: computeDeltaPts(aiAutonomy, previousAiAutonomy),
    },
  };

  // ------------------------- Séries temporelles -------------------------
  const bucketMode = getBucketMode(period);
  const keys = buildBucketKeys(start, end, bucketMode);

  const volumeByBucket = new Map<string, { received: number; sent: number }>(
    keys.map((key) => [key, { received: 0, sent: 0 }]),
  );
  for (const message of messages) {
    const bucket = volumeByBucket.get(
      bucketKeyFor(message.createdAt, bucketMode),
    );
    if (!bucket) continue;
    if (message.senderType === "CLIENT") {
      bucket.received += 1;
    } else if (message.senderType === "BOT" || message.senderType === "AGENT") {
      bucket.sent += 1;
    }
  }

  const discussionsByBucket = new Map<string, number>(
    keys.map((key) => [key, 0]),
  );
  for (const contact of newContacts) {
    const key = bucketKeyFor(contact.createdAt, bucketMode);
    const current = discussionsByBucket.get(key);
    if (current === undefined) continue;
    discussionsByBucket.set(key, current + 1);
  }

  const volumeSeries: VolumePoint[] = keys.map((key) => ({
    date: key,
    dateLabel: bucketLabel(key, bucketMode),
    received: volumeByBucket.get(key)?.received ?? 0,
    sent: volumeByBucket.get(key)?.sent ?? 0,
  }));

  const discussionsSeries: DiscussionPoint[] = keys.map((key) => ({
    date: key,
    dateLabel: bucketLabel(key, bucketMode),
    count: discussionsByBucket.get(key) ?? 0,
  }));

  // ------------------------------ Statuts ------------------------------
  const statusCountMap = new Map(
    statusGroups.map((group) => [
      group.status as MessageStatusKey,
      group._count._all,
    ]),
  );
  const statuses: StatusDatum[] = STATUS_ORDER.map((status) => ({
    status,
    count: statusCountMap.get(status) ?? 0,
  }));

  // ------------------------------ Sources ------------------------------
  const sourceCounts = new Map<string, number>();

  for (const group of sourceGroups) {
    const source = group.source?.trim().toLowerCase() || "unknown";

    sourceCounts.set(
      source,
      (sourceCounts.get(source) ?? 0) + group._count._all,
    );
  }

  const sources: SourceDatum[] = [...sourceCounts.entries()]
    .map(([source, count]) => ({ source, count }))
    .sort((a, b) => b.count - a.count);
  // --------------------------- Top contacts ---------------------------
  const totalsByContact = new Map<string, { received: number; sent: number }>();
  for (const group of contactGroups) {
    const entry = totalsByContact.get(group.contactId) ?? {
      received: 0,
      sent: 0,
    };
    if (group.senderType === "CLIENT") {
      entry.received += group._count._all;
    } else if (group.senderType === "BOT" || group.senderType === "AGENT") {
      entry.sent += group._count._all;
    }
    totalsByContact.set(group.contactId, entry);
  }

  const topContactIds = [...totalsByContact.entries()]
    .sort((a, b) => b[1].received + b[1].sent - (a[1].received + a[1].sent))
    .slice(0, 5)
    .map(([id]) => id);

  let topContacts: TopContactRow[] = [];

  if (topContactIds.length > 0) {
    const [contactRows] = await Promise.all([
      prisma.contact.findMany({
        where: {
          projectId,
          id: { in: topContactIds },
        },
        select: {
          id: true,
          name: true,
          pushName: true,
          phone: true,
          aiActive: true,
        },
      }),
    ]);

    const lastActivityMap = new Map(
      lastActivityGroups.map((group) => [
        group.contactId,
        group._max.createdAt,
      ]),
    );
    const activityFormatter = new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });

    topContacts = topContactIds.map((id) => {
      const row = contactRows.find((contact) => contact.id === id);
      const counts = totalsByContact.get(id)!;
      const lastActivity = lastActivityMap.get(id);
      const displayName = row?.name?.trim() || row?.pushName?.trim();
      const rawPhone = row?.phone ?? "";

      const nameMatchesPhone =
        !!displayName &&
        !!rawPhone &&
        displayName.replace(/\D/g, "") === rawPhone.replace(/\D/g, "");

      return {
        id,
        name: displayName && !nameMatchesPhone ? displayName : "Contact",
        phone: maskAnalyticsPhone(rawPhone),
        aiActive: row?.aiActive ?? true,
        received: counts.received,
        sent: counts.sent,
        lastActivityLabel: lastActivity
          ? activityFormatter.format(lastActivity)
          : "—",
      };
    });
  }

  // -------------------------- Libellé période --------------------------
  const rangeLabel = `du ${new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(start)} au ${new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(end)}`;

  return {
    period,
    rangeLabel,
    kpis,
    volumeSeries,
    discussionsSeries,
    statuses,
    sources,
    topContacts,
  };
}

function maskAnalyticsPhone(phone: string | null | undefined): string {
  const digits = phone?.replace(/\D/g, "") ?? "";

  if (digits.length < 6) return "Non affiché";

  return `••• ••• ${digits.slice(-4)}`;
}
