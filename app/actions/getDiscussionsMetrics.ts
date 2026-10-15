import { getUserTimeZone } from "@/lib/server-time-zone";
import { localDayKey } from "@/lib/user-time-zone";
import prisma from "@/lib/prisma"; // Ajuste selon ton architecture
import { subDays, startOfDay, format } from "date-fns";

// --- Types retournés par le service ---
export type DashboardDiscussionRow = {
  day: string;
  currentWeek: number;
  previousWeek: number;
};

export type AnalyticsDiscussionRow = {
  date: string;
  count: number;
};

// --- Utilitaire mathématique ---
function calculateGrowthPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

/**
 * 📊 DASHBOARD : Compare les 7 derniers jours avec les 7 jours précédents
 */
export async function getDashboardDiscussionsMetrics(projectId: string) {
  const timeZone = await getUserTimeZone();
  const now = new Date();
  const dayMs = 86400000;
  const today = new Date(localDayKey(now, timeZone) + "T00:00:00Z");
  const keys = Array.from({ length: 14 }, (_, index) =>
    new Date(today.getTime() - (13 - index) * dayMs).toISOString().slice(0, 10),
  );
  // Fetch a margin for all local offsets, then assign only the 14 calendar days.
  const contacts = await prisma.contact.findMany({
    where: {
      projectId,
      createdAt: { gte: new Date(now.getTime() - 15 * dayMs), lte: now },
    },
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

/**
 * 📈 ANALYTICS : Affiche le volume de nouvelles discussions sur une période dynamique
 */
export async function getAnalyticsDiscussionsMetrics(
  projectId: string,
  timeframe: string,
) {
  // 1. Déterminer le nombre de jours en fonction du timeframe
  let daysToSubtract = 7; // Par défaut

  switch (timeframe) {
    case "7d":
      daysToSubtract = 7;
      break;
    case "14d":
      daysToSubtract = 14;
      break;
    case "21d":
      daysToSubtract = 21;
      break;
    case "1m":
      daysToSubtract = 30;
      break;
    case "2m":
      daysToSubtract = 60;
      break;
    case "3m":
      daysToSubtract = 90;
      break;
    case "6m":
      daysToSubtract = 180;
      break;
    case "1y":
      daysToSubtract = 365;
      break;
  }

  const now = new Date();
  // On soustrait daysToSubtract - 1 car on inclut aujourd'hui
  const startDate = startOfDay(subDays(now, daysToSubtract - 1));

  // SÉCURITÉ: Filtrage strict par projectId
  const contacts = await prisma.contact.findMany({
    where: {
      projectId,
      createdAt: { gte: startDate },
    },
    select: { createdAt: true },
  });

  // 2. Initialiser un dictionnaire de toutes les dates requises
  // (Garantit que Recharts affichera l'axe X correctement même avec des jours à zéro)
  const dateMap = new Map<string, number>();

  for (let i = 0; i < daysToSubtract; i++) {
    // Remplissage chronologique (du plus ancien à aujourd'hui)
    const dateStr = format(subDays(now, daysToSubtract - 1 - i), "yyyy-MM-dd");
    dateMap.set(dateStr, 0);
  }

  // 3. Peupler avec les vraies données
  contacts.forEach((contact) => {
    const dateStr = format(contact.createdAt, "yyyy-MM-dd");
    if (dateMap.has(dateStr)) {
      dateMap.set(dateStr, dateMap.get(dateStr)! + 1);
    }
  });

  // 4. Formater pour le composant UI
  const chartData: AnalyticsDiscussionRow[] = Array.from(dateMap.entries()).map(
    ([date, count]) => ({
      date,
      count,
    }),
  );

  return {
    chartData,
    totalCount: contacts.length,
  };
}
