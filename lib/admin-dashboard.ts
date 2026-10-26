import { z } from "zod";
import { Prisma, type PrismaClient } from "../src/generated/prisma/client";
import { PRICING_PLANS, type PlanId } from "./pricing";

/** Périodes du tableau de bord : du jour près (30, 90 jours) au mois près (1 ou 2 ans). */
export const DASHBOARD_RANGES = {
  "30d": { unit: "day", count: 30, label: "30 jours", previous: "vs 30 j. précédents" },
  "90d": { unit: "day", count: 90, label: "90 jours", previous: "vs 90 j. précédents" },
  "12m": { unit: "month", count: 12, label: "12 mois", previous: "vs 12 mois préc." },
  "24m": { unit: "month", count: 24, label: "24 mois", previous: "vs 24 mois préc." },
} as const;
export type DashboardRange = keyof typeof DASHBOARD_RANGES;
export const DashboardRangeSchema = z
  .enum(Object.keys(DASHBOARD_RANGES) as [DashboardRange, ...DashboardRange[]])
  .catch("12m");

const DAY = 86_400_000;
/** Un renouvellement peut arriver jusqu'à 14 jours après l'échéance (paiement en retard). */
const RENEWAL_WINDOW_MS = 14 * DAY;
/** Échéances trop récentes : le paiement peut encore être en cours. */
const RENEWAL_GRACE_MS = 3 * DAY;

export function dashboardPeriod(range: DashboardRange, now = new Date()) {
  const { unit, count } = DASHBOARD_RANGES[range];
  const shift = (offset: number) =>
    unit === "day"
      ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset))
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
  const keys = Array.from({ length: count }, (_, index) =>
    bucketKey(shift(index - count + 1)),
  );
  return {
    unit,
    keys,
    start: shift(1 - count),
    previousStart: shift(1 - 2 * count),
    end: now,
  } as const;
}
export type DashboardPeriod = ReturnType<typeof dashboardPeriod>;

export function bucketKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
function bucketOf(date: Date, unit: "day" | "month") {
  return unit === "day"
    ? bucketKey(date)
    : `${date.toISOString().slice(0, 7)}-01`;
}

export type SeriesPoint = { key: string; value: number };
function fill(keys: readonly string[], values: Map<string, number>): SeriesPoint[] {
  return keys.map((key) => ({ key, value: values.get(key) ?? 0 }));
}

export function delta(current: number, previous: number) {
  if (!previous) return current ? null : 0;
  return (current - previous) / previous;
}

type BucketRow = { bucket: string; value: number };
async function countCreated(
  db: PrismaClient,
  table: "user" | "project",
  period: DashboardPeriod,
) {
  // Nom de table pris dans une liste fermée, jamais dans l'entrée utilisateur.
  const rows = await db.$queryRaw<BucketRow[]>`
    SELECT to_char(date_trunc(${period.unit}, "createdAt"), 'YYYY-MM-DD') AS bucket,
           count(*)::int AS value
    FROM ${Prisma.raw(`"${table}"`)}
    WHERE "createdAt" >= ${period.start}
    GROUP BY 1`;
  const [total, current, previous] = await Promise.all([
    table === "user" ? db.user.count() : db.project.count(),
    table === "user"
      ? db.user.count({ where: { createdAt: { gte: period.start } } })
      : db.project.count({ where: { createdAt: { gte: period.start } } }),
    table === "user"
      ? db.user.count({ where: { createdAt: { gte: period.previousStart, lt: period.start } } })
      : db.project.count({ where: { createdAt: { gte: period.previousStart, lt: period.start } } }),
  ]);
  return {
    total,
    current,
    previous,
    series: fill(period.keys, new Map(rows.map((row) => [row.bucket, row.value]))),
  };
}

