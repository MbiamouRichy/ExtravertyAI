import { test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "../src/generated/prisma/client";
import {
  BROADCAST_PACE_MS,
  broadcastKeyword,
  contactFirstName,
  localDayStart,
  nextSendingWindow,
  renderBroadcast,
  tomorrowWindow,
} from "../lib/broadcast-shared";
import {
  BroadcastError,
  broadcastStats,
  cancelBroadcast,
  createBroadcast,
  estimateAudience,
  pauseBroadcast,
  resumeBroadcast,
  runBroadcastTick,
} from "../lib/broadcasts";
import { isOrphanedProjectObject } from "../lib/chat-media-cleanup";
import { notificationFeed } from "../lib/notifications";
import { addMember, createProject, createUser, ingestText, withTestDatabase } from "./helpers/database";

const FOOTER = "\n\n_Répondez STOP pour ne plus recevoir ces messages._";

test("messages are personalised and always carry the STOP mention", () => {
  assert.equal(
    renderBroadcast("Bonjour {prénom}, -20 % ce week-end !", { name: "aminata diallo" }),
    `Bonjour Aminata, -20 % ce week-end !${FOOTER}`,
  );
  assert.equal(
    renderBroadcast("Bonjour {Prenom} !", { pushName: "Kevin 🔥" }),
    `Bonjour Kevin !${FOOTER}`,
  );
  assert.equal(renderBroadcast("Bonjour {prénom}, merci !", {}, "cher client"), `Bonjour cher client, merci !${FOOTER}`);
  assert.equal(renderBroadcast("Bonjour {prénom}, merci !", {}), `Bonjour, merci !${FOOTER}`);
  assert.equal(contactFirstName({ name: "<script>", pushName: "Grace" }), "Script");
  assert.equal(contactFirstName({ name: "  ", pushName: "" }), "");
});

test("STOP and START are recognised only as a whole message", () => {
  for (const text of ["STOP", "Stop.", "stop pub", "Arrêt", "désinscrire"]) {
    assert.equal(broadcastKeyword(text), "OPT_OUT", text);
  }
  for (const text of ["START", "Reprendre", "je m'abonne"]) assert.equal(broadcastKeyword(text), "OPT_IN", text);
  for (const text of ["Stop, je voulais dire la taille 42", "Bonjour", "", "start ".repeat(10)]) {
    assert.equal(broadcastKeyword(text), null, text);
  }
});

test("sending happens during business hours in Libreville", () => {
  const opening = tomorrowWindow(new Date());
  assert.equal(opening.getUTCHours(), 7); // 8 h à Libreville (UTC+1)
  const ten = new Date(opening.getTime() + 2 * 3_600_000);
  assert.equal(nextSendingWindow(ten).getTime(), ten.getTime());
  const late = new Date(opening.getTime() + 13 * 3_600_000); // 21 h
  assert.equal(nextSendingWindow(late).getTime(), opening.getTime() + 86_400_000);
  const early = new Date(opening.getTime() - 2 * 3_600_000); // 6 h
  assert.equal(nextSendingWindow(early).getTime(), opening.getTime());
  assert.equal(localDayStart(ten).getTime(), opening.getTime() - 8 * 3_600_000);
});

async function proProject(prisma: PrismaClient, plan: "starter" | "pro" | "business" = "pro") {
  const project = await createProject(prisma, { plan });
  await prisma.project.update({
    where: { id: project.id },
    data: { instanceStatus: "connected", agentSetupCompletedAt: new Date() },
  });
  await prisma.quotaPeriod.create({
    data: {
      projectId: project.id,
      key: "test-" + project.id,
      kind: "active",
      startsAt: new Date(Date.now() - 86_400_000),
      endsAt: new Date(Date.now() + 5 * 86_400_000),
      limit: 1000,
    },
  });
  return project;
}

let phone = 24166100000;
async function customer(prisma: PrismaClient, projectId: string, name: string, text = "Bonjour") {
  const contact = await ingestText(prisma, projectId, text, `${++phone}@s.whatsapp.net`);
  await prisma.aiJob.updateMany({ where: { contactId: contact.id }, data: { state: "CANCELLED" } });
  return prisma.contact.update({ where: { id: contact.id }, data: { name } });
}

const draft = (requestId = crypto.randomUUID()) => ({
  requestId,
  name: "Soldes de printemps",
  content: "Bonjour {prénom}, -20 % sur toute la boutique ce week-end !",
  nameFallback: "",
  scheduledAt: null,
});

test("broadcasts end to end", { timeout: 240000 }, async (t) => {
  await withTestDatabase(async (prisma) => {
    const owner = await createUser(prisma, "Clara Mba");
    const admin = await createUser(prisma, "Inès Obame");
    const member = await createUser(prisma, "Paul Nzé");
    const project = await proProject(prisma);
    await addMember(prisma, project.id, owner.id, "OWNER");
    await addMember(prisma, project.id, admin.id, "ADMIN");
    await addMember(prisma, project.id, member.id, "USER");

    const vip = await prisma.tag.create({ data: { projectId: project.id, name: "VIP", nameKey: "vip" } });
    const aminata = await customer(prisma, project.id, "Aminata Diallo");
    await prisma.contactTag.create({ data: { contactId: aminata.id, tagId: vip.id } });
    await prisma.contact.update({ where: { id: aminata.id }, data: { pipelineStage: "INTERESTED" } });
    const kevin = await customer(prisma, project.id, "Kevin Mba");
    await prisma.message.updateMany({
      where: { contactId: kevin.id },
      data: { createdAt: new Date(Date.now() - 200 * 86_400_000) },
    });
    const grace = await customer(prisma, project.id, "Grace Ella");
    await prisma.contact.update({ where: { id: grace.id }, data: { broadcastOptOutAt: new Date() } });
    // Never wrote to the business: not part of any audience.
    await prisma.contact.create({
      data: { projectId: project.id, remoteJid: "24166999999@s.whatsapp.net", phone: "24166999999" },
    });

    const inWindow = new Date(tomorrowWindow(new Date()).getTime() + 2 * 3_600_000);

    await t.test("only admins of Pro and Business projects broadcast", async () => {
      const starter = await proProject(prisma, "starter");
      await addMember(prisma, starter.id, owner.id, "OWNER");
      await assert.rejects(
        createBroadcast(prisma, { ...draft(), projectId: starter.id, userId: owner.id, audience: {} }),
        /Pro ou Business/,
      );
      await assert.rejects(
        createBroadcast(prisma, { ...draft(), projectId: project.id, userId: member.id, audience: {} }),
        /administrateurs/,
      );
    });

    await t.test("the audience only holds subscribed people who wrote first", async () => {
      const all = await estimateAudience(prisma, { projectId: project.id, userId: owner.id, audience: {} });
      // Grace answered STOP: counted apart, never targeted.
      assert.deepEqual(all, { count: 2, optedOut: 1, limit: 500 });
      const recent = await estimateAudience(prisma, {
        projectId: project.id,
        userId: owner.id,
        audience: { activeWithinDays: 90 },
      });
      assert.equal(recent.count, 1);
      const tagged = await estimateAudience(prisma, {
        projectId: project.id,
        userId: owner.id,
        audience: { tagIds: [vip.id], stages: ["INTERESTED"] },
      });
      assert.equal(tagged.count, 1);
      await assert.rejects(
        createBroadcast(prisma, {
          ...draft(),
          projectId: project.id,
          userId: owner.id,
          audience: { stages: ["WON"] },
        }),
        /Aucun contact/,
      );
    });

    let broadcastId = "";
    await t.test("a broadcast freezes its recipients and is unique while active", async () => {
      const request = draft();
      const broadcast = await createBroadcast(prisma, { ...request, projectId: project.id, userId: owner.id, audience: {} });
      broadcastId = broadcast.id;
      assert.equal(broadcast.recipientCount, 2);
      assert.equal(await prisma.broadcastRecipient.count({ where: { broadcastId } }), 2);
      // Same request: same broadcast, nothing duplicated.
      const again = await createBroadcast(prisma, { ...request, projectId: project.id, userId: owner.id, audience: {} });
      assert.equal(again.id, broadcastId);
      await assert.rejects(
        createBroadcast(prisma, { ...draft(), projectId: project.id, userId: admin.id, audience: {} }),
        /encore en cours/,
      );
    });

    await t.test("messages leave one at a time, personalised, without pausing the AI", async () => {
      const first = await runBroadcastTick(prisma, { now: inWindow, random: () => 0.5 });
      assert.deepEqual(first, { projectId: project.id, broadcastId, sent: true });
      const recipient = await prisma.broadcastRecipient.findFirstOrThrow({
        where: { broadcastId, state: "QUEUED" },
        include: { message: { include: { outboundJob: true } }, contact: true },
      });
      assert.equal(recipient.message?.content, renderBroadcast(draft().content, recipient.contact));
      assert.equal(recipient.message?.senderType, "AGENT");
      assert.equal(recipient.message?.agentId, owner.id);
      assert.equal(recipient.message?.source, "broadcast");
      assert.equal(recipient.message?.outboundJob?.state, "QUEUED");
      assert.equal(recipient.contact.aiActive, true);
      const broadcast = await prisma.broadcast.findUniqueOrThrow({ where: { id: broadcastId } });
      assert.equal(broadcast.status, "SENDING");
      const pace = broadcast.nextSendAt.getTime() - inWindow.getTime();
      assert.ok(pace >= BROADCAST_PACE_MS.min && pace <= BROADCAST_PACE_MS.max, String(pace));
      // Not due yet: nothing else happens.
      assert.equal(await runBroadcastTick(prisma, { now: inWindow }), null);
    });

    await t.test("an unsubscribed recipient is skipped, then the broadcast completes", async () => {
      const pending = await prisma.broadcastRecipient.findFirstOrThrow({ where: { broadcastId, state: "PENDING" } });
      await prisma.contact.update({ where: { id: pending.contactId }, data: { broadcastOptOutAt: new Date() } });
      const later = new Date(inWindow.getTime() + 60_000);
      assert.equal((await runBroadcastTick(prisma, { now: later }))?.sent, false);
      assert.equal(
        (await prisma.broadcastRecipient.findUniqueOrThrow({ where: { id: pending.id } })).skipReason,
        "OPTED_OUT",
      );
      await runBroadcastTick(prisma, { now: later });
      const done = await prisma.broadcast.findUniqueOrThrow({ where: { id: broadcastId } });
      assert.equal(done.status, "COMPLETED");
      await prisma.contact.update({ where: { id: pending.contactId }, data: { broadcastOptOutAt: null } });
    });

    await t.test("statistics follow deliveries, reads and replies", async () => {
      const sent = await prisma.broadcastRecipient.findFirstOrThrow({ where: { broadcastId, state: "QUEUED" } });
      await prisma.message.update({ where: { id: sent.messageId! }, data: { status: "READ" } });
      await prisma.message.create({
        data: {
          projectId: project.id,
          contactId: sent.contactId,
          content: "Je prends !",
          senderType: "CLIENT",
          fromMe: false,
          createdAt: new Date(inWindow.getTime() + 5 * 60_000),
        },
      });
      const stats = (await broadcastStats(prisma, [broadcastId])).get(broadcastId);
      assert.deepEqual(stats, {
        total: 2, pending: 0, skipped: 1, queued: 1, sent: 1, delivered: 1, read: 1, failed: 0, replied: 1,
      });
    });

    await t.test("hours, connection, quota and authorship are respected", async () => {
      const broadcast = await createBroadcast(prisma, {
        ...draft(),
        projectId: project.id,
        userId: admin.id,
        audience: {},
      });
      const night = new Date(inWindow.getTime() + 11 * 3_600_000); // 21 h
      await runBroadcastTick(prisma, { now: night });
      let row = await prisma.broadcast.findUniqueOrThrow({ where: { id: broadcast.id } });
      assert.equal(row.pauseReason, "OUTSIDE_WINDOW");
      assert.equal(row.nextSendAt.getTime(), tomorrowWindow(night).getTime());
      assert.equal(await prisma.message.count({ where: { source: "broadcast", agentId: admin.id } }), 0);

      await prisma.project.update({ where: { id: project.id }, data: { instanceStatus: "disconnected" } });
      await prisma.broadcast.update({ where: { id: broadcast.id }, data: { nextSendAt: inWindow } });
      await runBroadcastTick(prisma, { now: inWindow });
      row = await prisma.broadcast.findUniqueOrThrow({ where: { id: broadcast.id } });
      assert.equal(row.pauseReason, "DISCONNECTED");
      assert.equal(row.status, "SCHEDULED");
      await prisma.project.update({ where: { id: project.id }, data: { instanceStatus: "connected" } });

      await prisma.quotaPeriod.updateMany({ where: { projectId: project.id }, data: { used: 1000 } });
      await prisma.broadcast.update({ where: { id: broadcast.id }, data: { nextSendAt: inWindow } });
      await runBroadcastTick(prisma, { now: inWindow });
      row = await prisma.broadcast.findUniqueOrThrow({ where: { id: broadcast.id } });
      assert.deepEqual([row.status, row.pauseReason], ["PAUSED", "QUOTA_EXCEEDED"]);
      // Administrators are alerted, members are not.
      const alertKey = "broadcast:" + broadcast.id;
      assert.ok((await notificationFeed(prisma, owner.id)).items.some((item) => item.key === alertKey));
      assert.ok(!(await notificationFeed(prisma, member.id)).items.some((item) => item.key === alertKey));
      await prisma.quotaPeriod.updateMany({ where: { projectId: project.id }, data: { used: 0 } });

      // The author left: an admin takes the broadcast over when resuming it.
      await prisma.projectMembership.deleteMany({ where: { projectId: project.id, userId: admin.id } });
      await resumeBroadcast(prisma, { projectId: project.id, broadcastId: broadcast.id, userId: owner.id });
      await prisma.broadcast.update({ where: { id: broadcast.id }, data: { createdById: admin.id } });
      await runBroadcastTick(prisma, { now: inWindow });
      row = await prisma.broadcast.findUniqueOrThrow({ where: { id: broadcast.id } });
      assert.deepEqual([row.status, row.pauseReason], ["PAUSED", "AUTHOR_LEFT"]);
      await resumeBroadcast(prisma, { projectId: project.id, broadcastId: broadcast.id, userId: owner.id });
      row = await prisma.broadcast.findUniqueOrThrow({ where: { id: broadcast.id } });
      assert.equal(row.createdById, owner.id);
      await addMember(prisma, project.id, admin.id, "ADMIN");

      await pauseBroadcast(prisma, { projectId: project.id, broadcastId: broadcast.id, userId: owner.id });
      await cancelBroadcast(prisma, { projectId: project.id, broadcastId: broadcast.id, userId: owner.id });
      row = await prisma.broadcast.findUniqueOrThrow({ where: { id: broadcast.id } });
      assert.equal(row.status, "CANCELLED");
      assert.equal(
        await prisma.broadcastRecipient.count({ where: { broadcastId: broadcast.id, skipReason: "CANCELLED" } }),
        2,
      );
      await assert.rejects(
        cancelBroadcast(prisma, { projectId: project.id, broadcastId: broadcast.id, userId: owner.id }),
        BroadcastError,
      );
    });

    await t.test("the daily limit postpones the rest to the next morning", async () => {
      const broadcast = await createBroadcast(prisma, { ...draft(), projectId: project.id, userId: owner.id, audience: {} });
      await prisma.message.createMany({
        data: Array.from({ length: 300 }, () => ({
          projectId: project.id,
          contactId: aminata.id,
          content: "Ancienne diffusion",
          senderType: "AGENT" as const,
          fromMe: true,
          source: "broadcast",
          createdAt: inWindow,
        })),
      });
      await prisma.broadcast.update({ where: { id: broadcast.id }, data: { nextSendAt: inWindow } });
      await runBroadcastTick(prisma, { now: inWindow });
      const row = await prisma.broadcast.findUniqueOrThrow({ where: { id: broadcast.id } });
      assert.equal(row.pauseReason, "DAILY_LIMIT");
      assert.equal(row.nextSendAt.getTime(), tomorrowWindow(inWindow).getTime());
      await cancelBroadcast(prisma, { projectId: project.id, broadcastId: broadcast.id, userId: owner.id });
    });

    await t.test("the quota must cover the audience before creation", async () => {
      await prisma.quotaPeriod.updateMany({ where: { projectId: project.id }, data: { used: 999 } });
      await assert.rejects(
        createBroadcast(prisma, { ...draft(), projectId: project.id, userId: owner.id, audience: {} }),
        /quota de messages ne suffit pas/,
      );
      await prisma.quotaPeriod.updateMany({ where: { projectId: project.id }, data: { used: 0 } });
    });

    await t.test("a scheduled broadcast image is never taken for an orphan", async () => {
      const key = `chat-media/${project.id}/${crypto.randomUUID()}.jpg`;
      assert.equal(await isOrphanedProjectObject(prisma, key), true);
      await prisma.broadcast.create({
        data: {
          projectId: project.id,
          requestId: crypto.randomUUID(),
          name: "Avec image",
          content: "Nouvelle collection",
          mediaUrl: key,
          mediaType: "IMAGE",
          audience: {},
          status: "CANCELLED",
          scheduledAt: inWindow,
          nextSendAt: inWindow,
          recipientCount: 1,
        },
      });
      assert.equal(await isOrphanedProjectObject(prisma, key), false);
    });

    await t.test("STOP unsubscribes without an AI reply, START subscribes back", async () => {
      const remoteJid = `${++phone}@s.whatsapp.net`;
      const contact = await ingestText(prisma, project.id, "Bonjour", remoteJid);
      await prisma.aiJob.updateMany({ where: { contactId: contact.id }, data: { state: "CANCELLED" } });
      await ingestText(prisma, project.id, "STOP", remoteJid);
      let row = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
      assert.ok(row.broadcastOptOutAt);
      const stop = await prisma.message.findFirstOrThrow({
        where: { contactId: contact.id, content: "STOP" },
        include: { aiJob: true },
      });
      assert.equal(stop.aiJob, null);
      assert.equal(await prisma.contactEvent.count({ where: { contactId: contact.id, type: "BROADCAST_OPT_OUT" } }), 1);

      await ingestText(prisma, project.id, "Start", remoteJid);
      row = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
      assert.equal(row.broadcastOptOutAt, null);
      assert.equal(await prisma.contactEvent.count({ where: { contactId: contact.id, type: "BROADCAST_OPT_IN" } }), 1);
      // « Start » from a subscribed contact is an ordinary message.
      await ingestText(prisma, project.id, "start", remoteJid);
      const plain = await prisma.message.findFirstOrThrow({
        where: { contactId: contact.id, content: "start" },
        include: { aiJob: true },
      });
      assert.ok(plain.aiJob);
    });
  });
});
