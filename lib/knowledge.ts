import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { planFeatures } from "./plan-features";
import { requireProjectAdmin } from "./project-settings";
import { StorageQuotaError, releaseStorage, reserveStorage } from "./storage-quota";
import { SafeFetchError, parsePublicUrl } from "./safe-fetch";
import { MAX_DEAL_VALUE } from "./pipeline-shared";
import { can } from "./project-permissions";
import {
  KNOWLEDGE_LIMITS,
  buildSearchQuery,
  chunkText,
  entrySearchText,
  formatKnowledgeBlock,
  parseProductsCsv,
  type RetrievedEntry,
} from "./knowledge-shared";

// Safe to show as is to the user.
export class KnowledgeError extends Error {}

type Admin = { projectId: string; userId: string };

// Imports write up to thousands of indexed rows in one transaction.
const BULK_TRANSACTION = { timeout: 30_000, maxWait: 10_000 };

export const EntryPayloadSchema = z.object({
  kind: z.enum(["FAQ", "TEXT", "PRODUCT"]),
  title: z.string().trim().min(1).max(KNOWLEDGE_LIMITS.titleMax),
  content: z.string().trim().max(KNOWLEDGE_LIMITS.contentMax),
  price: z.number().int().min(0).max(MAX_DEAL_VALUE).nullable(),
  stock: z.number().int().min(0).max(1_000_000_000).nullable(),
});
export type EntryPayload = z.infer<typeof EntryPayloadSchema>;

async function lockAdmin(tx: Prisma.TransactionClient, { projectId, userId }: Admin) {
  await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
  const { project } = await requireProjectAdmin(tx, projectId, userId);
  if (project.deletionPending) {
    throw new KnowledgeError("Ce projet est en cours de suppression.");
  }
  return project;
}

async function remainingEntries(
  tx: Prisma.TransactionClient,
  projectId: string,
  plan: string,
) {
  const used = await tx.knowledgeEntry.count({ where: { projectId } });
  return planFeatures(plan).knowledgeEntries - used;
}

function limitMessage(plan: string) {
  return `Limite de ${planFeatures(plan).knowledgeEntries.toLocaleString("fr-FR")} entrées atteinte pour votre offre. Supprimez des entrées ou changez d’offre.`;
}

/* -------------------------------------------------------------------------- */
/* Entries                                                                     */
/* -------------------------------------------------------------------------- */

export async function saveEntry(
  db: PrismaClient,
  input: Admin & { id?: string; entry: EntryPayload },
) {
  const entry = EntryPayloadSchema.parse(input.entry);
  const content = entry.content || (entry.kind === "PRODUCT" ? entry.title : "");
  if (!content) throw new KnowledgeError("Le contenu est obligatoire.");
  return db.$transaction(async (tx) => {
    const project = await lockAdmin(tx, input);
    const data = {
      kind: entry.kind,
      title: entry.title,
      content,
      price: entry.kind === "PRODUCT" ? entry.price : null,
      stock: entry.kind === "PRODUCT" ? entry.stock : null,
      searchText: entrySearchText({ title: entry.title, content, price: entry.price }),
    };
    if (input.id) {
      const existing = await tx.knowledgeEntry.findFirst({
        where: { id: input.id, projectId: input.projectId, kind: { not: "CHUNK" } },
        select: { id: true },
      });
      if (!existing) throw new KnowledgeError("Entrée introuvable.");
      return tx.knowledgeEntry.update({ where: { id: input.id }, data, select: { id: true } });
    }
    if ((await remainingEntries(tx, input.projectId, project.plan)) < 1) {
      throw new KnowledgeError(limitMessage(project.plan));
    }
    return tx.knowledgeEntry.create({
      data: { ...data, projectId: input.projectId, createdById: input.userId },
      select: { id: true },
    });
  });
}

export async function setEntryEnabled(
  db: PrismaClient,
  input: Admin & { id: string; enabled: boolean },
) {
  await db.$transaction(async (tx) => {
    await lockAdmin(tx, input);
    const result = await tx.knowledgeEntry.updateMany({
      where: { id: input.id, projectId: input.projectId },
      data: { enabled: input.enabled },
    });
    if (!result.count) throw new KnowledgeError("Entrée introuvable.");
  });
}

