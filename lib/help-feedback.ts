import { createHmac } from "node:crypto";
import { z } from "zod";
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import type { AdminIdentity } from "./admin-access";
import { recordAdminAudit } from "./admin-feedback";
import { isHelpArticleSlug } from "./help-center/articles";
import { HELP_ARTICLES } from "./help-center/content";
import {
  DEFAULT_HELP_FEEDBACK_FILTERS,
  HELP_FEEDBACK_PERIODS,
  HELP_FEEDBACK_STATUSES,
  HELP_INTERNAL_NOTE_MAX,
  type HelpFeedbackFilters,
  type HelpFeedbackStatusValue,
  type HelpFeedbackValues,
} from "./help-center/feedback-shared";

/**
 * Votes du centre d’aide (/aide) et leur suivi dans le back-office (/admin/aide).
 *
 * Un visiteur n’a qu’un vote par article et par jour : un nouveau clic le
 * remplace. Le visiteur est désigné par une empreinte quotidienne (HMAC du
 * jour, du compte ou de l’adresse IP et du navigateur) : ni l’IP ni le
 * navigateur ne sont conservés, et l’empreinte change chaque jour.
 */

export const HELP_FEEDBACK_PAGE_SIZE = 25;
const ID_PATTERN = /^c[a-z0-9]{20,40}$/;

