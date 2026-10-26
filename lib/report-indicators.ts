import type { WeekAggregate } from "./report-week";
import {
  classify,
  type Direction,
  type IndicatorKind,
  type Signal,
  type WeekPoint,
} from "./report-signal";

export type IndicatorKey =
  "autonomy" | "handover" | "gaps" | "aiReply" | "csat" | "failures";

export type IndicatorDefinition = {
  key: IndicatorKey;
  label: string;
  question: string;
  kind: IndicatorKind;
  direction: Direction;
  /** Effectif minimal pour qualifier une valeur d'« inhabituelle ». */
  minSample: number;
  point: (week: WeekAggregate) => WeekPoint;
};

export const indicators: IndicatorDefinition[] = [
  {
    key: "autonomy",
    label: "Autonomie de l’IA",
    question:
      "Quelle part des conversations l’IA a-t-elle menées seule, sans échec ?",
    kind: "rate",
    direction: "up",
    minSample: 20,
    point: (w) => ({
      value: w.conversations ? w.outcome.autonomous / w.conversations : null,
      n: w.conversations,
    }),
  },
  {
    key: "handover",
    label: "Reprises par l’équipe",
    question: "Quelle part des conversations un humain a-t-il dû reprendre ?",
    kind: "rate",
    direction: "down",
    minSample: 20,
    point: (w) => ({
      value: w.conversations ? w.outcome.handover / w.conversations : null,
      n: w.conversations,
    }),
  },
  {
    key: "gaps",
    label: "Questions sans réponse",
    question: "Combien de questions l’IA n’a-t-elle pas su traiter ?",
    kind: "count",
    direction: "down",
    minSample: 5,
    point: (w) => ({ value: w.gapsNew, n: w.gapsNew }),
  },
  {
    key: "aiReply",
    label: "Première réponse de l’IA",
    question: "Combien de temps un client attend-il la première réponse ?",
    kind: "duration",
    direction: "down",
    minSample: 10,
    point: (w) => ({
      value: w.aiReply.n ? w.aiReply.median : null,
      n: w.aiReply.n,
    }),
  },
  {
    key: "csat",
    label: "Satisfaction client",
    question: "Comment les clients notent-ils l’échange ?",
    kind: "score",
    direction: "up",
    minSample: 10,
    point: (w) => ({ value: w.csat.mean, n: w.csat.responses }),
  },
  {
    key: "failures",
    label: "Échecs techniques",
    question: "Combien d’envois ou de réponses IA ont échoué ?",
    kind: "count",
    direction: "down",
    minSample: 5,
    point: (w) => {
      const value = w.sends.failed + w.aiJobsFailed;
      return { value, n: value };
    },
  },
];

export type IndicatorReading = {
  definition: IndicatorDefinition;
  current: WeekPoint;
  previous: WeekPoint | null;
  signal: Signal;
  /** 12 dernières semaines, la courante en dernier. */
  series: (WeekPoint & { weekStart: Date; status: Signal["status"] })[];
};

/** Lit chaque indicateur à la semaine `index` d'une série chronologique. */
export function readIndicators(
  weeks: WeekAggregate[],
  index: number,
  visibleWeeks = 12,
): IndicatorReading[] {
  return indicators.map((definition) => {
    const status = (i: number) =>
      classify(
        weeks.slice(0, i).map(definition.point),
        definition.point(weeks[i]),
        definition.kind,
        definition.direction,
        definition.minSample,
      );
    const from = Math.max(0, index - visibleWeeks + 1);
    return {
      definition,
      current: definition.point(weeks[index]),
      previous: index > 0 ? definition.point(weeks[index - 1]) : null,
      signal: status(index),
      series: weeks.slice(from, index + 1).map((week, offset) => ({
        ...definition.point(week),
        weekStart: week.weekStart,
        status: status(from + offset).status,
      })),
    };
  });
}