export async function deleteEntry(db: PrismaClient, input: Admin & { id: string }) {
  await db.$transaction(async (tx) => {
    await lockAdmin(tx, input);
    await tx.knowledgeEntry.deleteMany({ where: { id: input.id, projectId: input.projectId } });
  });
}

/* -------------------------------------------------------------------------- */
/* Sources                                                                     */
/* -------------------------------------------------------------------------- */

async function requireSourceCapacity(
  tx: Prisma.TransactionClient,
  projectId: string,
  plan: string,
) {
  const used = await tx.knowledgeSource.count({
    where: { projectId, type: { in: ["PDF", "URL"] } },
  });
  const limit = planFeatures(plan).knowledgeSources;
  if (used >= limit) {
    throw new KnowledgeError(
      `Limite de ${limit} documents (PDF ou pages web) atteinte pour votre offre.`,
    );
  }
}

export function urlErrorMessage(error: unknown): string {
  if (error instanceof SafeFetchError && error.code === "BLOCKED_ADDRESS") {
    return "Cette adresse n’est pas accessible publiquement.";
  }
  return "Saisissez une adresse publique en https://, par exemple https://maboutique.com/livraison.";
}

export async function addUrlSource(db: PrismaClient, input: Admin & { url: string }) {
  let url: URL;
  try {
    url = parsePublicUrl(input.url);
  } catch (error) {
    throw new KnowledgeError(urlErrorMessage(error));
  }
  url.hash = "";
  return db.$transaction(async (tx) => {
    const project = await lockAdmin(tx, input);
    const duplicate = await tx.knowledgeSource.findFirst({
      where: { projectId: input.projectId, type: "URL", url: url.toString() },
      select: { id: true },
    });
    if (duplicate) throw new KnowledgeError("Cette page est déjà importée.");
    await requireSourceCapacity(tx, input.projectId, project.plan);
    return tx.knowledgeSource.create({
      data: {
        projectId: input.projectId,
        type: "URL",
        name: (url.hostname + url.pathname).slice(0, 200),
        url: url.toString(),
        createdById: input.userId,
      },
      select: { id: true },
    });
  });
}

export function isPdf(bytes: Uint8Array): boolean {
  return Buffer.from(bytes.subarray(0, 5)).toString("latin1") === "%PDF-";
}

export function knowledgeFileKey(projectId: string, id: string) {
  return `knowledge/${projectId}/${id}.pdf`;
}

/**
 * The file is stored first under an unguessable key, then the source row is
 * created; when the row cannot be created the caller removes the file.
 */
export async function addPdfSource(
  db: PrismaClient,
  input: Admin & { fileName: string; bytes: Buffer },
  storage: {
    put: (key: string, bytes: Buffer) => Promise<void>;
    remove: (key: string) => Promise<void>;
  },
) {
  if (!input.bytes.length || input.bytes.length > KNOWLEDGE_LIMITS.pdfMaxBytes || !isPdf(input.bytes)) {
    throw new KnowledgeError("Choisissez un fichier PDF de 10 Mo au maximum.");
  }
  // Fail fast on rights and limits before uploading anything.
  await db.$transaction(async (tx) => {
    const project = await lockAdmin(tx, input);
    const { pdfMaxMb } = planFeatures(project.plan);
    if (input.bytes.length > pdfMaxMb * 1024 * 1024) {
      throw new KnowledgeError(`Votre offre accepte des PDF de ${pdfMaxMb} Mo au maximum.`);
    }
    await requireSourceCapacity(tx, input.projectId, project.plan);
  });
  const id = randomUUID();
  const key = knowledgeFileKey(input.projectId, id);
  // La place est réservée avant l’envoi : un fichier refusé n’est jamais stocké.
  await db.$transaction(async (tx) => {
    const project = await lockAdmin(tx, input);
    await reserveStorage(tx, { projectId: input.projectId, plan: project.plan, key, bytes: input.bytes.length }).catch(
      (error: unknown) => {
        throw error instanceof StorageQuotaError ? new KnowledgeError(error.message) : error;
      },
    );
  });
  try {
    await storage.put(key, input.bytes);
    return await db.$transaction(async (tx) => {
      const project = await lockAdmin(tx, input);
      await requireSourceCapacity(tx, input.projectId, project.plan);
      return tx.knowledgeSource.create({
        data: {
          projectId: input.projectId,
          type: "PDF",
          name: input.fileName.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 200) || "Document.pdf",
          storageKey: key,
          createdById: input.userId,
        },
        select: { id: true },
      });
    });
  } catch (error) {
    await storage.remove(key).catch(() => undefined);
    await releaseStorage(db, key).catch(() => undefined);
    throw error;
  }
}

