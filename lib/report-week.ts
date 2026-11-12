// Agrégats hebdomadaires d'un projet : uniquement des nombres, jamais de
// contenu de conversation. C'est la matière stockée dans l'instantané v2.
import { z } from "zod";

const count = z.number().int().min(0);
const delay = z.object({
  n: count,
  median: z.number().min(0),
  p90: z.number().min(0),
});

export const WeekAggregateSchema = z.object({
  weekStart: z.coerce.date(),
  weekEnd: z.coerce.date(),
  /** Conversations ayant demandé une réponse. */
  conversations: count,
  /** Issues sans recouvrement, dans l'ordre de priorité ; leur somme vaut `conversations`. */
  outcome: z.object({
    failed: count,
    handover: count,
    gap: count,
    unanswered: count,
    autonomous: count,
  }),
  handoverReasons: z.object({
    app: count,
    phone: count,
    manual: count,
    alreadyPaused: count,
  }),
  gapsNew: count,
  gapsOpenAtClose: count,
  /** Thèmes des questions : vide tant que le regroupement n'est pas validé. */
  gapTopics: z.array(z.object({ label: z.string().max(40), count })).max(5),
  aiReply: delay,
  teamReply: delay,
  csat: z.object({
    sent: count,
    responses: count,
    mean: z.number().min(1).max(5).nullable(),
    low: count,
  }),
  feedback: z.object({ votes: count, down: count }),
  sends: z.object({ attempted: count, failed: count, broadcastFailed: count }),
  aiJobsFailed: count,
  waiting: z.object({ total: count, over24h: count, manual: count }),
  annotations: z.object({ agentUpdates: count, broadcastRecipients: count }),
  /** Les 8 compteurs historiques, toujours lisibles dans chaque rapport. */
  legacy: z.object({
    received: count,
    sent: count,
    aiSent: count,
    failed: count,
    activeContacts: count,
    newContacts: count,
    changes: count,
    csatResponses: count,
  }),
});
export type WeekAggregate = z.infer<typeof WeekAggregateSchema>;
export type Outcome = WeekAggregate["outcome"];

/** Même semaine, sans aucune activité. */
export function emptyWeek(
  week: Pick<WeekAggregate, "weekStart" | "weekEnd">,
): WeekAggregate {
  return {
    weekStart: week.weekStart,
    weekEnd: week.weekEnd,
    conversations: 0,
    outcome: { failed: 0, handover: 0, gap: 0, unanswered: 0, autonomous: 0 },
    handoverReasons: { app: 0, phone: 0, manual: 0, alreadyPaused: 0 },
    gapsNew: 0,
    gapsOpenAtClose: 0,
    gapTopics: [],
    aiReply: { n: 0, median: 0, p90: 0 },
    teamReply: { n: 0, median: 0, p90: 0 },
    csat: { sent: 0, responses: 0, mean: null, low: 0 },
    feedback: { votes: 0, down: 0 },
    sends: { attempted: 0, failed: 0, broadcastFailed: 0 },
    aiJobsFailed: 0,
    waiting: { total: 0, over24h: 0, manual: 0 },
    annotations: { agentUpdates: 0, broadcastRecipients: 0 },
    legacy: {
      received: 0,
      sent: 0,
      aiSent: 0,
      failed: 0,
      activeContacts: 0,
      newContacts: 0,
      changes: 0,
      csatResponses: 0,
    },
  };
}

/** Numéro de semaine ISO 8601 (la semaine du jeudi donne l’année). */
export function isoWeek(date: Date) {
  const day = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  day.setUTCDate(day.getUTCDate() + 3 - ((day.getUTCDay() + 6) % 7));
  const firstThursday = new Date(Date.UTC(day.getUTCFullYear(), 0, 4));
  return (
    1 +
    Math.round(
      ((day.getTime() - firstThursday.getTime()) / 86_400_000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    )
  );
}

/**
 * Rang de la semaine dans la vie du projet : 1 pour la semaine (lundi 00:00
 * UTC, comme les rapports) qui contient sa création, puis 2, 3… Une semaine
 * antérieure à la création donne 0 ou moins.
 */
export function projectWeek(weekStart: Date, projectCreatedAt: Date) {
  const first = new Date(projectCreatedAt);
  first.setUTCHours(0, 0, 0, 0);
  first.setUTCDate(first.getUTCDate() - ((first.getUTCDay() + 6) % 7));
  return Math.floor((weekStart.getTime() - first.getTime()) / (7 * 86_400_000)) + 1;
}

/**
 * Période courte d'une semaine [début, fin[ en UTC, l'année une seule fois :
 * « 26 oct. – 1 nov. 2026 », ou « 28 déc. 2026 – 3 janv. 2027 ».
 */
export function shortWeekRange(start: Date, end: Date) {
  const last = new Date(end.getTime() - 1);
  const format = (date: Date, year: boolean) =>
    new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "short",
      ...(year ? { year: "numeric" } : {}),
      timeZone: "UTC",
    }).format(date);
  const sameYear = start.getUTCFullYear() === last.getUTCFullYear();
  return `${format(start, !sameYear)} – ${format(last, true)}`;
}

/** Repères d'une semaine : changement de consignes, diffusion. */
export function weekNote(week: WeekAggregate | undefined) {
  if (!week) return undefined;
  const notes = [
    week.annotations.agentUpdates ? "Consignes de l’agent modifiées" : null,
    week.annotations.broadcastRecipients
      ? `Diffusion envoyée à ${week.annotations.broadcastRecipients} contact${week.annotations.broadcastRecipients > 1 ? "s" : ""}`
      : null,
  ].filter(Boolean);
  return notes.length ? notes.join(" · ") : undefined;
}

/**
 * Clôture de la semaine (lundi 00:00 UTC) lue dans le fuseau de l’utilisateur,
 * ex. « lundi 2 nov., 01:00 » à Libreville. Le fuseau est précisé s’il est
 * inconnu (UTC par défaut).
 */
export function formatWeekClose(end: Date, timeZone: string) {
  const label = new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(end);
  return timeZone === "UTC" ? `${label} (UTC)` : label;
}
