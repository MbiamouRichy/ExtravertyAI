import { test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "../src/generated/prisma/client";
import { tomorrowWindow } from "../lib/broadcast-shared";
import {
  BroadcastError,
  broadcastImageKey,
  broadcastTimeline,
  cancelBroadcast,
  createBroadcast,
  listOptedOut,
  listRecipients,
  listReplies,
  pauseBroadcast,
  recipientFilterCounts,
  resumeBroadcast,
  runBroadcastTick,
} from "../lib/broadcasts";
import { allowRequest } from "../lib/rate-limit";
import { addMember, createProject, createUser, ingestText, withTestDatabase } from "./helpers/database";

test("the rate limiter refuses bursts, per key and per window", () => {
  const now = 1_000_000;
  for (let index = 0; index < 3; index++) assert.equal(allowRequest("a", 3, 1000, now + index), true);
  assert.equal(allowRequest("a", 3, 1000, now + 10), false);
  assert.equal(allowRequest("b", 3, 1000, now + 10), true);
  assert.equal(allowRequest("a", 3, 1000, now + 1500), true);
});

let phone = 24166200000;

async function setup(prisma: PrismaClient) {
  const project = await createProject(prisma, { plan: "business" });
  await prisma.project.update({
    where: { id: project.id },
    data: { instanceStatus: "connected", agentSetupCompletedAt: new Date() },
  });
  await prisma.quotaPeriod.create({
    data: {
      projectId: project.id,
      key: "space-" + project.id,
      kind: "active",
      startsAt: new Date(Date.now() - 86_400_000),
      endsAt: new Date(Date.now() + 5 * 86_400_000),
      limit: 1000,
    },
  });
  const owner = await createUser(prisma, "Clara Mba");
  const member = await createUser(prisma, "Paul Nzé");
  const outsider = await createUser(prisma, "Eve Ext");
  await addMember(prisma, project.id, owner.id, "OWNER");
  await addMember(prisma, project.id, member.id, "USER");
  const names = ["Aminata Diallo", "Kevin Mba", "Grace Ella", "Moussa Kane"];
  const contacts = [];
  for (const name of names) {
    const contact = await ingestText(prisma, project.id, "Bonjour", `${++phone}@s.whatsapp.net`);
    await prisma.aiJob.updateMany({ where: { contactId: contact.id }, data: { state: "CANCELLED" } });
    contacts.push(await prisma.contact.update({ where: { id: contact.id }, data: { name } }));
  }
  return { project, owner, member, outsider, contacts };
}

test("the broadcast space", { timeout: 240000 }, async (t) => {
  await withTestDatabase(async (prisma) => {
    const { project, owner, member, outsider, contacts } = await setup(prisma);
    const inWindow = new Date(tomorrowWindow(new Date()).getTime() + 2 * 3_600_000);
    const broadcast = await createBroadcast(prisma, {
      projectId: project.id,
      userId: owner.id,
      requestId: crypto.randomUUID(),
      name: "Nouvel arrivage",
      content: "Bonjour {prénom}, la nouvelle collection est arrivée !",
      audience: {},
      scheduledAt: null,
    });
    // Two messages leave, one fails, one is delivered then answered.
    await runBroadcastTick(prisma, { now: inWindow });
    await runBroadcastTick(prisma, { now: new Date(inWindow.getTime() + 60_000) });
    const queued = await prisma.broadcastRecipient.findMany({
      where: { broadcastId: broadcast.id, state: "QUEUED" },
      orderBy: { id: "asc" },
    });
    assert.equal(queued.length, 2);
    await prisma.message.update({ where: { id: queued[0].messageId! }, data: { status: "DELIVERED" } });
    await prisma.message.update({ where: { id: queued[1].messageId! }, data: { status: "FAILED" } });
    for (const [index, minutes] of [[0, 5], [0, 9]] as const) {
      await prisma.message.create({
        data: {
          projectId: project.id,
          contactId: queued[index].contactId,
          content: minutes === 5 ? "C’est combien la robe rouge ?" : "Et en taille M ?",
          senderType: "CLIENT",
          fromMe: false,
          createdAt: new Date(inWindow.getTime() + minutes * 60_000),
        },
      });
    }

    await t.test("members read the space, outsiders get « not found »", async () => {
      const page = await listRecipients(prisma, {
        projectId: project.id,
        userId: member.id,
        broadcastId: broadcast.id,
        filter: "all",
      });
      assert.equal(page.rows.length, 4);
      await assert.rejects(
        listRecipients(prisma, { projectId: project.id, userId: outsider.id, broadcastId: broadcast.id, filter: "all" }),
        /introuvable/,
      );
      // A broadcast id from another project is « not found » too.
      const other = await setup(prisma);
      await assert.rejects(
        listReplies(prisma, { projectId: other.project.id, userId: other.owner.id, broadcastId: broadcast.id }),
        /introuvable/,
      );
    });

    await t.test("contacts reach the browser masked", async () => {
      const page = await listRecipients(prisma, {
        projectId: project.id,
        userId: owner.id,
        broadcastId: broadcast.id,
        filter: "all",
      });
      for (const row of page.rows) {
        assert.ok(!JSON.stringify(row).includes(contacts[0].phone.slice(3)), "full number leaked");
        assert.match(row.contact.maskedPhone ?? "", /•• ••/);
      }
    });

    await t.test("filters, counts and name search agree", async () => {
      const counts = await recipientFilterCounts(prisma, broadcast.id);
      assert.deepEqual(counts, {
        all: 4, pending: 2, sent: 0, delivered: 1, read: 0, failed: 1, skipped: 0, replied: 1,
      });
      const list = (filter: Parameters<typeof listRecipients>[1]["filter"], query = "") =>
        listRecipients(prisma, { projectId: project.id, userId: owner.id, broadcastId: broadcast.id, filter, query });
      assert.equal((await list("failed")).rows.length, 1);
      const replied = await list("replied");
      assert.equal(replied.rows.length, 1);
      assert.equal(replied.rows[0].replied, true);
      assert.deepEqual((await list("all", "MOUSSA")).rows.map((row) => row.contact.name), ["Moussa Kane"]);
      // Wildcards are plain text, not patterns.
      assert.equal((await list("all", "%")).rows.length, 0);
    });

    await t.test("replies are listed newest first, page by page", async () => {
      const first = await listReplies(prisma, { projectId: project.id, userId: member.id, broadcastId: broadcast.id });
      assert.deepEqual(first.rows.map((row) => row.content), ["Et en taille M ?", "C’est combien la robe rouge ?"]);
      assert.equal(first.nextCursor, null);
      await assert.rejects(
        listReplies(prisma, { projectId: project.id, userId: owner.id, broadcastId: broadcast.id, cursor: "pas-un-curseur" }),
        /Page invalide/,
      );
    });

    await t.test("unsubscribed contacts are listed read-only", async () => {
      await prisma.contact.update({ where: { id: contacts[3].id }, data: { broadcastOptOutAt: new Date() } });
      const page = await listOptedOut(prisma, { projectId: project.id, userId: member.id });
      assert.deepEqual(page.rows.map((row) => row.contact.name), ["Moussa Kane"]);
      await assert.rejects(listOptedOut(prisma, { projectId: project.id, userId: outsider.id }), BroadcastError);
    });

    await t.test("every decision is journaled", async () => {
      await prisma.quotaPeriod.updateMany({ where: { projectId: project.id }, data: { used: 1000 } });
      await runBroadcastTick(prisma, { now: new Date(inWindow.getTime() + 120_000) });
      await prisma.quotaPeriod.updateMany({ where: { projectId: project.id }, data: { used: 0 } });
      await resumeBroadcast(prisma, { projectId: project.id, broadcastId: broadcast.id, userId: owner.id });
      await pauseBroadcast(prisma, { projectId: project.id, broadcastId: broadcast.id, userId: owner.id });
      // After a downgrade, the broadcast can still be stopped.
      await prisma.project.update({ where: { id: project.id }, data: { plan: "starter" } });
      await assert.rejects(
        resumeBroadcast(prisma, { projectId: project.id, broadcastId: broadcast.id, userId: owner.id }),
        /Pro ou Business/,
      );
      await cancelBroadcast(prisma, { projectId: project.id, broadcastId: broadcast.id, userId: owner.id });
      const timeline = await broadcastTimeline(prisma, broadcast.id);
      assert.deepEqual(
        timeline.map((event) => [event.type, event.actor, event.detail]),
        [
          ["CREATED", "Clara", null],
          ["STARTED", null, null],
          ["PAUSED", null, "QUOTA_EXCEEDED"],
          ["RESUMED", "Clara", null],
          ["PAUSED", "Clara", "MANUAL"],
          ["CANCELLED", "Clara", null],
        ],
      );
    });

    await t.test("the image is served only to members of the project", async () => {
      const withImage = await prisma.broadcast.create({
        data: {
          projectId: project.id,
          requestId: crypto.randomUUID(),
          name: "Avec image",
          content: "Nouvelle collection",
          mediaUrl: `chat-media/${project.id}/${crypto.randomUUID()}.jpg`,
          mediaType: "IMAGE",
          audience: {},
          status: "CANCELLED",
          scheduledAt: inWindow,
          nextSendAt: inWindow,
          recipientCount: 1,
        },
      });
      assert.equal(
        await broadcastImageKey(prisma, { projectId: project.id, userId: member.id, broadcastId: withImage.id }),
        withImage.mediaUrl,
      );
      await assert.rejects(
        broadcastImageKey(prisma, { projectId: project.id, userId: outsider.id, broadcastId: withImage.id }),
        BroadcastError,
      );
      await assert.rejects(
        broadcastImageKey(prisma, { projectId: project.id, userId: member.id, broadcastId: broadcast.id }),
        BroadcastError,
      );
    });
  });
});
