import { writeContactAiState } from "../lib/contact-ai-state";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { PrismaClient } from "../src/generated/prisma/client";
import {
  cachedConversationSummary,
  summaryFingerprint,
} from "../lib/conversation-summary-cache";
import { chatContactName } from "../lib/chat-privacy";

test("chat names do not fall back to phone numbers", () => {
  assert.equal(chatContactName({ name: null, pushName: null }), "Contact");
  assert.equal(
    chatContactName({ name: "+241 76 20 56 29", pushName: "Mon test" }),
    "Mon test",
  );
  assert.equal(
    chatContactName({ name: null, pushName: "24176205629" }),
    "Contact",
  );
  assert.equal(
    chatContactName({ name: "  Voiture  ", pushName: "autre" }),
    "Voiture",
  );
});

test("persistent summary cache deduplicates concurrent requests and invalidates changed history", async () => {
  const db = await PGlite.create();
  try {
    await db.exec(
      "CREATE TABLE contact (id TEXT PRIMARY KEY); INSERT INTO contact VALUES ('a'), ('b');",
    );
    await db.exec(
      await readFile(
        new URL(
          "../prisma/migrations/202610100002_conversation_summary/migration.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    function query(strings: TemplateStringsArray, ...values: unknown[]) {
      const sql = strings.reduce(
        (s, part, index) => s + (index ? "$" + index : "") + part,
        "",
      );
      return db.query(sql, values);
    }
    const prisma = {
      $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) =>
        (await query(strings, ...values)).rows,
      $executeRaw: async (
        strings: TemplateStringsArray,
        ...values: unknown[]
      ) => (await query(strings, ...values)).affectedRows,
    } as unknown as PrismaClient;
    const expected = {
      summary: "Demande de devis.",
      assessment: "Budget à préciser.",
      nextSteps: ["Demander le budget."],
    };
    let calls = 0;
    let release!: () => void;
    let started!: () => void;
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const entered = new Promise<void>((resolve) => {
      started = resolve;
    });
    const fingerprint = summaryFingerprint([
      { id: "first", content: "Bonjour" },
    ]);
    const first = cachedConversationSummary(
      prisma,
      "a",
      fingerprint,
      false,
      async () => {
        calls++;
        started();
        await pending;
        return expected;
      },
    );
    await entered;
    await assert.rejects(
      cachedConversationSummary(prisma, "a", fingerprint, false, async () => {
        calls++;
        return expected;
      }),
      /SUMMARY_BUSY/,
    );
    release();
    const saved = await first;
    const cached = await cachedConversationSummary(
      prisma,
      "a",
      fingerprint,
      false,
      async () => {
        throw Error("must not generate");
      },
    );
    assert.deepEqual(cached, saved);
    assert.equal(calls, 1);
    const changed = summaryFingerprint([{ id: "second", content: "Un devis" }]);
    assert.notEqual(changed, fingerprint);
    await cachedConversationSummary(prisma, "a", changed, true, async () => {
      calls++;
      return expected;
    });
    assert.equal(calls, 2);
    assert.equal(
      (
        await cachedConversationSummary(
          prisma,
          "a",
          changed,
          false,
          async () => expected,
        )
      ).partial,
      true,
    );
    // A different contact has its own cache.
    await cachedConversationSummary(prisma, "b", changed, false, async () => {
      calls++;
      return expected;
    });
    assert.equal(calls, 3);
    await assert.rejects(
      cachedConversationSummary(prisma, "a", "failed", false, async () => {
        throw Error("provider");
      }),
      /provider/,
    );
    await assert.rejects(
      cachedConversationSummary(prisma, "a", "failed", false, async () => {
        calls++;
        return expected;
      }),
      /SUMMARY_BUSY/,
    );
    assert.equal(calls, 3);
    // Expired leases are recoverable; an old request cannot overwrite a new owner.
    await db.exec(
      "UPDATE conversation_summary SET \"leaseUntil\" = NOW() - INTERVAL '1 minute' WHERE \"contactId\" = 'a'",
    );
    await assert.rejects(
      cachedConversationSummary(prisma, "a", "fenced", false, async () => {
        await db.exec(
          "UPDATE conversation_summary SET \"leaseToken\" = 'new-owner' WHERE \"contactId\" = 'a'",
        );
        return expected;
      }),
      /SUMMARY_BUSY/,
    );
    const rows = await db.query<{ fingerprint: string }>(
      "SELECT fingerprint FROM conversation_summary WHERE \"contactId\" = 'a'",
    );
    assert.equal(rows.rows[0].fingerprint, changed);
    await db.exec("DELETE FROM contact WHERE id = 'a'");
    assert.equal(
      (
        await db.query(
          "SELECT * FROM conversation_summary WHERE \"contactId\" = 'a'",
        )
      ).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});

test("every member may toggle their contact, without crossing project boundaries", async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`
      CREATE TABLE project (id TEXT PRIMARY KEY, "deletionPending" BOOLEAN DEFAULT false);
      CREATE TABLE project_membership ("projectId" TEXT, "userId" TEXT, role TEXT);
      CREATE TABLE contact (id TEXT PRIMARY KEY, "projectId" TEXT, "aiActive" BOOLEAN DEFAULT true, "aiVersion" INT DEFAULT 0, "updatedAt" TIMESTAMP, "aiQuietSince" TIMESTAMP);
      CREATE TYPE "ContactEventType" AS ENUM ('AI_ENABLED', 'AI_PAUSED', 'AI_PAUSED_BY_REPLY', 'AI_PAUSED_FROM_PHONE');
      CREATE TABLE contact_event (id TEXT PRIMARY KEY, "projectId" TEXT, "contactId" TEXT, "actorId" TEXT, type "ContactEventType", "createdAt" TIMESTAMP DEFAULT NOW());
      INSERT INTO project (id) VALUES ('p'), ('other');
      INSERT INTO contact (id, "projectId") VALUES ('c', 'p'), ('foreign', 'other');
      INSERT INTO project_membership VALUES ('p','member','AGENT'), ('p','admin','ADMIN'), ('p','owner','OWNER');
    `);
    const prisma = {
      $executeRaw: async (
        strings: TemplateStringsArray,
        ...values: unknown[]
      ) => {
        const sql = strings.reduce(
          (s, part, index) => s + (index ? "$" + index : "") + part,
          "",
        );
        return (await db.query(sql, values)).affectedRows;
      },
      $queryRaw: async (
        strings: TemplateStringsArray,
        ...values: unknown[]
      ) => {
        const sql = strings.reduce(
          (s, part, index) => s + (index ? "$" + index : "") + part,
          "",
        );
        return (await db.query(sql, values)).rows;
      },
    } as unknown as PrismaClient;
    const events = async () =>
      (
        await db.query<{ type: string; actorId: string }>(
          `SELECT type::text, "actorId" FROM contact_event ORDER BY "createdAt", id`,
        )
      ).rows;
    for (const user of ["member", "admin", "owner"]) {
      assert.equal(await writeContactAiState(prisma, "p", "c", user, false), 1);
      assert.equal(await writeContactAiState(prisma, "p", "c", user, true), 1);
    }
    assert.equal(
      await writeContactAiState(prisma, "p", "c", "outsider", false),
      0,
    );
    assert.equal(
      await writeContactAiState(prisma, "p", "foreign", "member", false),
      0,
    );
    assert.equal(
      await writeContactAiState(prisma, "other", "foreign", "member", false),
      0,
    );
    assert.equal(
      await writeContactAiState(prisma, "p", "c", "member", false, 0),
      0,
    );
    assert.equal(
      await writeContactAiState(prisma, "p", "c", "member", false, 6),
      1,
    );
    // Une vraie bascule est journalisée ; un clic répété ne l’est pas.
    assert.equal(await writeContactAiState(prisma, "p", "c", "member", false), 1);
    const logged = await events();
    assert.equal(logged.length, 7);
    assert.deepEqual(logged.at(-1), { type: "AI_PAUSED", actorId: "member" });
    assert.equal(
      logged.filter((event) => event.type === "AI_ENABLED").length,
      3,
    );
    await db.exec(
      "UPDATE project SET \"deletionPending\" = true WHERE id = 'p'",
    );
    assert.equal(
      await writeContactAiState(prisma, "p", "c", "member", true),
      0,
    );
  } finally {
    await db.close();
  }
});