export async function importProductsCsv(
  db: PrismaClient,
  input: Admin & { fileName: string; text: string },
) {
  if (Buffer.byteLength(input.text) > KNOWLEDGE_LIMITS.csvMaxBytes) {
    throw new KnowledgeError("Le fichier CSV dépasse 2 Mo.");
  }
  return db.$transaction(async (tx) => {
    const project = await lockAdmin(tx, input);
    const { rows, errors } = parseProductsCsv(input.text, project.currency);
    if (!rows.length) {
      throw new KnowledgeError(errors[0] ?? "Aucun produit valide dans ce fichier.");
    }
    const remaining = Math.max(0, await remainingEntries(tx, input.projectId, project.plan));
    if (!remaining) throw new KnowledgeError(limitMessage(project.plan));
    const kept = rows.slice(0, remaining);
    const source = await tx.knowledgeSource.create({
      data: {
        projectId: input.projectId,
        type: "CSV",
        name: input.fileName.replace(/[\u0000-\u001f]/g, "").trim().slice(0, 200) || "Catalogue.csv",
        status: "READY",
        entryCount: kept.length,
        truncated: kept.length < rows.length,
        processedAt: new Date(),
        createdById: input.userId,
      },
      select: { id: true },
    });
    await tx.knowledgeEntry.createMany({
      data: kept.map((row) => {
        const content = (row.description || row.name).slice(0, KNOWLEDGE_LIMITS.contentMax);
        return {
          projectId: input.projectId,
          sourceId: source.id,
          kind: "PRODUCT" as const,
          title: row.name,
          content,
          price: row.price,
          stock: row.stock,
          searchText: entrySearchText({ title: row.name, content, price: row.price }),
          createdById: input.userId,
        };
      }),
    });
    return {
      imported: kept.length,
      skipped: errors.length + (rows.length - kept.length),
      errors: errors.slice(0, 10),
      truncated: kept.length < rows.length,
    };
  }, BULK_TRANSACTION);
}

export async function retrySource(db: PrismaClient, input: Admin & { sourceId: string }) {
  await db.$transaction(async (tx) => {
    await lockAdmin(tx, input);
    const result = await tx.knowledgeSource.updateMany({
      where: {
        id: input.sourceId,
        projectId: input.projectId,
        type: { in: ["PDF", "URL"] },
        status: { in: ["FAILED", "READY"] },
      },
      data: {
        status: "QUEUED",
        attempts: 0,
        errorCode: null,
        availableAt: new Date(),
        leaseToken: null,
        leaseUntil: null,
      },
    });
    if (!result.count) throw new KnowledgeError("Cette source est déjà en cours de traitement.");
  });
}

export async function deleteSource(
  db: PrismaClient,
  input: Admin & { sourceId: string },
  removeFile: (key: string) => Promise<void>,
) {
  const removed = await db.$transaction(async (tx) => {
    await lockAdmin(tx, input);
    const source = await tx.knowledgeSource.findFirst({
      where: { id: input.sourceId, projectId: input.projectId },
      select: { id: true, storageKey: true },
    });
    if (!source) throw new KnowledgeError("Source introuvable.");
    // Entries cascade with their source.
    await tx.knowledgeSource.delete({ where: { id: source.id } });
    if (source.storageKey) await releaseStorage(tx, source.storageKey);
    return source;
  });
  if (removed.storageKey) await removeFile(removed.storageKey).catch(() => undefined);
}

