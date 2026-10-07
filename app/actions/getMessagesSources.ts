"use server";

import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
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

function getStartDateFromPeriod(period: TimePeriod, now: Date): Date {
  const date = new Date(now);
  switch (period) {
    case "7d":
      date.setDate(date.getDate() - 7);
      break;
    case "14d":
      date.setDate(date.getDate() - 14);
      break;
    case "21d":
      date.setDate(date.getDate() - 21);
      break;
    case "1m":
      date.setMonth(date.getMonth() - 1);
      break;
    case "2m":
      date.setMonth(date.getMonth() - 2);
      break;
    case "3m":
      date.setMonth(date.getMonth() - 3);
      break;
    case "6m":
      date.setMonth(date.getMonth() - 6);
      break;
    case "1y":
      date.setFullYear(date.getFullYear() - 1);
      break;
    default:
      date.setDate(date.getDate() - 7);
  }
  return date;
}

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

    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) {
      // Même erreur générique pour éviter le sondage d'identifiants (IDOR scan)
      return {
        success: false,
        data: [],
        totalMessages: 0,
        error: "Non autorisé",
      };
    }

    // --- Logique Métier ---
    const now = new Date();
    const startDate = getStartDateFromPeriod(period, now);
    const previousStartDate = new Date(
      startDate.getTime() - (now.getTime() - startDate.getTime()),
    );

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
      trendPercentage:
        previousTotal === 0
          ? totalMessages > 0
            ? 100
            : 0
          : Number(
              (((totalMessages - previousTotal) / previousTotal) * 100).toFixed(
                1,
              ),
            ),
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
