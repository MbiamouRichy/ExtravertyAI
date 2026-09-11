export type AnalyticsPeriod = "7d" | "14d" | "21d" | "30d" | "3m" | "6m" | "1y";

export type BucketMode = "day" | "week" | "month";

export interface PeriodOption {
  value: AnalyticsPeriod;
  label: string;
  shortLabel: string;
}

export const ANALYTICS_PERIOD_OPTIONS: PeriodOption[] = [
  { value: "7d", label: "7 derniers jours", shortLabel: "7 j" },
  { value: "14d", label: "14 derniers jours", shortLabel: "14 j" },
  { value: "21d", label: "21 derniers jours", shortLabel: "21 j" },
  { value: "30d", label: "30 derniers jours", shortLabel: "30 j" },
  { value: "3m", label: "90 derniers jours", shortLabel: "90 j" },
  { value: "6m", label: "180 derniers jours", shortLabel: "180 j" },
  { value: "1y", label: "365 derniers jours", shortLabel: "365 j" },
];

export const PERIOD_DAYS: Record<AnalyticsPeriod, number> = {
  "7d": 7,
  "14d": 14,
  "21d": 21,
  "30d": 30,
  "3m": 90,
  "6m": 180,
  "1y": 365,
};

export const DEFAULT_PERIOD: AnalyticsPeriod = "30d";

export function isAnalyticsPeriod(value: unknown): value is AnalyticsPeriod {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(PERIOD_DAYS, value)
  );
}

export function parseAnalyticsPeriod(
  value: string | string[] | undefined,
): AnalyticsPeriod {
  const raw = Array.isArray(value) ? value[0] : value;
  return isAnalyticsPeriod(raw) ? raw : DEFAULT_PERIOD;
}

// ------------------------------------------------------------------
// KPIs
// ------------------------------------------------------------------
export type CountKpi = {
  current: number;
  previous: number;
  deltaPct: number | null; // null = pas de comparaison possible
};

export type RateKpi = {
  current: number | null;
  previous: number | null;
  deltaPts: number | null; // évolution en points de pourcentage
};

export function computeDeltaPct(
  current: number,
  previous: number,
): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

export function computeDeltaPts(
  current: number | null,
  previous: number | null,
): number | null {
  if (current === null || previous === null) return null;
  return current - previous;
}

// ------------------------------------------------------------------
// Séries & rows
// ------------------------------------------------------------------
export type VolumePoint = {
  date: string;
  dateLabel: string;
  received: number;
  sent: number;
};

export type DiscussionPoint = {
  date: string;
  dateLabel: string;
  count: number;
};

export type SourceDatum = { source: string; count: number };

export type MessageStatusKey =
  | "READ"
  | "DELIVERED"
  | "SENT"
  | "PENDING"
  | "FAILED";
export type StatusDatum = { status: MessageStatusKey; count: number };

export type TopContactRow = {
  id: string;
  name: string;
  phone: string;
  aiActive: boolean;
  received: number;
  sent: number;
  lastActivityLabel: string;
};

export type AnalyticsKpis = {
  received: CountKpi;
  sent: CountKpi;
  discussions: CountKpi;
  activeContacts: CountKpi;
  readRate: RateKpi;
  aiAutonomy: RateKpi;
};

export type AnalyticsOverview = {
  period: AnalyticsPeriod;
  rangeLabel: string;
  kpis: AnalyticsKpis;
  volumeSeries: VolumePoint[];
  discussionsSeries: DiscussionPoint[];
  statuses: StatusDatum[];
  sources: SourceDatum[];
  topContacts: TopContactRow[];
};

// ------------------------------------------------------------------
// Métadonnées des statuts (classes Tailwind statiques = purge-safe)
// ------------------------------------------------------------------
export const MESSAGE_STATUS_META: Record<
  MessageStatusKey,
  { label: string; bar: string }
> = {
  READ: { label: "Lus", bar: "bg-emerald-500" },
  DELIVERED: { label: "Distribués", bar: "bg-sky-500" },
  SENT: { label: "Envoyés", bar: "bg-indigo-400" },
  PENDING: { label: "En attente", bar: "bg-amber-500" },
  FAILED: { label: "Échecs", bar: "bg-red-500" },
};

// ------------------------------------------------------------------
// Formatage
// ------------------------------------------------------------------
export function formatNumberFr(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    notation: value >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatPctFr(
  value: number | null,
  maximumFractionDigits = 1,
): string {
  if (value === null) return "—";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits }).format(value)} %`;
}

// ------------------------------------------------------------------
// Bucketing UTC (jour / semaine lundi / mois) — cohérent serveur/client
// ------------------------------------------------------------------
const DAY_MS = 86_400_000;
const pad2 = (n: number) => String(n).padStart(2, "0");

function utcDayKey(date: Date): string {
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
}

export function getBucketMode(period: AnalyticsPeriod): BucketMode {
  if (period === "3m" || period === "6m") return "week";
  if (period === "1y") return "month";
  return "day";
}

export function bucketKeyFor(date: Date, mode: BucketMode): string {
  if (mode === "day") return utcDayKey(date);
  if (mode === "month")
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}`;
  // Semaine : on ramène au lundi (UTC)
  const d = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
  const dayOfWeek = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  return utcDayKey(d);
}

const dayMonthFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});
const monthYearFormatter = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "UTC",
  month: "short",
  year: "2-digit",
});

export function bucketLabel(key: string, mode: BucketMode): string {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  return mode === "month"
    ? monthYearFormatter.format(date)
    : dayMonthFormatter.format(date);
}

/** Génère les regroupements intersectant l'intervalle [start, endExclusive). */
export function buildBucketKeys(
  start: Date,
  endExclusive: Date,
  mode: BucketMode,
): string[] {
  if (start.getTime() >= endExclusive.getTime()) return [];

  const end = new Date(endExclusive.getTime() - 1);
  const keys: string[] = [];

  if (mode === "day") {
    let cursor = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
    );

    const lastDay = Date.UTC(
      end.getUTCFullYear(),
      end.getUTCMonth(),
      end.getUTCDate(),
    );

    while (cursor.getTime() <= lastDay) {
      keys.push(utcDayKey(cursor));
      cursor = new Date(cursor.getTime() + DAY_MS);
    }
  } else if (mode === "week") {
    let cursor = new Date(`${bucketKeyFor(start, "week")}T00:00:00.000Z`);

    while (cursor.getTime() <= end.getTime()) {
      keys.push(utcDayKey(cursor));
      cursor = new Date(cursor.getTime() + 7 * DAY_MS);
    }
  } else {
    let cursor = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1),
    );

    while (cursor.getTime() <= end.getTime()) {
      keys.push(`${cursor.getUTCFullYear()}-${pad2(cursor.getUTCMonth() + 1)}`);

      cursor = new Date(
        Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1),
      );
    }
  }

  return keys;
}