// Visiteurs = visiteurs uniques par jour, additionnés (l'empreinte change chaque jour).
async function visitorStats(db: PrismaClient, period: DashboardPeriod) {
  const rows = await db.$queryRaw<{ bucket: string; visitors: number; views: number }[]>`
    SELECT to_char(date_trunc(${period.unit}, "createdAt"), 'YYYY-MM-DD') AS bucket,
           count(DISTINCT ("visitorHash", "createdAt"::date))::int AS visitors,
           count(*)::int AS views
    FROM "page_view"
    WHERE "createdAt" >= ${period.start}
    GROUP BY 1`;
  const [previous] = await db.$queryRaw<{ visitors: number }[]>`
    SELECT count(DISTINCT ("visitorHash", "createdAt"::date))::int AS visitors
    FROM "page_view"
    WHERE "createdAt" >= ${period.previousStart} AND "createdAt" < ${period.start}`;
  const [online] = await db.$queryRaw<{ visitors: number }[]>`
    SELECT count(DISTINCT "visitorHash")::int AS visitors
    FROM "page_view"
    WHERE "createdAt" >= ${new Date(period.end.getTime() - 5 * 60_000)}`;
  const visitors = fill(period.keys, new Map(rows.map((row) => [row.bucket, row.visitors])));
  const views = fill(period.keys, new Map(rows.map((row) => [row.bucket, row.views])));
  return {
    visitors,
    views,
    current: visitors.reduce((sum, point) => sum + point.value, 0),
    previous: previous?.visitors ?? 0,
    online: online?.visitors ?? 0,
  };
}

export type ShareRow = { label: string; value: number; share: number };
const TOP_COLUMNS = {
  country: '"country"',
  path: '"path"',
  browser: '"browser"',
  device: '"device"',
  referrerHost: '"referrerHost"',
} as const;
async function topBy(
  db: PrismaClient,
  column: keyof typeof TOP_COLUMNS,
  period: DashboardPeriod,
  limit = 6,
): Promise<ShareRow[]> {
  const col = Prisma.raw(TOP_COLUMNS[column]);
  // Pages : vues ; le reste : visiteurs uniques par jour.
  const measure =
    column === "path"
      ? Prisma.sql`count(*)::int`
      : Prisma.sql`count(DISTINCT ("visitorHash", "createdAt"::date))::int`;
  const rows = await db.$queryRaw<{ label: string | null; value: number }[]>`
    SELECT ${col} AS label, ${measure} AS value
    FROM "page_view"
    WHERE "createdAt" >= ${period.start}
      ${column === "referrerHost" ? Prisma.sql`AND "referrerHost" IS NOT NULL` : Prisma.empty}
    GROUP BY 1
    ORDER BY 2 DESC, 1 ASC`;
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const top = rows.slice(0, limit).map((row) => ({
    label: row.label ?? "Inconnu",
    value: row.value,
    share: total ? row.value / total : 0,
  }));
  const rest = rows.slice(limit).reduce((sum, row) => sum + row.value, 0);
  // Au-delà du top : regroupé en « Autres », jamais une couleur de plus.
  if (rest) top.push({ label: "Autres", value: rest, share: rest / total });
  return top;
}

/** Messages moyens par projet actif, selon l'offre actuelle du projet. */
async function messagesPerPlan(db: PrismaClient, period: DashboardPeriod) {
  const rows = await db.$queryRaw<
    { bucket: string; plan: PlanId; messages: number; projects: number }[]
  >`
    SELECT to_char(date_trunc(${period.unit}, m."createdAt"), 'YYYY-MM-DD') AS bucket,
           p."plan"::text AS plan,
           count(*)::int AS messages,
           count(DISTINCT m."projectId")::int AS projects
    FROM "message" m
    JOIN "project" p ON p."id" = m."projectId"
    WHERE m."createdAt" >= ${period.start}
    GROUP BY 1, 2`;
  const byKey = new Map(period.keys.map((key) => [key, { key } as Record<string, number | string>]));
  for (const row of rows) {
    const point = byKey.get(row.bucket);
    if (point) point[row.plan] = row.projects ? Math.round(row.messages / row.projects) : 0;
  }
  return [...byKey.values()].map((point) => ({
    key: point.key as string,
    starter: (point.starter as number) ?? 0,
    pro: (point.pro as number) ?? 0,
    business: (point.business as number) ?? 0,
  }));
}

