import prisma from "@/lib/prisma"; // Ajuste le chemin selon ton setup
import { SenderType } from "@/src/generated/prisma/client";
import { subDays, format } from "date-fns";

type ReplyRow = {
  day: string;
  minutes: number;
};

// Fonction mathématique pour calculer la médiane
const calculateMedian = (values: number[]) => {
  if (values.length === 0) return 0;
  values.sort((a, b) => a - b);
  const half = Math.floor(values.length / 2);
  if (values.length % 2) return values[half];
  return (values[half - 1] + values[half]) / 2.0;
};

export async function getAiResponseTimeData(
  projectId: string,
): Promise<ReplyRow[]> {
  const sevenDaysAgo = subDays(new Date(), 7);

  // 1. Récupérer les messages du projet (Sécurité par projectId)
  const messages = await prisma.message.findMany({
    where: {
      projectId,
      createdAt: { gte: sevenDaysAgo },
      senderType: { in: ["CLIENT", "BOT"] },
    },
    orderBy: { createdAt: "asc" },
    select: { senderType: true, createdAt: true, contactId: true },
  });

  // 2. Grouper par contact pour analyser les conversations individuellement
  const responseTimesByDay: Record<string, number[]> = {
    Mon: [],
    Tue: [],
    Wed: [],
    Thu: [],
    Fri: [],
    Sat: [],
    Sun: [],
  };

  const contactThreads = messages.reduce(
    (acc, msg) => {
      if (!acc[msg.contactId]) acc[msg.contactId] = [];
      acc[msg.contactId].push(msg);
      return acc;
    },
    {} as Record<string, typeof messages>,
  );

  // 3. Calculer le temps d'attente (Client -> Premier message Bot qui suit)
  for (const thread of Object.values(contactThreads)) {
    let lastClientMsgTime: Date | null = null;

    for (const msg of thread) {
      if (msg.senderType === SenderType.CLIENT) {
        lastClientMsgTime = msg.createdAt;
      } else if (msg.senderType === SenderType.BOT && lastClientMsgTime) {
        const diffMs = msg.createdAt.getTime() - lastClientMsgTime.getTime();
        const diffMinutes = diffMs / 1000 / 60;

        const dayName = format(msg.createdAt, "EEE"); // Ex: "Mon", "Tue"
        if (responseTimesByDay[dayName]) {
          responseTimesByDay[dayName].push(diffMinutes);
        }

        // Reset pour attendre le prochain message client
        lastClientMsgTime = null;
      }
    }
  }

  // 4. Formater pour le graphique (Calcul des médianes)
  const daysOrder = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return daysOrder.map((day) => ({
    day,
    // Arrondir à 1 décimale, 0 si pas de données ce jour-là
    minutes: Number(calculateMedian(responseTimesByDay[day]).toFixed(1)),
  }));
}