export function helpFeedbackVisitorHash(
  secret: string,
  visitor: { userId?: string | null; ip: string; userAgent: string },
  now = new Date(),
) {
  const day = now.toISOString().slice(0, 10);
  const identity = visitor.userId ? `user:${visitor.userId}` : `anon:${visitor.ip}|${visitor.userAgent}`;
  return createHmac("sha256", secret)
    .update(`help-feedback|${day}|${identity}`)
    .digest("base64url")
    .slice(0, 22);
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

// Erreur dont le message peut être montré tel quel.
export class HelpFeedbackError extends Error {}

export async function recordHelpFeedback(
  db: PrismaClient,
  values: HelpFeedbackValues,
  visitor: { visitorHash: string; userId: string | null },
) {
  if (!isHelpArticleSlug(values.articleSlug)) throw new HelpFeedbackError("Cet article n’existe pas.");
  const key = { articleSlug_visitorHash: { articleSlug: values.articleSlug, visitorHash: visitor.visitorHash } };
  const vote = { helpful: values.helpful, reason: values.reason, comment: values.comment };

  const existing = await db.helpFeedback.findUnique({
    where: key,
    select: { helpful: true, reason: true, comment: true },
  });
  if (!existing) {
    try {
      await db.helpFeedback.create({
        data: { articleSlug: values.articleSlug, visitorHash: visitor.visitorHash, userId: visitor.userId, ...vote },
      });
      return { created: true as const };
    } catch (error) {
      // Deux clics simultanés : le second met à jour le vote du premier.
      if (!isUniqueViolation(error)) throw error;
    }
  } else if (
    existing.helpful === vote.helpful &&
    existing.reason === vote.reason &&
    existing.comment === vote.comment
  ) {
    return { created: false as const };
  }
  await db.helpFeedback.update({
    where: key,
    data: {
      ...vote,
      ...(visitor.userId ? { userId: visitor.userId } : {}),
      // Un avis modifié redevient à traiter ; la note interne est conservée.
      status: "NEW",
      handledAt: null,
      handledById: null,
    },
  });
  return { created: false as const };
}

/* ------------------------------------------------------------------ */
/* Back-office                                                         */
/* ------------------------------------------------------------------ */

const ARTICLE_SLUGS = HELP_ARTICLES.map((article) => article.slug) as [string, ...string[]];

const HelpFeedbackFiltersSchema = z.object({
  vote: z.enum(["ALL", "DOWN", "UP"]).catch("ALL"),
  // « OPEN » (par défaut) : tout sauf les archives, la vue de travail.
  status: z.enum(["OPEN", "ALL", ...HELP_FEEDBACK_STATUSES]).catch("OPEN"),
  article: z.enum(["ALL", ...ARTICLE_SLUGS]).catch("ALL"),
  period: z.enum(HELP_FEEDBACK_PERIODS).catch("30"),
  comments: z.enum(["all", "with"]).catch("all"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});

export function parseHelpFeedbackFilters(params: Record<string, string | string[] | undefined>): HelpFeedbackFilters {
  // Toute valeur inconnue retombe sur sa valeur par défaut au lieu de casser la page.
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  return HelpFeedbackFiltersSchema.parse({
    vote: first("vote") ?? DEFAULT_HELP_FEEDBACK_FILTERS.vote,
    status: first("status") ?? DEFAULT_HELP_FEEDBACK_FILTERS.status,
    article: first("article") ?? DEFAULT_HELP_FEEDBACK_FILTERS.article,
    period: first("period") ?? DEFAULT_HELP_FEEDBACK_FILTERS.period,
    comments: first("comments") ?? DEFAULT_HELP_FEEDBACK_FILTERS.comments,
    page: first("page") ?? 1,
  });
}

function periodWhere(filters: HelpFeedbackFilters, now: Date): Prisma.HelpFeedbackWhereInput {
  return filters.period === "all"
    ? {}
    : { createdAt: { gte: new Date(now.getTime() - Number(filters.period) * 86_400_000) } };
}

export function buildHelpFeedbackWhere(filters: HelpFeedbackFilters, now = new Date()): Prisma.HelpFeedbackWhereInput {
  const where: Prisma.HelpFeedbackWhereInput = periodWhere(filters, now);
  if (filters.article !== "ALL") where.articleSlug = filters.article;
  if (filters.vote !== "ALL") where.helpful = filters.vote === "UP";
  if (filters.status === "OPEN") where.status = { not: "ARCHIVED" };
  else if (filters.status !== "ALL") where.status = filters.status;
  if (filters.comments === "with") where.comment = { not: null };
  return where;
}

// Ce que le back-office montre : jamais l’empreinte du visiteur.
const LIST_SELECT = {
  id: true,
  articleSlug: true,
  helpful: true,
  reason: true,
  comment: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  user: { select: { name: true, email: true } },
} satisfies Prisma.HelpFeedbackSelect;

export type HelpArticleStat = {
  slug: string;
  title: string;
  up: number;
  down: number;
  total: number;
  /** Part des avis positifs, de 0 à 1 ; null sans aucun vote. */
  score: number | null;
  /** Avis négatifs encore à traiter, tous statuts sauf « Traité » et « Archivé ». */
  pending: number;
};

export async function listHelpFeedback(db: PrismaClient, filters: HelpFeedbackFilters, now = new Date()) {
  const where = buildHelpFeedbackWhere(filters, now);
  const period = periodWhere(filters, now);
  const [rows, total, byArticle, pendingByArticle, byStatus] = await Promise.all([
    db.helpFeedback.findMany({
      where,
      select: LIST_SELECT,
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * HELP_FEEDBACK_PAGE_SIZE,
      take: HELP_FEEDBACK_PAGE_SIZE,
    }),
    db.helpFeedback.count({ where }),
    db.helpFeedback.groupBy({ by: ["articleSlug", "helpful"], where: period, _count: true }),
    db.helpFeedback.groupBy({ by: ["articleSlug"], where: { ...period, helpful: false, status: "NEW" }, _count: true }),
    db.helpFeedback.groupBy({
      by: ["status"],
      where: { ...period, ...(filters.article !== "ALL" && { articleSlug: filters.article }) },
      _count: true,
    }),
  ]);

  const stats = new Map<string, HelpArticleStat>(
    HELP_ARTICLES.map((article) => [
      article.slug,
      { slug: article.slug, title: article.title, up: 0, down: 0, total: 0, score: null, pending: 0 },
    ]),
  );
  for (const row of byArticle) {
    const stat = stats.get(row.articleSlug);
    if (!stat) continue;
    if (row.helpful) stat.up += row._count;
    else stat.down += row._count;
  }
  for (const row of pendingByArticle) {
    const stat = stats.get(row.articleSlug);
    if (stat) stat.pending = row._count;
  }
  const articles = [...stats.values()]
    .map((stat) => {
      const totalVotes = stat.up + stat.down;
      return { ...stat, total: totalVotes, score: totalVotes ? stat.up / totalVotes : null };
    })
    .filter((stat) => stat.total > 0)
    // Les articles qui posent problème d’abord.
    .sort((a, b) => b.pending - a.pending || b.down - a.down || (a.score ?? 1) - (b.score ?? 1));

  const statusCounts = Object.fromEntries(HELP_FEEDBACK_STATUSES.map((status) => [status, 0])) as Record<
    HelpFeedbackStatusValue,
    number
  >;
  for (const row of byStatus) statusCounts[row.status] = row._count;

  const totals = articles.reduce(
    (sum, stat) => ({ up: sum.up + stat.up, down: sum.down + stat.down }),
    { up: 0, down: 0 },
  );

  return {
    items: rows.map((row) => ({
      ...row,
      comment: row.comment && row.comment.length > 200 ? `${row.comment.slice(0, 200)}…` : row.comment,
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / HELP_FEEDBACK_PAGE_SIZE)),
    articles,
    statusCounts,
    totals: { ...totals, score: totals.up + totals.down ? totals.up / (totals.up + totals.down) : null },
  };
}
export type HelpFeedbackListItem = Awaited<ReturnType<typeof listHelpFeedback>>["items"][number];

export async function getHelpFeedbackDetail(db: PrismaClient, id: string) {
  if (!ID_PATTERN.test(id)) return null;
  return db.helpFeedback.findUnique({
    where: { id },
    select: {
      ...LIST_SELECT,
      handledAt: true,
      internalNote: true,
      handledBy: { select: { name: true } },
    },
  });
}
export type HelpFeedbackDetail = NonNullable<Awaited<ReturnType<typeof getHelpFeedbackDetail>>>;

export const UpdateHelpFeedbackSchema = z.object({
  id: z.string().regex(ID_PATTERN, "Avis introuvable."),
  status: z.enum(HELP_FEEDBACK_STATUSES),
  internalNote: z
    .string()
    .trim()
    .max(HELP_INTERNAL_NOTE_MAX, `${HELP_INTERNAL_NOTE_MAX} caractères au maximum.`),
});
export type UpdateHelpFeedbackInput = z.infer<typeof UpdateHelpFeedbackSchema>;

export async function updateHelpFeedback(db: PrismaClient, admin: AdminIdentity, input: UpdateHelpFeedbackInput) {
  return db.$transaction(async (tx) => {
    const current = await tx.helpFeedback.findUnique({
      where: { id: input.id },
      select: { status: true, internalNote: true },
    });
    if (!current) throw new HelpFeedbackError("Cet avis n’existe plus.");
    const note = input.internalNote.trim() || null;
    const statusChanged = current.status !== input.status;
    const noteChanged = (current.internalNote ?? null) !== note;
    if (!statusChanged && !noteChanged) return { changed: false as const };
    await tx.helpFeedback.update({
      where: { id: input.id },
      data: {
        status: input.status,
        internalNote: note,
        ...(statusChanged &&
          (input.status === "NEW"
            ? { handledAt: null, handledById: null }
            : { handledAt: new Date(), handledById: admin.id })),
      },
    });
    // Le contenu de la note reste hors du journal : seule sa modification compte.
    await recordAdminAudit(tx, admin, {
      action: "help_feedback.update",
      targetType: "HelpFeedback",
      targetId: input.id,
      metadata: { ...(statusChanged && { from: current.status, to: input.status }), noteChanged },
    });
    return { changed: true as const };
  });
}