export type BillingPeriodRow = {
  projectId: string;
  key: string;
  startsAt: Date;
  endsAt: Date;
  limit: number;
};

/**
 * Renouvellements, désabonnements (churn) et essais convertis, à partir des
 * périodes de facturation : `cycle:` = mois payé, `trial:` = essai.
 */
export function subscriptionFlows(
  periods: BillingPeriodRow[],
  period: DashboardPeriod,
) {
  const cyclesByProject = new Map<string, BillingPeriodRow[]>();
  for (const row of periods)
    if (row.key.startsWith("cycle:"))
      cyclesByProject.set(row.projectId, [...(cyclesByProject.get(row.projectId) ?? []), row]);
  const settled = period.end.getTime() - RENEWAL_GRACE_MS;
  const due = new Map<string, { due: number; renewed: number; trials: number; converted: number }>();
  const slot = (key: string) => {
    const value = due.get(key) ?? { due: 0, renewed: 0, trials: 0, converted: 0 };
    due.set(key, value);
    return value;
  };
  const totals = { current: { due: 0, renewed: 0 }, previous: { due: 0, renewed: 0 } };
  for (const row of periods) {
    const end = row.endsAt.getTime();
    if (end > settled || row.endsAt < period.previousStart) continue;
    const cycles = cyclesByProject.get(row.projectId) ?? [];
    const inRange = row.endsAt >= period.start;
    if (row.key.startsWith("cycle:")) {
      const renewed = cycles.some(
        (other) =>
          other !== row &&
          other.startsAt.getTime() >= end - 2 * DAY &&
          other.startsAt.getTime() <= end + RENEWAL_WINDOW_MS,
      );
      const bucket = totals[inRange ? "current" : "previous"];
      bucket.due += 1;
      if (renewed) bucket.renewed += 1;
      if (inRange) {
        const value = slot(bucketOf(row.endsAt, period.unit));
        value.due += 1;
        if (renewed) value.renewed += 1;
      }
    } else if (row.key.startsWith("trial:") && inRange) {
      // Payer avant la fin de l'essai compte aussi comme une conversion.
      const converted = cycles.some(
        (other) =>
          other.startsAt >= row.startsAt &&
          other.startsAt.getTime() <= end + RENEWAL_WINDOW_MS,
      );
      const value = slot(bucketOf(row.endsAt, period.unit));
      value.trials += 1;
      if (converted) value.converted += 1;
    }
  }
  return {
    series: period.keys.map((key) => {
      const value = due.get(key) ?? { due: 0, renewed: 0, trials: 0, converted: 0 };
      return {
        key,
        due: value.due,
        renewed: value.renewed,
        churned: value.due - value.renewed,
        renewalRate: value.due ? value.renewed / value.due : null,
        trials: value.trials,
        converted: value.converted,
      };
    }),
    churned: totals.current.due - totals.current.renewed,
    previousChurned: totals.previous.due - totals.previous.renewed,
    renewalRate: totals.current.due ? totals.current.renewed / totals.current.due : null,
  };
}

const PRICE_BY_LIMIT = new Map<number, number>(
  PRICING_PLANS.map((plan) => [plan.messageLimit, plan.priceCents]),
);

/** Revenu estimé quand Stripe est injoignable : mois payés × prix catalogue (USD). */
export function estimateRevenue(periods: BillingPeriodRow[], period: DashboardPeriod) {
  const values = new Map<string, number>();
  let current = 0;
  let previous = 0;
  for (const row of periods) {
    if (!row.key.startsWith("cycle:") || row.startsAt < period.previousStart) continue;
    const cents = PRICE_BY_LIMIT.get(row.limit) ?? 0;
    if (row.startsAt < period.start) {
      previous += cents;
      continue;
    }
    current += cents;
    const key = bucketOf(row.startsAt, period.unit);
    values.set(key, (values.get(key) ?? 0) + cents);
  }
  return {
    source: "estimate" as const,
    currency: "USD",
    current: current / 100,
    previous: previous / 100,
    series: fill(period.keys, values).map((point) => ({ ...point, value: point.value / 100 })),
    otherCurrencies: [] as string[],
  };
}

