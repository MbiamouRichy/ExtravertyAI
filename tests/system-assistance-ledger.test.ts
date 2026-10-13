import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { Prisma } from "../src/generated/prisma/client";
import { reserveSystemAssistance } from "../lib/system-assistance-limits";

test(
  "SQL spending ledger serializes concurrent reservations and survives project deletion",
  { timeout: 120000 },
  async () => {
    const db = await PGlite.create();
    try {
      await db.exec(
        await readFile(
          "prisma/migrations/202610120001_ai_editor_request/migration.sql",
          "utf8",
        ),
      );
      await db.exec(`CREATE TABLE "user" (id TEXT PRIMARY KEY); CREATE TABLE project (id TEXT PRIMARY KEY);
      INSERT INTO "user" VALUES ('owner'); INSERT INTO project VALUES ('project');`);
      function reserve() {
        return db.transaction(async (pg) => {
          const query = (parts: TemplateStringsArray, values: unknown[]) =>
            pg.query(
              parts.reduce(
                (sql, part, index) => sql + (index ? "$" + index : "") + part,
                "",
              ),
              values,
            );
          const tx = {
            $queryRaw: async (
              parts: TemplateStringsArray,
              ...values: unknown[]
            ) => (await query(parts, values)).rows,
            $executeRaw: async (
              parts: TemplateStringsArray,
              ...values: unknown[]
            ) => (await query(parts, values)).affectedRows,
            projectMembership: {
              findUnique: async () => ({
                role: "OWNER",
                project: { name: "Test", deletionPending: false },
              }),
            },
          } as unknown as Prisma.TransactionClient;
          return reserveSystemAssistance(tx, "project", "owner");
        });
      }
      const results = await Promise.allSettled([reserve(), reserve()]);
      assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
      assert.equal(results.filter((r) => r.status === "rejected").length, 1);
      await db.exec(`DELETE FROM project;`);
      const rows = await db.query<{ count: number }>(
        `SELECT COUNT(*)::int AS count FROM ai_editor_request WHERE "actorId" = 'owner'`,
      );
      assert.equal(rows.rows[0].count, 1);
      await db.exec(
        `INSERT INTO project VALUES ('project'); UPDATE ai_editor_request SET "createdAt" = now() - interval '49 hours';`,
      );
      await reserve();
      assert.equal(
        (
          await db.query<{ count: number }>(
            `SELECT COUNT(*)::int AS count FROM ai_editor_request`,
          )
        ).rows[0].count,
        1,
      );
    } finally {
      await db.close();
    }
  },
);