/* -------------------------------------------------------------------------- */
/* Read models                                                                 */
/* -------------------------------------------------------------------------- */

export async function knowledgeOverview(db: PrismaClient, projectId: string, userId: string) {
  const membership = await db.projectMembership.findUnique({
    where: { userId_projectId: { userId, projectId } },
    select: { role: true, project: { select: { plan: true, currency: true, deletionPending: true } } },
  });
  if (!membership || membership.project.deletionPending || !can(membership.role, "project.manage")) {
    return null;
  }
  const entrySelect = {
    id: true,
    kind: true,
    title: true,
    content: true,
    price: true,
    stock: true,
    enabled: true,
    updatedAt: true,
  } as const;
  const [entries, products, sources, used] = await Promise.all([
    db.knowledgeEntry.findMany({
      where: { projectId, kind: { in: ["FAQ", "TEXT"] } },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 500,
      select: entrySelect,
    }),
    db.knowledgeEntry.findMany({
      where: { projectId, kind: "PRODUCT" },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: 1000,
      select: entrySelect,
    }),
    db.knowledgeSource.findMany({
      where: { projectId },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: 200,
      select: {
        id: true,
        type: true,
        name: true,
        url: true,
        status: true,
        errorCode: true,
        entryCount: true,
        truncated: true,
        processedAt: true,
        createdAt: true,
      },
    }),
    db.knowledgeEntry.count({ where: { projectId } }),
  ]);
  const limits = planFeatures(membership.project.plan);
  return {
    plan: membership.project.plan,
    currency: membership.project.currency,
    usage: {
      entries: used,
      entryLimit: limits.knowledgeEntries,
      documents: sources.filter((source) => source.type !== "CSV").length,
      documentLimit: limits.knowledgeSources,
      pdfMaxMb: limits.pdfMaxMb,
    },
    entries,
    products,
    sources,
  };
}

/* -------------------------------------------------------------------------- */
/* Retrieval                                                                   */
/* -------------------------------------------------------------------------- */

export async function retrieveKnowledge(
  db: PrismaClient,
  projectId: string,
  text: string,
): Promise<RetrievedEntry[]> {
  const query = buildSearchQuery(text);
  if (!query) return [];
  return db.$queryRaw<RetrievedEntry[]>`
    SELECT id, kind::text AS kind, title, content, price, stock
    FROM knowledge_entry
    WHERE "projectId" = ${projectId} AND enabled AND search @@ to_tsquery('french', ${query})
    ORDER BY ts_rank_cd(search, to_tsquery('french', ${query})) DESC, "updatedAt" DESC, id
    LIMIT ${KNOWLEDGE_LIMITS.retrievalTop}`;
}

/** Reference block for the latest customer messages, plus the entries it used. */
export async function knowledgeContext(
  db: PrismaClient,
  projectId: string,
  currency: string,
  customerTexts: string[],
) {
  const entries = await retrieveKnowledge(db, projectId, customerTexts.slice(-3).join("\n"));
  return { block: formatKnowledgeBlock(entries, currency), entries };
}

/* -------------------------------------------------------------------------- */
/* Worker                                                                      */
/* -------------------------------------------------------------------------- */

const MAX_SOURCE_ATTEMPTS = 3;
const PERMANENT_CODES = new Set([
  "URL_INVALID_URL",
  "URL_BLOCKED_ADDRESS",
  "URL_TOO_LARGE",
  "URL_TOO_MANY_REDIRECTS",
  "UNSUPPORTED_TYPE",
  "EMPTY_CONTENT",
  "PDF_INVALID",
  "PDF_TOO_MANY_PAGES",
]);

export type KnowledgeJob = {
  id: string;
  projectId: string;
  type: "PDF" | "URL";
  url: string | null;
  storageKey: string | null;
  attempts: number;
  token: string;
};

export type KnowledgeExtractors = {
  fetchPage: (url: string) => Promise<{ title: string; text: string }>;
  readPdf: (key: string, projectId: string) => Promise<{ title: string; text: string }>;
};

