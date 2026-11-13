"use server";

import { getSession } from "@/lib/auth-server";
import { can } from "@/lib/project-permissions";
import prisma from "@/lib/prisma";
import { computeDeltaPct, recentLocalDays } from "@/lib/analytics";
import { getUserTimeZone } from "@/lib/server-time-zone";
import { z } from "zod";

export type TimePeriod =
  "7d" | "14d" | "21d" | "1m" | "2m" | "3m" | "6m" | "1y";
export type MessageSourceKey = "android" | "ios" | "ai" | "unknown";

export type SourceDatum = {
  source: MessageSourceKey;
  count: number;
  fill: string;
};

// 🛡️ 1. Validation stricte des entrées avec Zod
const GetStatsSchema = z.object({
  projectId: z.string().cuid("Format d'ID invalide"), // Bloque les injections directement
  period: z
    .enum(["7d", "14d", "21d", "1m", "2m", "3m", "6m", "1y"])
    .default("7d"),
});

const colorMapping: Record<MessageSourceKey, string> = {
  android: "var(--chart-1)",
  ios: "var(--chart-2)",
  ai: "var(--chart-3)",
  unknown: "var(--chart-4)",
};

// Jours civils du fuseau de l'utilisateur, aujourd'hui compris.
const PERIOD_DAY_COUNT: Record<TimePeriod, number> = {
  "7d": 7,
  "14d": 14,
  "21d": 21,
  "1m": 30,
  "2m": 60,
  "3m": 90,
  "6m": 180,
  "1y": 365,
};

export async function getMessageSourcesStats(
  rawProjectId: string,
  rawPeriod: string = "7d",
) {
  try {
    // 🛡️ 2. Parsing et assainissement des entrées
    const parsedInput = GetStatsSchema.safeParse({
      projectId: rawProjectId,
      period: rawPeriod,
    });

    if (!parsedInput.success) {
      return {
        success: false,
        data: [],
        totalMessages: 0,
        error: "Requête invalide",
      };
    }

    const { projectId, period } = parsedInput.data;

    // 🛡️ 3. Authentification
    const session = await getSession();
    if (!session?.user?.id) {
      // Message générique pour ne pas donner d'infos à un attaquant
      return {
        success: false,
        data: [],
        totalMessages: 0,
        error: "Non autorisé",
      };
    }

    // 🛡️ 4. Autorisation (Contrôle d'accès basé sur les rôles - RBAC)
    const membership = await prisma.projectMembership.findUnique({
      where: {
        userId_projectId: {
          userId: session.user.id,
          projectId: projectId,
        },
      },
      select: { role: true }, // ⚡ Optimisation: on ne demande que le rôle, pas tout le projet
    });

    if (!can(membership?.role, "stats.view")) {
      // Même erreur générique pour éviter le sondage d'identifiants (IDOR scan)
      return {
        success: false,
        data: [],
        totalMessages: 0,
        error: "Non autorisé",
      };
    }

    // --- Logique Métier ---
    // Mêmes jours civils que les autres cartes du tableau de bord.
    const {
      start: startDate,
      previousStart: previousStartDate,
      end: now,
    } = recentLocalDays(PERIOD_DAY_COUNT[period], await getUserTimeZone());

    const [groupedMessages, previousTotal] = await Promise.all([
      prisma.message.groupBy({
        by: ["source"],
        where: { projectId, createdAt: { gte: startDate, lte: now } },
        _count: { _all: true },
      }),
      prisma.message.count({
        where: {
          projectId,
          createdAt: { gte: previousStartDate, lt: startDate },
        },
      }),
    ]);

    const stats: Record<MessageSourceKey, number> = {
      android: 0,
      ios: 0,
      ai: 0,
      unknown: 0,
    };

    const otherSources = new Map<string, number>();
    let totalMessages = 0;

    groupedMessages.forEach((group) => {
      // 🛡️ 5. Assainissement de la sortie (Type Guarding)
      const source = group.source?.trim().toLowerCase() || "unknown";
      const sourceKey = Object.hasOwn(stats, source)
        ? (source as MessageSourceKey)
        : "unknown";

      if (sourceKey === "unknown") {
        otherSources.set(
          source,
          (otherSources.get(source) ?? 0) + group._count._all,
        );
      }

      stats[sourceKey] += group._count._all;
      totalMessages += group._count._all;
    });

    const chartData: SourceDatum[] = (
      Object.keys(stats) as MessageSourceKey[]
    ).map((key) => ({
      source: key,
      count: stats[key],
      fill: colorMapping[key],
    }));

    return {
      success: true,
      data: chartData,
      otherSources: [...otherSources.entries()]
        .map(([source, count]) => ({ source, count }))
        .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source)),
      totalMessages,
      // null : aucun message la période précédente, rien à comparer.
      trendPercentage: (() => {
        const delta = computeDeltaPct(totalMessages, previousTotal);
        return delta === null ? null : Number(delta.toFixed(1));
      })(),
    };
  } catch (error) {
    // 🛡️ 6. Ne jamais fuiter l'erreur brute (Prisma peut révéler la structure de la BDD)
    console.error("[GET_MESSAGE_SOURCES_STATS] Erreur interne:", error);
    return {
      success: false,
      data: [],
      totalMessages: 0,
      error: "Une erreur interne est survenue",
    };
  }
}