// Devises sans centimes chez Stripe (montants déjà en unités).
const ZERO_DECIMAL = new Set(
  "bif clp djf gnf jpy kmf krw mga pyg rwf ugx vnd vuv xaf xof xpf".split(" "),
);
export type PaidInvoice = { amount: number; currency: string; paidAt: Date };

/** Revenu encaissé (factures Stripe payées), dans la devise principale. */
export function bucketRevenue(invoices: PaidInvoice[], period: DashboardPeriod) {
  const byCurrency = new Map<string, number>();
  for (const invoice of invoices)
    if (invoice.paidAt >= period.start)
      byCurrency.set(invoice.currency, (byCurrency.get(invoice.currency) ?? 0) + invoice.amount);
  const currency =
    [...byCurrency.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ??
    invoices[0]?.currency ??
    "usd";
  const unit = ZERO_DECIMAL.has(currency) ? 1 : 100;
  const values = new Map<string, number>();
  let current = 0;
  let previous = 0;
  for (const invoice of invoices) {
    if (invoice.currency !== currency || invoice.paidAt < period.previousStart) continue;
    const amount = invoice.amount / unit;
    if (invoice.paidAt < period.start) {
      previous += amount;
      continue;
    }
    current += amount;
    const key = bucketOf(invoice.paidAt, period.unit);
    values.set(key, (values.get(key) ?? 0) + amount);
  }
  return {
    source: "stripe" as const,
    currency: currency.toUpperCase(),
    current,
    previous,
    series: fill(period.keys, values),
    otherCurrencies: [...byCurrency.keys()]
      .filter((other) => other !== currency)
      .map((other) => other.toUpperCase()),
  };
}
export type RevenueStats = ReturnType<typeof bucketRevenue> | ReturnType<typeof estimateRevenue>;

export async function loadBillingPeriods(db: PrismaClient, period: DashboardPeriod) {
  return db.quotaPeriod.findMany({
    where: {
      // Les successeurs d'une période finissent forcément après elle.
      endsAt: { gte: period.previousStart },
      OR: [{ key: { startsWith: "cycle:" } }, { key: { startsWith: "trial:" } }],
    },
    select: { projectId: true, key: true, startsAt: true, endsAt: true, limit: true },
  });
}

export async function loadDashboard(db: PrismaClient, range: DashboardRange, now = new Date()) {
  const period = dashboardPeriod(range, now);
  const [users, projects, visitors, countries, pages, browsers, devices, referrers, messages, periods] =
    await Promise.all([
      countCreated(db, "user", period),
      countCreated(db, "project", period),
      visitorStats(db, period),
      topBy(db, "country", period),
      topBy(db, "path", period, 8),
      topBy(db, "browser", period, 5),
      topBy(db, "device", period, 3),
      topBy(db, "referrerHost", period),
      messagesPerPlan(db, period),
      loadBillingPeriods(db, period),
    ]);
  const flows = subscriptionFlows(periods, period);
  // Inscriptions pour 100 visiteurs, sur la même période.
  const conversion = period.keys.map((key, index) => {
    const seen = visitors.visitors[index].value;
    const signups = users.series[index].value;
    return { key, visitors: seen, signups, rate: seen ? signups / seen : null };
  });
  return {
    period,
    users,
    projects,
    visitors,
    countries,
    pages,
    browsers,
    devices,
    referrers,
    messages,
    flows,
    conversion,
  };
}
export type DashboardData = Awaited<ReturnType<typeof loadDashboard>>;
