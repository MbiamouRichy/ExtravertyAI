import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { writeReportSettings } from "../lib/report-settings";
import {
  reportWindow,
  reportDelta,
  reportEmail,
  ReportSettingsSchema,
  WEEK_MS,
} from "../lib/weekly-report";
import {
  collectReportMetrics,
  queueNextWeeklyReport,
  deliverNextReportEmail,
} from "../lib/weekly-report-service";

test("weekly boundaries are UTC, including year rollover and exact due time", () => {
  const before = reportWindow(new Date("2026-01-05T07:59:59Z"), 8);
  assert.equal(before.start.toISOString(), "2025-12-29T00:00:00.000Z");
  assert.equal(before.end.toISOString(), "2026-01-05T00:00:00.000Z");
  assert.equal(before.next.toISOString(), "2026-01-05T08:00:00.000Z");
  assert.equal(
    reportWindow(new Date("2026-01-05T08:00:00Z"), 8).next.toISOString(),
    "2026-01-12T08:00:00.000Z",
  );
  assert.equal(reportDelta(10, 0), "Sans référence comparable");
  assert.equal(reportDelta(0, 0), "Stable");
  assert.equal(reportDelta(15, 10), "+50 %");
  assert.equal(
    ReportSettingsSchema.safeParse({
      reportsEnabled: true,
      reportsSkipEmpty: false,
      reportsIncludeTips: true,
      reportsHourUtc: 24,
    }).success,
    false,
  );
});

test("email escapes untrusted values, rejects unsafe links and has a text version", () => {
  const metrics = {
    received: 0,
    sent: 0,
    aiSent: 0,
    failed: 0,
    activeContacts: 0,
    newContacts: 0,
    changes: 0,
    csatResponses: 0,
  };
  const snapshot = {
    current: metrics,
    previous: metrics,
    partial: false,
    tips: ["<script>alert(1)</script>"],
  };
  const result = reportEmail(
    "<img src=x>\r\nBcc: evil",
    snapshot,
    new Date("2026-01-01Z"),
    new Date("2026-01-08Z"),
    "https://example.test/reports",
  );
  assert.ok(!result.html.includes("<script>"));
  assert.ok(!result.html.includes("<img src=x"));
  assert.ok(!result.subject.includes("\n"));
  assert.match(result.text, /Messages reçus/);
  assert.throws(() =>
    reportEmail(
      "test",
      snapshot,
      new Date(),
      new Date(),
      "javascript:alert(1)",
    ),
  );
});

