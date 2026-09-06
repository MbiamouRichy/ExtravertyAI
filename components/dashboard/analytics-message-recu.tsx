import prisma from "@/lib/prisma";
import { ChartDataPoint, MessagesChart } from "./message-recu-chart";

// Types de périodes supportées
export type TimeRange = "7d" | "14d" | "21d" | "30d" | "3m" | "6m" | "1y";

export async function AnalyticsMessageRecuChart({
    projectId,
    range = "30d"
}: {
    projectId: string;
    range?: TimeRange;
}) {
    // Mapping de la durée en jours
    const rangeToDays: Record<TimeRange, number> = {
        "7d": 7, "14d": 14, "21d": 21, "30d": 30, "3m": 90, "6m": 180, "1y": 365,
    };

    const days = rangeToDays[range];
    const groupMode = days > 30 ? "month" : "day";

    const now = new Date();
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const previousStartDate = new Date(now.getTime() - (days * 2) * 24 * 60 * 60 * 1000);

    const [currentMsgs, previousMsgsTotal] = await Promise.all([
        prisma.message.findMany({
            where: { projectId, senderType: "CLIENT", createdAt: { gte: startDate } },
            select: { createdAt: true },
        }),
        prisma.message.count({
            where: { projectId, senderType: "CLIENT", createdAt: { gte: previousStartDate, lt: startDate } },
        }),
    ]);

    const dataMap = new Map<string, number>();

    // Génération du "squelette" du graphique (pour avoir les jours/mois à zéro s'il n'y a pas de message)
    if (groupMode === "day") {
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
            const key = d.toISOString().split('T')[0]; // ex: 2024-05-12
            dataMap.set(key, 0);
        }
    } else {
        // Groupement par mois
        for (let i = (days / 30) - 1; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // ex: 2024-05
            dataMap.set(key, 0);
        }
    }

    // Remplissage avec les vraies données
    currentMsgs.forEach((msg) => {
        const key = groupMode === "day"
            ? msg.createdAt.toISOString().split('T')[0]
            : `${msg.createdAt.getFullYear()}-${String(msg.createdAt.getMonth() + 1).padStart(2, '0')}`;

        if (dataMap.has(key)) {
            dataMap.set(key, dataMap.get(key)! + 1);
        }
    });

    // Formatage pour Recharts
    const chartData: ChartDataPoint[] = Array.from(dataMap.entries()).map(([key, count]) => {
        const dateObj = new Date(groupMode === "day" ? key : `${key}-01`);
        return {
            // Pour les jours, on affiche ex: "12 Avril". Pour les mois: "Avril"
            dateLabel: new Intl.DateTimeFormat('fr-FR', {
                day: groupMode === "day" ? 'numeric' : undefined,
                month: 'short'
            }).format(dateObj),
            messages: count,
        };
    });

    // Calcul du Delta
    const currentTotal = currentMsgs.length;
    const growthPct = previousMsgsTotal === 0
        ? (currentTotal > 0 ? 100 : 0)
        : ((currentTotal - previousMsgsTotal) / previousMsgsTotal) * 100;

    return (
        <MessagesChart
            title="Historique des Messages"
            description={`Volume reçu sur les ${days} derniers jours`}
            data={chartData}
            growthPct={growthPct}
        />
    );
}