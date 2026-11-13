import { getUserTimeZone } from "@/lib/server-time-zone";
import { computeDeltaPct, recentLocalDays } from "@/lib/analytics";
import { localDayKey } from "@/lib/user-time-zone";
import prisma from "@/lib/prisma";
import { ChartDataPoint, MessagesChart } from "./message-recu-chart";

const weekdayLabel = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  timeZone: "UTC",
});

export async function DashboardMessageRecu({
  projectId,
}: {
  projectId: string;
}) {
  const timeZone = await getUserTimeZone();
  // Les 7 jours civils affichés (aujourd'hui compris), pas 7 × 24 h glissantes :
  // sinon le premier jour, tronqué, apparaît deux fois sur l'axe.
  const { keys, start, previousStart, end } = recentLocalDays(7, timeZone);

  const [currentWeekMsgs, previousWeekCount] = await Promise.all([
    prisma.message.findMany({
      where: {
        projectId,
        senderType: "CLIENT",
        createdAt: { gte: start, lte: end },
      },
      select: { createdAt: true },
    }),
    prisma.message.count({
      where: {
        projectId,
        senderType: "CLIENT",
        createdAt: { gte: previousStart, lt: start },
      },
    }),
  ]);

  const counts = new Map(keys.map((key) => [key, 0]));
  for (const message of currentWeekMsgs) {
    const key = localDayKey(message.createdAt, timeZone);
    const current = counts.get(key);
    if (current !== undefined) counts.set(key, current + 1);
  }

  const chartData: ChartDataPoint[] = keys.map((key) => ({
    date: key,
    dateLabel: weekdayLabel.format(new Date(`${key}T12:00:00.000Z`)),
    messages: counts.get(key) ?? 0,
  }));

  return (
    <MessagesChart
      title="Messages reçus"
      description="Volume client sur 7 jours"
      data={chartData}
      growthPct={computeDeltaPct(currentWeekMsgs.length, previousWeekCount)}
    />
  );
}