test(
  "durable weekly reports: tenant isolation, deduplication, revocation, retries and empty weeks",
  { timeout: 120000 },
  async () => {
    const pg = await PGlite.create();
    const server = new PGLiteSocketServer({
      db: pg,
      host: "127.0.0.1",
      port: 0,
    });
    let db: PrismaClient | undefined;
    try {
      for (const folder of (await readdir("prisma/migrations"))
        .filter((f) => /^\d/.test(f))
        .sort())
        await pg.exec(
          await readFile(`prisma/migrations/${folder}/migration.sql`, "utf8"),
        );
      await server.start();
      db = new PrismaClient({
        adapter: new PrismaPg({
          connectionString: `postgresql://postgres:postgres@${server.getServerConn()}/postgres`,
          max: 1,
        }),
        transactionOptions: { maxWait: 15000, timeout: 30000 },
      });
      const now = new Date();
      const window = reportWindow(now, 0);
      for (const id of ["owner", "admin", "user", "unverified"])
        await db.user.create({
          data: {
            id,
            name: id,
            email: `${id}@example.test`,
            emailVerified: id !== "unverified",
          },
        });
      for (const id of [
        "business",
        "other",
        "starter",
        "expired",
        "disabled",
        "empty",
      ]) {
        await db.project.create({
          data: {
            id,
            name: id,
            numero: "123",
            instanceName: id,
            plan: id === "starter" ? "starter" : "business",
            status: "active",
            reportsHourUtc: 0,
            reportsEnabled: id !== "disabled",
            reportsSkipEmpty: id === "empty",
            createdAt: new Date(window.start.getTime() - WEEK_MS),
            members: {
              create: [
                { userId: "owner", role: "OWNER" },
                { userId: "admin", role: "ADMIN" },
                { userId: "user", role: "USER" },
                { userId: "unverified", role: "ADMIN" },
              ],
            },
          },
        });
        await db.quotaPeriod.create({
          data: {
            projectId: id,
            key: id,
            kind: "active",
            startsAt: new Date(now.getTime() - WEEK_MS),
            endsAt: new Date(now.getTime() + (id === "expired" ? -1 : WEEK_MS)),
            limit: 25000,
          },
        });
      }
      const client = db;
      const settings = {
        reportsEnabled: true,
        reportsSkipEmpty: false,
        reportsIncludeTips: true,
        reportsHourUtc: 0,
      };
      for (const actor of ["user", "outsider"])
        await assert.rejects(
          client.$transaction((tx) =>
            writeReportSettings(tx, "business", actor, 0, settings),
          ),
          /droits/,
        );
      for (const projectId of ["starter", "expired"])
        await assert.rejects(
          client.$transaction((tx) =>
            writeReportSettings(tx, projectId, "owner", 0, settings),
          ),
          /Business/,
        );
      assert.equal(
        await client.$transaction((tx) =>
          writeReportSettings(tx, "business", "admin", 0, settings),
        ),
        1,
      );
      await assert.rejects(
        client.$transaction((tx) =>
          writeReportSettings(tx, "business", "owner", 0, settings),
        ),
        /changé/,
      );
      await assert.rejects(
        client.$transaction((tx) =>
          writeReportSettings(tx, "business", "owner", 1, {
            ...settings,
            reportsHourUtc: -1,
          }),
        ),
      );
      assert.equal(
        await client.settingsAudit.count({
          where: { projectId: "business", action: "reports.updated" },
        }),
        1,
      );
      const contact = await db.contact.create({
        data: {
          projectId: "business",
          phone: "1",
          remoteJid: "1",
          createdAt: window.start,
        },
      });
      for (const data of [
        {
          senderType: "CLIENT" as const,
          fromMe: false,
          status: "SENT" as const,
          createdAt: window.start,
        },
        {
          senderType: "BOT" as const,
          fromMe: true,
          status: "READ" as const,
          createdAt: window.start,
        },
        {
          senderType: "AGENT" as const,
          fromMe: true,
          status: "FAILED" as const,
          createdAt: window.start,
        },
        {
          senderType: "CLIENT" as const,
          fromMe: false,
          status: "SENT" as const,
          createdAt: window.end,
        },
      ])
        await db.message.create({
          data: {
            projectId: "business",
            contactId: contact.id,
            content: "SECRET",
            ...data,
          },
        });
      const metrics = await collectReportMetrics(
        db,
        "business",
        window.start,
        window.end,
      );
      assert.equal(metrics.received, 1);
      assert.equal(metrics.sent, 1);
      assert.equal(metrics.failed, 1);
      assert.equal(metrics.aiSent, 1);
      assert.equal(
        (await collectReportMetrics(db, "other", window.start, window.end))
          .received,
        0,
      );
      const config = {
        from: "test@example.test",
        origin: "https://app.example.test",
      };
      for (let i = 0; i < 7; i++) await queueNextWeeklyReport(db, config);
      assert.equal(await db.weeklyReport.count(), 3);
      assert.equal(await db.reportEmail.count(), 4);
      assert.equal(
        await db.reportEmail.count({
          where: { recipientId: { in: ["user", "unverified"] } },
        }),
        0,
      );
      const report = await db.weeklyReport.findFirstOrThrow({
        where: { projectId: "business" },
      });
      assert.ok(!JSON.stringify(report.snapshot).includes("SECRET"));
      assert.equal(
        (
          await db.weeklyReport.findFirstOrThrow({
            where: { projectId: "empty" },
          })
        ).skipped,
        true,
      );
      await db.project.update({
        where: { id: "business" },
        data: { reportsCheckAt: new Date(0) },
      });
      await queueNextWeeklyReport(db, config);
      assert.equal(
        await db.weeklyReport.count({ where: { projectId: "business" } }),
        1,
      );
      await db.projectMembership.updateMany({
        where: { userId: "admin" },
        data: { role: "USER" },
      });
      const sent: string[] = [];
      for (let i = 0; i < 5; i++)
        await deliverNextReportEmail(db, async (email) => {
          sent.push(email.recipient);
          return "provider-id";
        });
      assert.deepEqual(sent.sort(), [
        "owner@example.test",
        "owner@example.test",
      ]);
      assert.equal(
        await db.reportEmail.count({ where: { state: "CANCELLED" } }),
        2,
      );
      const email = await db.reportEmail.findFirstOrThrow({
        where: { state: "SENT" },
      });
      await db.reportEmail.update({
        where: { id: email.id },
        data: {
          state: "SENDING",
          firstAttemptAt: new Date(now.getTime() - 24 * 3600000),
          leaseUntil: new Date(0),
        },
      });
      await deliverNextReportEmail(db, async () => {
        throw new Error("must not retry beyond provider window");
      });
      assert.equal(
        (await db.reportEmail.findUniqueOrThrow({ where: { id: email.id } }))
          .state,
        "REVIEW_REQUIRED",
      );
      const retry = await db.reportEmail.findFirstOrThrow({
        where: { state: "SENT" },
      });
      await db.reportEmail.update({
        where: { id: retry.id },
        data: { state: "PENDING", availableAt: new Date(0) },
      });
      await deliverNextReportEmail(db, async () => {
        throw new Error("timeout");
      });
      const failed = await db.reportEmail.findUniqueOrThrow({
        where: { id: retry.id },
      });
      assert.equal(failed.state, "PENDING");
      assert.equal(failed.text, retry.text);
      assert.ok(failed.availableAt > now);
      await db.project.update({
        where: { id: "business" },
        data: { plan: "starter" },
      });
      await db.project.update({
        where: { id: "other" },
        data: { reportsEnabled: false },
      });
      await db.reportEmail.update({
        where: { id: retry.id },
        data: { availableAt: new Date(0) },
      });
      await deliverNextReportEmail(db, async () => {
        assert.fail("revoked entitlement must not send");
      });
      assert.equal(
        (await db.reportEmail.findUniqueOrThrow({ where: { id: retry.id } }))
          .state,
        "CANCELLED",
      );
    } finally {
      await db?.$disconnect();
      await server.stop();
      await pg.close();
    }
  },
);
