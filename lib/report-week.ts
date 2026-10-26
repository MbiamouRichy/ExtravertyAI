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

/** Repères d'une semaine : changement de consignes, diffusion. */
export function weekNote(week: WeekAggregate | undefined) {
  if (!week) return undefined;
  const notes = [
    week.annotations.agentUpdates ? "Consignes de l’agent modifiées" : null,
    week.annotations.broadcastRecipients
      ? `Diffusion envoyée à ${week.annotations.broadcastRecipients} contacts`
      : null,
  ].filter(Boolean);
  return notes.length ? notes.join(" · ") : undefined;
}
