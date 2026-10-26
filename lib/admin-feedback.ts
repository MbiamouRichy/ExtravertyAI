import { z } from "zod";
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import type { AdminIdentity } from "./admin-access";

export const FEEDBACK_KINDS = ["BUG", "IDEA", "PRAISE"] as const;
export const FEEDBACK_STATUSES = [
  "NEW",
  "IN_PROGRESS",
  "DONE",
  "ARCHIVED",
] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

export const FEEDBACK_PAGE_SIZE = 25;
export const INTERNAL_NOTE_MAX = 2000;
const SEARCH_MAX = 100;

// « OPEN » (par défaut) : tout sauf les archives, la vue de travail.
const StatusFilter = z.enum(["OPEN", "ALL", ...FEEDBACK_STATUSES]);
const PeriodFilter = z.enum(["7", "30", "90", "365", "all"]);

/**
 * Filtres lus dans l'URL : toute valeur inconnue retombe sur sa valeur par
 * défaut au lieu de casser la page.
 */
export const FeedbackFiltersSchema = z.object({
  kind: z.enum(["ALL", ...FEEDBACK_KINDS]).catch("ALL"),
  status: StatusFilter.catch("OPEN"),
  period: PeriodFilter.catch("all"),
  q: z
    .string()
    .trim()
    .transform((value) => value.slice(0, SEARCH_MAX))
    .catch(""),
  sort: z.enum(["desc", "asc"]).catch("desc"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1),
});
export type FeedbackFilters = z.infer<typeof FeedbackFiltersSchema>;
export const DEFAULT_FEEDBACK_FILTERS: FeedbackFilters =
  FeedbackFiltersSchema.parse({});

export function parseFeedbackFilters(
  params: Record<string, string | string[] | undefined>,
): FeedbackFilters {
  const first = (key: string) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] : value;
  };
  return FeedbackFiltersSchema.parse({
    kind: first("kind") ?? "ALL",
    status: first("status") ?? "OPEN",
    period: first("period") ?? "all",
    q: first("q") ?? "",
    sort: first("sort") ?? "desc",
    page: first("page") ?? 1,
  });
}

/** Paramètres d'URL sans les valeurs par défaut, pour des liens courts. */
export function feedbackFiltersToSearch(
  filters: Partial<FeedbackFilters> & { id?: string },
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === "") continue;
    if (
      key in DEFAULT_FEEDBACK_FILTERS &&
      DEFAULT_FEEDBACK_FILTERS[key as keyof FeedbackFilters] === value
    )
      continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}

// Période et recherche : communes à la liste et aux compteurs.
function scopeWhere(
  filters: FeedbackFilters,
  now: Date,
): Prisma.ProductFeedbackWhereInput {
  const where: Prisma.ProductFeedbackWhereInput = {};
  if (filters.period !== "all")
    where.createdAt = {
      gte: new Date(now.getTime() - Number(filters.period) * 86_400_000),
    };
  if (filters.q)
    where.OR = [
      { message: { contains: filters.q, mode: "insensitive" } },
      { user: { is: { email: { contains: filters.q, mode: "insensitive" } } } },
      { user: { is: { name: { contains: filters.q, mode: "insensitive" } } } },
      { project: { is: { name: { contains: filters.q, mode: "insensitive" } } } },
    ];
  return where;
}

export function buildFeedbackWhere(
  filters: FeedbackFilters,
  now = new Date(),
): Prisma.ProductFeedbackWhereInput {
  const where = scopeWhere(filters, now);
  if (filters.kind !== "ALL") where.kind = filters.kind;
  if (filters.status === "OPEN") where.status = { not: "ARCHIVED" };
  else if (filters.status !== "ALL") where.status = filters.status;
  return where;
}

// Ce que le back-office montre : ni téléphone ni données de conversation.
const LIST_SELECT = {
  id: true,
  kind: true,
  status: true,
  message: true,
  createdAt: true,
  user: { select: { name: true, email: true } },
  project: { select: { name: true } },
} satisfies Prisma.ProductFeedbackSelect;

