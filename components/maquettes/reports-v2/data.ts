// Jeu synthétique déterministe (graine fixe : aucun aléa au rendu, donc pas
// d'écart serveur/client). Il imite des agrégats hebdomadaires d'un projet de
// 10 à 50 conversations par semaine ; aucune donnée réelle n'y figure.

export const DAY_MS = 86_400_000;
export const WEEK_MS = 7 * DAY_MS;

export { emptyWeek, type WeekAggregate } from "@/lib/report-week";
import type { WeekAggregate } from "@/lib/report-week";

export type WeekEvent =
  "quiet" | "broadcast" | "agent-change" | "disconnection" | "knowledge-gap";

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampler(seed: number) {
  const random = mulberry32(seed);
  const binomial = (n: number, p: number) => {
    let hits = 0;
    for (let i = 0; i < n; i++) if (random() < p) hits++;
    return hits;
  };
  const poisson = (lambda: number) => {
    const limit = Math.exp(-lambda);
    let k = 0;
    let product = random();
    while (product > limit) {
      k++;
      product *= random();
    }
    return k;
  };
  const normal = () =>
    Math.sqrt(-2 * Math.log(1 - random())) * Math.cos(2 * Math.PI * random());
  return { random, binomial, poisson, normal };
}

/** Lundi 00:00 UTC de la semaine contenant `date`. */
export function mondayUtc(date: Date) {
  const monday = new Date(date);
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return monday;
}

const TOPICS = ["Livraison", "Tarifs", "Horaires", "Paiement", "Retours"];

export function simulateProject({
  seed,
  size,
  weeks,
  lastWeekEnd,
  events = {},
}: {
  seed: number;
  /** Conversations attendues par semaine ordinaire. */
  size: number;
  weeks: number;
  lastWeekEnd: Date;
  events?: Record<number, WeekEvent[]>;
}): WeekAggregate[] {
  const { binomial, poisson, normal } = sampler(seed);
  let openGaps = Math.round(size / 6);
  return Array.from({ length: weeks }, (_, index) => {
    const tags = events[index] ?? [];
    const has = (event: WeekEvent) => tags.includes(event);
    const weekEnd = new Date(
      lastWeekEnd.getTime() - (weeks - 1 - index) * WEEK_MS,
    );
    const volume = size * (has("quiet") ? 0.35 : has("broadcast") ? 1.6 : 1);
    const conversations = poisson(volume);

    // Probabilités d'issue d'une conversation ordinaire.
    let pFailed = 0.02;
    let pHandover = has("broadcast") ? 0.2 : 0.17;
    let pGap = 0.06;
    const pUnanswered = 0.04;
    if (has("disconnection")) pFailed = 0.12;
    if (has("knowledge-gap")) pGap = 0.27;
    if (has("agent-change")) pHandover -= 0.03;
    const failed = binomial(conversations, pFailed);
    let rest = conversations - failed;
    const handover = binomial(rest, pHandover / (1 - pFailed));
    rest -= handover;
    const gap = binomial(rest, pGap / (1 - pFailed - pHandover));
    rest -= gap;
    const unanswered = binomial(
      rest,
      pUnanswered / (1 - pFailed - pHandover - pGap),
    );
    const autonomous = rest - unanswered;

    const phone = binomial(handover, 0.35);
    const manual = binomial(handover - phone, 0.15);
    const alreadyPaused = binomial(handover - phone - manual, 0.2);
    const app = handover - phone - manual - alreadyPaused;

    const gapsNew = gap + binomial(handover, 0.15);
    const resolved = binomial(openGaps, 0.4);
    openGaps = openGaps - resolved + gapsNew;
    const topicWeights = has("knowledge-gap")
      ? [0.62, 0.18, 0.1, 0.06, 0.04]
      : [0.26, 0.24, 0.2, 0.18, 0.12];
    let left = gapsNew;
    const gapTopics = TOPICS.map((label, i) => {
      const remaining = topicWeights.slice(i).reduce((sum, w) => sum + w, 0);
      const count =
        i === TOPICS.length - 1
          ? left
          : binomial(left, topicWeights[i] / remaining);
      left -= count;
      return { label, count };
    })
      .filter((topic) => topic.count > 0)
      .sort((a, b) => b.count - a.count);

    const aiN = autonomous + gap + binomial(handover, 0.6);
    const aiMedian = Math.round(
      33 * Math.exp(0.12 * normal()) * (has("broadcast") ? 1.2 : 1),
    );
    const teamN = handover;
    const teamMedian = Math.round(50 * 60 * Math.exp(0.35 * normal()));

    const csatSent = binomial(conversations, 0.8);
    const responses = binomial(csatSent, 0.36);
    let scoreSum = 0;
    let low = 0;
    for (let i = 0; i < responses; i++) {
      const score = Math.max(1, Math.min(5, Math.round(4.4 + normal() * 0.85)));
      scoreSum += score;
      if (score <= 2) low++;
    }
    const votes = poisson(4);
    const down = binomial(votes, has("knowledge-gap") ? 0.6 : 0.25);

    const attempted = Math.round(
      conversations * 3.2 + (has("broadcast") ? 212 : 0),
    );
    const sendFailed =
      poisson(attempted * 0.004) + (has("disconnection") ? 9 : 0);
    const broadcastFailed = has("broadcast")
      ? Math.min(sendFailed, poisson(1))
      : 0;
    const waitingTotal = unanswered + binomial(handover, 0.12);
    const received = Math.round(
      conversations * 4.1 + (has("broadcast") ? 70 : 0),
    );
    const aiSent = Math.round(aiN * 2.6);

    return {
      weekStart: new Date(weekEnd.getTime() - WEEK_MS),
      weekEnd,
      conversations,
      outcome: { failed, handover, gap, unanswered, autonomous },
      handoverReasons: { app, phone, manual, alreadyPaused },
      gapsNew,
      gapsOpenAtClose: openGaps,
      gapTopics,
      aiReply: {
        n: aiN,
        median: aiMedian,
        p90: Math.round(aiMedian * (2.6 + Math.abs(normal()) * 0.4)),
      },
      teamReply: {
        n: teamN,
        median: teamMedian,
        p90: Math.round(teamMedian * (4 + Math.abs(normal()))),
      },
      csat: {
        sent: csatSent,
        responses,
        mean: responses ? scoreSum / responses : null,
        low,
      },
      feedback: { votes, down },
      sends: { attempted, failed: sendFailed, broadcastFailed },
      aiJobsFailed: poisson(has("disconnection") ? 1.5 : 0.2),
      waiting: {
        total: waitingTotal,
        over24h: binomial(waitingTotal, 0.3),
        manual: Math.min(waitingTotal, binomial(waitingTotal, 0.6)),
      },
      annotations: {
        agentUpdates: has("agent-change") ? 2 : 0,
        broadcastRecipients: has("broadcast") ? 212 : 0,
      },
      legacy: {
        received,
        sent: Math.round(attempted - sendFailed),
        aiSent,
        failed: sendFailed,
        activeContacts: conversations + poisson(3),
        newContacts: Math.round(
          conversations * 0.35 + (has("broadcast") ? 0 : 2),
        ),
        changes: has("agent-change") ? 2 : 0,
        csatResponses: responses,
      },
    };
  });
}
