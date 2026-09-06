import prisma from "@/lib/prisma"; // Ajuste selon ton architecture
import { subDays, startOfDay, endOfDay, format } from "date-fns";

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
  const now = new Date();

  // Période courante : Aujourd'hui minuit -> Il y a 6 jours (soit 7 jours glissants inclus)
  const endOfCurrent = endOfDay(now);
  const startOfCurrent = startOfDay(subDays(now, 6));

  // Période précédente : Il y a 7 jours -> Il y a 13 jours
  const startOfPrevious = startOfDay(subDays(startOfCurrent, 7));

  // SÉCURITÉ: Filtrage strict par projectId
  // PERF: On ne récupère QUE la date de création
  const contacts = await prisma.contact.findMany({
    where: {
      projectId,
      createdAt: {
        gte: startOfPrevious,
        lte: endOfCurrent,
      },
    },
    select: { createdAt: true },
  });

  // 1. Initialiser une structure de données sans "trous" pour Recharts
  const daysMap = new Map<string, DashboardDiscussionRow>();
  const frenchDays = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

  for (let i = 0; i < 7; i++) {
    const currentDate = subDays(now, 6 - i);
    const prevDate = subDays(currentDate, 7);

    daysMap.set(format(currentDate, "yyyy-MM-dd"), {
      day: frenchDays[currentDate.getDay()],
      currentWeek: 0,
      previousWeek: 0,
    });

    // On stocke aussi la date précédente pour l'associer au bon jour
    daysMap.set(`${format(prevDate, "yyyy-MM-dd")}-prev`, {
      // Le nom du jour ne sera pas utilisé pour la clé prev,
      // on s'en sert juste pour le mapping
      day: "",
      currentWeek: 0,
      previousWeek: 0,
    });
  }

  // Variables pour calculer la croissance globale
  let currentWeekTotal = 0;
  let previousWeekTotal = 0;

  // 2. Assigner chaque contact dans son "bucket" de date
  contacts.forEach((contact) => {
    const dateStr = format(contact.createdAt, "yyyy-MM-dd");
    const isCurrentWeek = contact.createdAt >= startOfCurrent;

    if (isCurrentWeek) {
      const row = daysMap.get(dateStr);
      if (row) {
        row.currentWeek += 1;
        currentWeekTotal += 1;
      }
    } else {
      // C'est la semaine dernière. On doit trouver à quel jour de CETTE semaine cela correspond
      // ex: Si contact créé mardi dernier, on l'ajoute au "previousWeek" de CE mardi.
      const correspondingCurrentDateStr = format(
        subDays(contact.createdAt, -7), // On rajoute 7j pour retomber sur la date de cette semaine
        "yyyy-MM-dd",
      );
      const row = daysMap.get(correspondingCurrentDateStr);
      if (row) {
        row.previousWeek += 1;
        previousWeekTotal += 1;
      }
    }
  });

  // 3. Nettoyer la map pour ne retourner que le tableau final ordonné (7 éléments)
  const chartData = Array.from(daysMap.values()).filter(
    (row) => row.day !== "",
  );

  return {
    chartData,
    growthPct: calculateGrowthPct(currentWeekTotal, previousWeekTotal),
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