export async function claimKnowledgeSource(prisma: PrismaClient): Promise<KnowledgeJob | null> {
  const token = randomUUID();
  const [row] = await prisma.$queryRaw<Array<Omit<KnowledgeJob, "token">>>`
    UPDATE knowledge_source SET status = 'PROCESSING', "leaseToken" = ${token}::uuid,
      "leaseUntil" = clock_timestamp() + interval '5 minutes', attempts = attempts + 1, "updatedAt" = clock_timestamp()
    WHERE id = (
      SELECT id FROM knowledge_source
      WHERE type IN ('PDF', 'URL') AND (
        (status = 'QUEUED' AND "availableAt" <= clock_timestamp())
        OR (status = 'PROCESSING' AND "leaseUntil" < clock_timestamp()))
      ORDER BY "availableAt", id LIMIT 1 FOR UPDATE SKIP LOCKED)
    RETURNING id, "projectId", type::text AS type, url, "storageKey", attempts`;
  return row ? { ...row, token } : null;
}

export async function runKnowledgeSource(
  prisma: PrismaClient,
  job: KnowledgeJob,
  extract: KnowledgeExtractors,
) {
  try {
    const { title, text } =
      job.type === "URL"
        ? await extract.fetchPage(job.url ?? "")
        : await extract.readPdf(job.storageKey ?? "", job.projectId);
    const chunks = chunkText(text);
    if (!chunks.length) throw new KnowledgeError("EMPTY_CONTENT");
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM project WHERE id = ${job.projectId} FOR UPDATE`;
      const source = await tx.knowledgeSource.findUnique({ where: { id: job.id } });
      if (!source || source.status !== "PROCESSING" || source.leaseToken !== job.token) return;
      const project = await tx.project.findUniqueOrThrow({
        where: { id: job.projectId },
        select: { plan: true, deletionPending: true },
      });
      // Reprocessing replaces the previous extraction of the same source.
      await tx.knowledgeEntry.deleteMany({ where: { sourceId: job.id } });
      const remaining = project.deletionPending
        ? 0
        : Math.max(0, await remainingEntries(tx, job.projectId, project.plan));
      const kept = chunks.slice(0, remaining);
      const label = (title || source.name).slice(0, 150);
      await tx.knowledgeEntry.createMany({
        data: kept.map((chunk, index) => {
          const entryTitle = `${label} · ${index + 1}/${chunks.length}`.slice(0, KNOWLEDGE_LIMITS.titleMax);
          return {
            projectId: job.projectId,
            sourceId: job.id,
            kind: "CHUNK" as const,
            title: entryTitle,
            content: chunk,
            searchText: entrySearchText({ title: entryTitle, content: chunk }),
          };
        }),
      });
      await tx.knowledgeSource.update({
        where: { id: job.id },
        data: {
          status: "READY",
          name: job.type === "URL" && title ? title.slice(0, 200) : source.name,
          entryCount: kept.length,
          truncated: kept.length < chunks.length,
          errorCode: kept.length < chunks.length ? "LIMIT_REACHED" : null,
          processedAt: new Date(),
          leaseToken: null,
          leaseUntil: null,
        },
      });
    }, BULK_TRANSACTION);
  } catch (error) {
    const code =
      error instanceof SafeFetchError
        ? `URL_${error.code}`
        : error instanceof KnowledgeError && /^[A-Z0-9_]+$/.test(error.message)
          ? error.message
          : "PROCESSING_FAILED";
    const failed =
      PERMANENT_CODES.has(code) || /^HTTP_4\d\d$/.test(code) || job.attempts >= MAX_SOURCE_ATTEMPTS;
    await prisma.knowledgeSource.updateMany({
      where: { id: job.id, leaseToken: job.token },
      data: {
        status: failed ? "FAILED" : "QUEUED",
        errorCode: code,
        availableAt: new Date(Date.now() + 30_000 * 2 ** job.attempts),
        leaseToken: null,
        leaseUntil: null,
      },
    });
  }
}