export async function listFeedback(
  db: PrismaClient,
  filters: FeedbackFilters,
  now = new Date(),
) {
  const where = buildFeedbackWhere(filters, now);
  const scope = scopeWhere(filters, now);
  const [rows, total, byKind, byStatus] = await Promise.all([
    db.productFeedback.findMany({
      where,
      select: LIST_SELECT,
      orderBy: [{ createdAt: filters.sort }, { id: filters.sort }],
      skip: (filters.page - 1) * FEEDBACK_PAGE_SIZE,
      take: FEEDBACK_PAGE_SIZE,
    }),
    db.productFeedback.count({ where }),
    db.productFeedback.groupBy({ by: ["kind"], where: scope, _count: true }),
    db.productFeedback.groupBy({ by: ["status"], where: scope, _count: true }),
  ]);
  const kindCounts = Object.fromEntries(
    FEEDBACK_KINDS.map((kind) => [kind, 0]),
  ) as Record<FeedbackKind, number>;
  for (const row of byKind) kindCounts[row.kind] = row._count;
  const statusCounts = Object.fromEntries(
    FEEDBACK_STATUSES.map((status) => [status, 0]),
  ) as Record<FeedbackStatus, number>;
  for (const row of byStatus) statusCounts[row.status] = row._count;
  return {
    items: rows.map((row) => ({
      ...row,
      // Un aperçu suffit à la liste : le message complet reste dans le détail.
      message: row.message.length > 240 ? `${row.message.slice(0, 240)}…` : row.message,
    })),
    total,
    pageCount: Math.max(1, Math.ceil(total / FEEDBACK_PAGE_SIZE)),
    kindCounts,
    statusCounts,
  };
}
export type FeedbackListItem = Awaited<
  ReturnType<typeof listFeedback>
>["items"][number];

export async function getFeedbackDetail(db: PrismaClient, id: string) {
  if (!/^c[a-z0-9]{20,40}$/.test(id)) return null;
  const row = await db.productFeedback.findUnique({
    where: { id },
    select: {
      ...LIST_SELECT,
      pagePath: true,
      contactOk: true,
      handledAt: true,
      internalNote: true,
      handledBy: { select: { name: true } },
    },
  });
  if (!row) return null;
  return {
    ...row,
    // L'adresse n'est utilisable pour répondre que si l'auteur l'a accepté.
    replyEmail: row.contactOk ? (row.user?.email ?? null) : null,
  };
}
export type FeedbackDetail = NonNullable<
  Awaited<ReturnType<typeof getFeedbackDetail>>
>;

export const UpdateFeedbackSchema = z.object({
  id: z.string().regex(/^c[a-z0-9]{20,40}$/, "Retour introuvable."),
  status: z.enum(FEEDBACK_STATUSES),
  internalNote: z
    .string()
    .trim()
    .max(INTERNAL_NOTE_MAX, `${INTERNAL_NOTE_MAX} caractères au maximum.`),
});
export type UpdateFeedbackInput = z.infer<typeof UpdateFeedbackSchema>;

// Safe to show as is to the admin.
export class AdminFeedbackError extends Error {}

/** Toute action admin laisse une trace : qui, quoi, sur quoi, quand. */
export async function recordAdminAudit(
  db: Prisma.TransactionClient | PrismaClient,
  admin: AdminIdentity,
  entry: {
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await db.adminAuditLog.create({
    data: { actorId: admin.id, actorEmail: admin.email, ...entry },
  });
}

export async function updateFeedback(
  db: PrismaClient,
  admin: AdminIdentity,
  input: UpdateFeedbackInput,
) {
  return db.$transaction(async (tx) => {
    const current = await tx.productFeedback.findUnique({
      where: { id: input.id },
      select: { status: true, internalNote: true },
    });
    if (!current) throw new AdminFeedbackError("Ce retour n’existe plus.");
    const note = input.internalNote.trim() || null;
    const statusChanged = current.status !== input.status;
    const noteChanged = (current.internalNote ?? null) !== note;
    if (!statusChanged && !noteChanged) return { changed: false as const };
    await tx.productFeedback.update({
      where: { id: input.id },
      data: {
        status: input.status,
        internalNote: note,
        // Revenir à « Nouveau » efface la prise en charge.
        ...(statusChanged &&
          (input.status === "NEW"
            ? { handledAt: null, handledById: null }
            : { handledAt: new Date(), handledById: admin.id })),
      },
    });
    // Le contenu de la note reste hors du journal : seule sa modification compte.
    await recordAdminAudit(tx, admin, {
      action: "feedback.update",
      targetType: "ProductFeedback",
      targetId: input.id,
      metadata: {
        ...(statusChanged && { from: current.status, to: input.status }),
        noteChanged,
      },
    });
    return { changed: true as const };
  });
}
