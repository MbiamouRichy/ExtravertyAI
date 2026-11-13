import { getUserTimeZone } from "@/lib/server-time-zone";
import { computeDeltaPct, recentLocalDays } from "@/lib/analytics";
import { localDayKey } from "@/lib/user-time-zone";
import prisma from "@/lib/prisma";

// --- Types retournés par le service ---
export type DashboardDiscussionRow = {
  day: string;
  currentWeek: number;
  previousWeek: number;
};

// null : aucune nouvelle discussion la semaine précédente, rien à comparer.
function calculateGrowthPct(current: number, previous: number): number | null {
  const delta = computeDeltaPct(current, previous);
  return delta === null ? null : Number(delta.toFixed(1));
}

/**
 * 📊 DASHBOARD : Compare les 7 derniers jours avec les 7 jours précédents
 */
export async function getDashboardDiscussionsMetrics(projectId: string) {
  const timeZone = await getUserTimeZone();
  // 14 jours civils du fuseau : les 7 affichés et les 7 de comparaison.
  const { keys, start, end } = recentLocalDays(14, timeZone);
  const contacts = await prisma.contact.findMany({
    where: { projectId, createdAt: { gte: start, lte: end } },
    select: { createdAt: true },
  });
  const counts = new Map(keys.map((key) => [key, 0]));
  for (const contact of contacts) {
    const key = localDayKey(contact.createdAt, timeZone);
    if (counts.has(key)) counts.set(key, counts.get(key)! + 1);
  }
  const label = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    timeZone: "UTC",
  });
  const chartData = keys.slice(7).map((key, index) => ({
    day: label.format(new Date(key + "T00:00:00Z")),
    currentWeek: counts.get(key)!,
    previousWeek: counts.get(keys[index])!,
  }));
  return {
    chartData,
    growthPct: calculateGrowthPct(
      chartData.reduce((sum, row) => sum + row.currentWeek, 0),
      chartData.reduce((sum, row) => sum + row.previousWeek, 0),
    ),
  };
}
