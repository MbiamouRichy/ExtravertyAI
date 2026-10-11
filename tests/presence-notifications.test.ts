import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import type { PrismaClient } from "../src/generated/prisma/client";
import { heartbeat, projectPresence } from "../lib/presence";
import { notificationFeed, readNotifications } from "../lib/notifications";
test("presence and notifications respect members, tabs, expiry and read versions", async () => {
  const db = await PGlite.create();
  try {
    await db.exec(`
      CREATE TABLE "user" (id TEXT PRIMARY KEY);
      INSERT INTO "user" VALUES ('owner'), ('member'), ('stranger');
      CREATE TABLE project (id TEXT PRIMARY KEY, name TEXT, "deletionPending" BOOLEAN DEFAULT false, "instanceStatus" TEXT DEFAULT 'connected', status TEXT DEFAULT 'active', "automationPaused" BOOLEAN DEFAULT false, "statusBeforePause" TEXT, "agentSetupCompletedAt" TIMESTAMPTZ DEFAULT NOW());
      INSERT INTO project (id,name) VALUES ('p','Project'), ('secret','Secret');
      CREATE TABLE project_membership (id TEXT PRIMARY KEY, "userId" TEXT, "projectId" TEXT, role TEXT, "createdAt" TIMESTAMPTZ DEFAULT NOW() - INTERVAL '1 day');
      INSERT INTO project_membership (id,"userId","projectId",role) VALUES ('o','owner','p','OWNER'), ('m','member','p','USER'), ('s','stranger','secret','OWNER');
      CREATE TABLE contact (id TEXT PRIMARY KEY, "projectId" TEXT, name TEXT, "pushName" TEXT, phone TEXT);
      INSERT INTO contact VALUES ('c','p',NULL,'24176205629','24176205629'), ('hidden','secret','Hidden',NULL,'99999');
      CREATE TABLE message (id TEXT PRIMARY KEY, "projectId" TEXT, "contactId" TEXT, "senderType" TEXT DEFAULT 'CLIENT', "fromMe" BOOLEAN DEFAULT false, "createdAt" TIMESTAMPTZ DEFAULT NOW());
      INSERT INTO message (id,"projectId","contactId") VALUES ('one','p','c'), ('hidden-message','secret','hidden');
      CREATE TABLE conversation_read_state ("membershipId" TEXT, "contactId" TEXT, "lastReadAt" TIMESTAMPTZ, "lastReadId" TEXT);
      CREATE TABLE quota_period (id TEXT PRIMARY KEY, "projectId" TEXT, used INT, "limit" INT, "startsAt" TIMESTAMPTZ DEFAULT NOW(), "endsAt" TIMESTAMPTZ DEFAULT NOW() + INTERVAL '1 month', "isCurrent" BOOLEAN DEFAULT true);
      INSERT INTO quota_period (id,"projectId",used,"limit") VALUES ('q','p',90,100), ('sq','secret',0,100);
    `);
    await db.exec(
      await readFile(
        new URL(
          "../prisma/migrations/202610110002_presence_notifications/migration.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const query = (s: TemplateStringsArray, v: unknown[]) =>
      db.query(
        s.reduce((sql, part, i) => sql + (i ? "$" + i : "") + part, ""),
        v,
      );
    const client = {
      $queryRaw: async (s: TemplateStringsArray, ...v: unknown[]) =>
        (await query(s, v)).rows,
      $executeRaw: async (s: TemplateStringsArray, ...v: unknown[]) =>
        (await query(s, v)).affectedRows,
    } as unknown as PrismaClient;
    assert.deepEqual(await projectPresence(client, "p", "stranger"), []);
    await heartbeat(client, "member", "tab-a", true);
    assert.equal(
      (await projectPresence(client, "p", "owner")).find(
        (p) => p.userId === "member",
      )?.status,
      "online",
    );
    await db.exec(
      `UPDATE user_presence SET "lastActiveAt" = NOW() - INTERVAL '3 minutes'`,
    );
    assert.equal(
      (await projectPresence(client, "p", "owner")).find(
        (p) => p.userId === "member",
      )?.status,
      "idle",
    );
    await heartbeat(client, "member", "tab-b", true);
    assert.equal(
      (await projectPresence(client, "p", "owner")).find(
        (p) => p.userId === "member",
      )?.status,
      "online",
    );
    await db.exec(
      `UPDATE user_presence SET "lastSeenAt" = NOW() - INTERVAL '91 seconds'`,
    );
    assert.equal(
      (await projectPresence(client, "p", "owner")).find(
        (p) => p.userId === "member",
      )?.status,
      "offline",
    );
    const feed = await notificationFeed(client, "member");
    assert.equal(feed.items.length, 1);
    assert.equal(feed.items[0].title, "Message de Contact");
    assert.equal(JSON.stringify(feed).includes("24176205629"), false);
    assert.equal(feed.items[0].read, false);
    const ownerFeed = await notificationFeed(client, "owner");
    assert.equal(
      ownerFeed.items.some((n) => n.key === "quota:p"),
      true,
    );
    await readNotifications(client, "member", feed.items);
    assert.equal(
      (await notificationFeed(client, "member")).items[0].read,
      true,
    );
    assert.equal(
      (await notificationFeed(client, "owner")).items.find(
        (n) => n.kind === "message",
      )?.read,
      false,
    );
    await db.exec(
      `INSERT INTO message (id,"projectId","contactId","createdAt") VALUES ('two','p','c',NOW()+INTERVAL '1 second')`,
    );
    await readNotifications(client, "member", feed.items);
    assert.equal(
      (await notificationFeed(client, "member")).items[0].read,
      false,
    );
    await readNotifications(client, "member", [
      { key: "message:hidden", version: "hidden-message" },
    ]);
    assert.equal(
      (
        await db.query(
          "SELECT * FROM notification_receipt WHERE key='message:hidden'",
        )
      ).rows.length,
      0,
    );
    await db.exec(
      `INSERT INTO conversation_read_state VALUES ('m','c',NOW()+INTERVAL '2 seconds','two')`,
    );
    assert.equal(
      (await notificationFeed(client, "member")).items[0].read,
      true,
    );
    await db.exec(
      `UPDATE project SET "instanceStatus"='disconnected', status='past_due' WHERE id='p'`,
    );
    assert.equal(
      (await notificationFeed(client, "member")).items.some(
        (n) => n.key === "connection:p",
      ),
      true,
    );
    assert.equal(
      (await notificationFeed(client, "member")).items.some(
        (n) => n.key === "billing:p",
      ),
      false,
    );
    assert.equal(
      (await notificationFeed(client, "owner")).items.some(
        (n) => n.key === "billing:p",
      ),
      true,
    );
    await db.exec("DELETE FROM project_membership WHERE id='m'");
    assert.deepEqual((await notificationFeed(client, "member")).items, []);
    assert.deepEqual(await projectPresence(client, "p", "member"), []);
  } finally {
    await db.close();
  }
});
