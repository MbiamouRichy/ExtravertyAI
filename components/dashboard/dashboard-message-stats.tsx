import prisma from "@/lib/prisma"; // Ajuste le chemin
import { ChartDataPoint, MessagesChart } from "./message-recu-chart";

export async function DashboardMessageRecu({ projectId }: { projectId: string }) {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // 1. Récupération des données en parallèle (Messages de la semaine actuelle et précédente)
    // On ne sélectionne que 'createdAt' pour minimiser le payload SQL
    const [currentWeekMsgs, previousWeekMsgs] = await Promise.all([
        prisma.message.findMany({
            where: { projectId, senderType: "CLIENT", createdAt: { gte: sevenDaysAgo } },
            select: { createdAt: true },
        }),
        prisma.message.count({
            where: { projectId, senderType: "CLIENT", createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } },
        }),
    ]);

    // 2. Initialisation d'un tableau vide pour les 7 derniers jours
    const dataMap = new Map<string, number>();
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
        // On utilise la date YYYY-MM-DD comme clé unique pour éviter les doublons de nom de jour
        const dateKey = d.toISOString().split('T')[0];
        dataMap.set(dateKey, 0);
    }

    // 3. Remplissage avec les données de Prisma
    currentWeekMsgs.forEach((msg) => {
        const dateKey = msg.createdAt.toISOString().split('T')[0];
        if (dataMap.has(dateKey)) {
            dataMap.set(dateKey, dataMap.get(dateKey)! + 1);
        }
    });

    // 4. Formatage final pour le graphique
    const chartData: ChartDataPoint[] = Array.from(dataMap.entries()).map(([dateKey, count]) => ({
        dateLabel: new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(new Date(dateKey)),
        messages: count,
    }));

    // 5. Calcul de la croissance
    const currentTotal = currentWeekMsgs.length;
    const growthPct = previousWeekMsgs === 0
        ? (currentTotal > 0 ? 100 : 0)
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