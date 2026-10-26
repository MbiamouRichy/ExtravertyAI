import { getUserTimeZone } from "@/lib/server-time-zone";
import { buildBucketKeys } from "@/lib/analytics";
import { localDayKey } from "@/lib/user-time-zone";
import prisma from "@/lib/prisma"; // Ajuste le chemin
import { ChartDataPoint, MessagesChart } from "./message-recu-chart";

export async function DashboardMessageRecu({
  projectId,
}: {
  projectId: string;
}) {
  const timeZone = await getUserTimeZone();
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  // 1. Récupération des données en parallèle (Messages de la semaine actuelle et précédente)
  // On ne sélectionne que 'createdAt' pour minimiser le payload SQL
  const [currentWeekMsgs, previousWeekMsgs] = await Promise.all([
    prisma.message.findMany({
      where: {
        projectId,
        senderType: "CLIENT",
        createdAt: { gte: sevenDaysAgo },
      },
      select: { createdAt: true },
    }),
    prisma.message.count({
      where: {
        projectId,
        senderType: "CLIENT",
        createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo },
      },
    }),
  ]);

  // 2. Initialisation d'un tableau vide pour les 7 derniers jours
  const dataMap = new Map<string, number>();
  for (const key of buildBucketKeys(sevenDaysAgo, now, "day", timeZone))
    dataMap.set(key, 0);

  // 3. Remplissage avec les données de Prisma
  currentWeekMsgs.forEach((msg) => {
    const dateKey = localDayKey(msg.createdAt, timeZone);
    if (dataMap.has(dateKey)) {
      dataMap.set(dateKey, dataMap.get(dateKey)! + 1);
    }
  });

  // 4. Formatage final pour le graphique
  const chartData: ChartDataPoint[] = Array.from(dataMap.entries()).map(
    ([dateKey, count]) => ({
      dateLabel: new Intl.DateTimeFormat("fr-FR", {
        weekday: "short",
        timeZone: "UTC",
      }).format(new Date(dateKey)),
      messages: count,
    }),
  );

  // 5. Calcul de la croissance
  const currentTotal = currentWeekMsgs.length;
  const growthPct =
    previousWeekMsgs === 0
      ? currentTotal > 0
        ? 100
        : 0
      : ((currentTotal - previousWeekMsgs) / previousWeekMsgs) * 100;

  return (
    <MessagesChart
      title="Messages Reçus (7 derniers jours)"
      description="Volume d'engagement client sur la semaine."
      data={chartData}
      growthPct={growthPct}
    />
  );
}
