// États de test de la page : chaque scénario assemble des rapports fictifs.
import { reportRange, reportWindow } from "@/lib/weekly-report";

import {
  emptyWeek,
  simulateProject,
  type WeekAggregate,
  type WeekEvent,
} from "./data";
import { buildVerdict, type Verdict } from "./findings";
import { readIndicators } from "./indicators";

export const scenarios = [
  { id: "incident", label: "Semaine d’incident" },
  { id: "calme", label: "Semaine calme" },
  { id: "recent", label: "Projet récent" },
  { id: "vide", label: "Semaine vide" },
  { id: "ignore", label: "Rapport ignoré" },
  { id: "ancien", label: "Ancien rapport" },
  { id: "abonnement", label: "Abonnement à régulariser" },
  { id: "offre", label: "Hors offre Business" },
] as const;
export type ScenarioId = (typeof scenarios)[number]["id"];

export function parseScenario(value: unknown): ScenarioId {
  return scenarios.find((scenario) => scenario.id === value)?.id ?? "incident";
}

// Panne WhatsApp, semaine creuse, diffusion, nouvelles consignes, puis une
// semaine où un nouveau sujet (la livraison) dépasse les connaissances de l'IA.
const EVENTS: Record<number, WeekEvent[]> = {
  13: ["disconnection"],
  12: ["quiet"],
  15: ["broadcast"],
  17: ["agent-change"],
  19: ["knowledge-gap"],
};

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

export type PreviewReport = {
  id: string;
  index: number;
  week: WeekAggregate;
  /** 1 : ancien instantané (8 compteurs seulement), 2 : nouveau format. */
  version: 1 | 2;
  skipped: boolean;
  emails: { state: string }[];
  label: string;
  range: string;
  verdict: Verdict | null;
};

export function weekNote(week: WeekAggregate) {
  const notes = [
    week.annotations.agentUpdates ? "Consignes de l’agent modifiées" : null,
    week.annotations.broadcastRecipients
      ? `Diffusion envoyée à ${week.annotations.broadcastRecipients} contacts`
      : null,
  ].filter(Boolean);
  return notes.length ? notes.join(" · ") : undefined;
}

export function buildScenario(id: ScenarioId, now: Date) {
  const lastWeekEnd = reportWindow(now, 7).end;
  const weeks =
    id === "recent"
      ? simulateProject({ seed: 3, size: 24, weeks: 3, lastWeekEnd })
      : simulateProject({
          seed: 7,
          size: 38,
          weeks: 20,
          lastWeekEnd,
          events: EVENTS,
        });
  const last = weeks.length - 1;
  if (id === "vide" || id === "ignore")
    // Sans activité, le stock de questions ouvertes reste celui de la semaine d'avant.
    weeks[last] = {
      ...emptyWeek(weeks[last]),
      gapsOpenAtClose: weeks[last - 1].gapsOpenAtClose,
    };
  const from = Math.max(0, weeks.length - 12);
  // Les 4 plus anciens rapports affichés précèdent le nouveau format.
  const firstV2 = id === "recent" ? 0 : from + 4;

  const reports: PreviewReport[] = weeks
    .slice(from)
    .map((week, offset) => {
      const index = from + offset;
      const version = index >= firstV2 ? 2 : 1;
      const skipped = id === "ignore" && index === last;
      return {
        id: `s${isoWeek(week.weekStart)}-${week.weekStart.getUTCFullYear()}`,
        index,
        week,
        version,
        skipped,
        emails: skipped
          ? []
          : index === last
            ? [{ state: "SENT" }, { state: "PENDING" }]
            : [{ state: "SENT" }, { state: "SENT" }],
        label: `S${isoWeek(week.weekStart)}`,
        range: reportRange(week.weekStart, week.weekEnd, "UTC"),
        verdict:
          version === 2
            ? buildVerdict(readIndicators(weeks, index), week)
            : null,
      } satisfies PreviewReport;
    })
    .reverse();

  const fallback =
    id === "calme"
      ? reports[1]
      : id === "ancien"
        ? reports[reports.length - 1]
        : reports[0];
  return {
    weeks,
    reports,
    fallback,
    business: id !== "offre",
    eligible: id !== "abonnement",
    projectCreatedAt:
      id === "recent"
        ? new Date(weeks[0].weekStart.getTime() + 2 * 86_400_000)
        : new Date(Date.UTC(2025, 10, 3)),
  };
}
