import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "../src/generated/prisma/client";
import {
  ConversationSummarySchema,
  type ConversationSummary,
} from "./conversation-summary";

type Cached = {
  fingerprint: string | null;
  summary: unknown;
  partial: boolean;
  generatedAt: Date | null;
};
export function summaryFingerprint(messages: unknown[]) {
  return createHash("sha256").update(JSON.stringify(messages)).digest("hex");
}

export async function cachedConversationSummary(
  db: PrismaClient,
  contactId: string,
  fingerprint: string,
  partial: boolean,
  generate: () => Promise<ConversationSummary>,
) {
  async function read() {
    const rows = await db.$queryRaw<Cached[]>`
      SELECT fingerprint, summary, partial, "generatedAt"
      FROM conversation_summary WHERE "contactId" = ${contactId}
    `;
    const row = rows[0];
    const parsed = ConversationSummarySchema.safeParse(row?.summary);
    return row?.fingerprint === fingerprint && row.generatedAt && parsed.success
      ? {
          summary: parsed.data,
          partial: row.partial,
          generatedAt: row.generatedAt.toISOString(),
        }
      : null;
  }
  const saved = await read();
  if (saved) return saved;
  const token = randomUUID();
  // A database lease coordinates all web instances, including concurrent users.
  const acquired = await db.$queryRaw<{ contactId: string }[]>`
    INSERT INTO conversation_summary ("contactId", "leaseToken", "leaseUntil")
    VALUES (${contactId}, ${token}, NOW() + INTERVAL '60 seconds')
    ON CONFLICT ("contactId") DO UPDATE
      SET "leaseToken" = EXCLUDED."leaseToken", "leaseUntil" = EXCLUDED."leaseUntil"
      WHERE conversation_summary."leaseUntil" IS NULL OR conversation_summary."leaseUntil" <= NOW()
    RETURNING "contactId"
  `;
  if (!acquired.length) {
    const completed = await read();
    if (completed) return completed;
    throw new Error("SUMMARY_BUSY");
  }
  try {
    // Another request may have completed between the first read and acquisition.
    const completed = await read();
    if (completed) {
      await db.$executeRaw`UPDATE conversation_summary SET "leaseToken" = NULL, "leaseUntil" = NULL WHERE "contactId" = ${contactId} AND "leaseToken" = ${token}`;
      return completed;
    }
    const summary = ConversationSummarySchema.parse(await generate());
    const generatedAt = new Date();
    const updated = await db.$executeRaw`
      UPDATE conversation_summary SET fingerprint = ${fingerprint}, summary = ${JSON.stringify(summary)}::jsonb,
        partial = ${partial}, "generatedAt" = ${generatedAt.toISOString()}::timestamptz, "leaseToken" = NULL, "leaseUntil" = NULL
      WHERE "contactId" = ${contactId} AND "leaseToken" = ${token} AND "leaseUntil" > NOW()
    `;
    if (!updated) throw new Error("SUMMARY_BUSY");
    return { summary, partial, generatedAt: generatedAt.toISOString() };
  } catch (error) {
    // Failed provider requests retain a short shared cooldown, without discarding a saved summary.
    await db.$executeRaw`
      UPDATE conversation_summary SET "leaseToken" = NULL, "leaseUntil" = NOW() + INTERVAL '30 seconds'
      WHERE "contactId" = ${contactId} AND "leaseToken" = ${token}
    `;
    throw error;
  }
}
