import type { PrismaClient } from "../src/generated/prisma/client";
import { AI_FEATURES, type AiFeature } from "./ai-usage";

export const AI_FEATURE_LABEL: Record<AiFeature, string> = {
  reply: "Réponses aux clients",
  sandbox: "Tests de l’agent",
  summary: "Résumés de conversation",
  writing: "Aide à la rédaction",
  system_message: "Rédaction des consignes",
  image: "Lecture des images",
  audio: "Notes vocales",
  instinct: "Instinct IA",
};

/** Seuil mensuel par projet au-delà duquel le back-office le signale, en dollars. */
const DEFAULT_ALERT_USD = 5;

export function aiCostAlertUsd(value = process.env.AI_COST_ALERT_USD) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_ALERT_USD;
}

/** Premier mois consultable : le suivi des coûts commence en novembre 2026. */
export const FIRST_COST_MONTH = "2026-11";

export function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Mois « AAAA-MM » (UTC) demandé, ramené au mois courant s’il est invalide ou à venir. */
export function parseCostMonth(value: unknown, now = new Date()) {
  const current = monthKey(now);
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return current;
  if (value > current) return current;
  return value < FIRST_COST_MONTH ? FIRST_COST_MONTH : value;
}

export function monthBounds(key: string) {
  const [year, month] = key.split("-").map(Number);
  return {
    start: new Date(Date.UTC(year, month - 1, 1)),
    end: new Date(Date.UTC(year, month, 1)),
  };
}

export function shiftMonth(key: string, delta: number) {
  const { start } = monthBounds(key);
  start.setUTCMonth(start.getUTCMonth() + delta);
  return monthKey(start);
}

type Totals = {
  calls: number;
  /** Appels dont le fournisseur n’a pas communiqué le coût. */
  unpriced: number;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  costMicros: number;
};

const emptyTotals = (): Totals => ({
  calls: 0,
  unpriced: 0,
  promptTokens: 0,
  completionTokens: 0,
  cachedTokens: 0,
  costMicros: 0,
});

export type AiCostProject = Totals & {
  projectId: string | null;
  name: string;
  plan: string | null;
  /** Réponses aux clients facturées et leur coût, pour le coût moyen. */
  replies: number;
  replyCostMicros: number;
  overThreshold: boolean;
};

export type AiCostReport = {
  month: string;
  totals: Totals;
  previousCostMicros: number;
  /** Projection linéaire sur le mois entier, pour le mois en cours seulement. */
  projectedCostMicros: number | null;
  costPerReplyMicros: number | null;
  features: Array<Totals & { feature: AiFeature; label: string }>;
  projects: AiCostProject[];
  projectCount: number;
  overThreshold: number;
  thresholdUsd: number;
};

/**
 * Coûts IA d’un mois, par usage et par projet. Seules des sommes sortent
 * d’ici : aucun contenu de conversation n’est enregistré avec la mesure.
 */
export async function loadAiCosts(
  db: PrismaClient,
  month: string,
  { thresholdUsd = aiCostAlertUsd(), now = new Date(), limit = 50 } = {},
): Promise<AiCostReport> {
  const { start, end } = monthBounds(month);
  const previous = monthBounds(shiftMonth(month, -1));
  const [groups, before] = await Promise.all([
    db.aiUsage.groupBy({
      by: ["projectId", "feature"],
      where: { createdAt: { gte: start, lt: end } },
      _sum: { promptTokens: true, completionTokens: true, cachedTokens: true, costMicros: true },
      _count: { _all: true, costMicros: true },
    }),
    db.aiUsage.aggregate({
      where: { createdAt: { gte: previous.start, lt: previous.end } },
      _sum: { costMicros: true },
    }),
  ]);

  const totals = emptyTotals();
  const features = new Map<string, Totals>();
  const projects = new Map<string | null, Totals & { replies: number; replyCostMicros: number }>();
  for (const group of groups) {
    const row: Totals = {
      calls: group._count._all,
      unpriced: group._count._all - group._count.costMicros,
      promptTokens: group._sum.promptTokens ?? 0,
      completionTokens: group._sum.completionTokens ?? 0,
      cachedTokens: group._sum.cachedTokens ?? 0,
      costMicros: group._sum.costMicros ?? 0,
    };
    const feature = features.get(group.feature) ?? emptyTotals();
    const project = projects.get(group.projectId) ?? { ...emptyTotals(), replies: 0, replyCostMicros: 0 };
    for (const key of Object.keys(row) as Array<keyof Totals>) {
      totals[key] += row[key];
      feature[key] += row[key];
      project[key] += row[key];
    }
    if (group.feature === "reply") {
      project.replies += group._count.costMicros;
      project.replyCostMicros += row.costMicros;
    }
    features.set(group.feature, feature);
    projects.set(group.projectId, project);
  }

  const threshold = thresholdUsd * 1_000_000;
  const ranked = [...projects.entries()]
    .map(([projectId, value]) => ({ projectId, ...value }))
    .sort((a, b) => b.costMicros - a.costMicros || b.calls - a.calls);
  const shown = ranked.slice(0, limit);
  const ids = shown.flatMap((row) => (row.projectId ? [row.projectId] : []));
  const names = new Map(
    (
      await db.project.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, plan: true },
      })
    ).map((project) => [project.id, project]),
  );

  const replies = features.get("reply");
  const replyCalls = replies ? replies.calls - replies.unpriced : 0;
  const elapsed = Math.min(now.getTime(), end.getTime()) - start.getTime();
  const current = now >= start && now < end;
  return {
    month,
    totals,
    previousCostMicros: before._sum.costMicros ?? 0,
    projectedCostMicros:
      current && elapsed > 86_400_000
        ? Math.round((totals.costMicros * (end.getTime() - start.getTime())) / elapsed)
        : null,
    costPerReplyMicros: replies && replyCalls ? replies.costMicros / replyCalls : null,
    features: AI_FEATURES.flatMap((feature) => {
      const value = features.get(feature);
      return value ? [{ feature, label: AI_FEATURE_LABEL[feature], ...value }] : [];
    }).sort((a, b) => b.costMicros - a.costMicros || b.calls - a.calls),
    projects: shown.map((row) => {
      const project = row.projectId ? names.get(row.projectId) : undefined;
      return {
        ...row,
        name: project?.name ?? "Projet supprimé",
        plan: project?.plan ?? null,
        overThreshold: row.costMicros > threshold,
      };
    }),
    projectCount: ranked.length,
    overThreshold: ranked.filter((row) => row.costMicros > threshold).length,
    thresholdUsd,
  };
}
