import { test } from "node:test";
import assert from "node:assert/strict";
import { withTestDatabase } from "./helpers/database";
import { backfillEvolutionMessages } from "../lib/evolution-backfill";
import { INBOUND_REPLIES } from "../lib/phone-verification";
import type { PrismaClient } from "../src/generated/prisma/client";

const since = new Date("2026-11-26T00:00:00Z");
const until = new Date("2026-11-26T12:00:00Z");

/** Message tel qu’Evolution le garde (findMessages). */
function record(input: {
  id: string;
  jid: string;
  at: string;
  text?: string;
  fromMe?: boolean;
  pushName?: string;
  alt?: string;
}) {
  return {
    id: `row-${crypto.randomUUID()}`,
    key: {
      id: input.id,
      remoteJid: input.jid,
      fromMe: input.fromMe ?? false,
      ...(input.alt ? { remoteJidAlt: input.alt } : {}),
    },
    pushName: input.pushName,
    messageType: "conversation",
    message: { conversation: input.text ?? "Bonjour", messageContextInfo: {} },
    messageTimestamp: Math.floor(Date.parse(input.at) / 1000),
    source: "android",
  };
}

/** Evolution renvoie le plus récent d’abord. */
const newestFirst = (records: ReturnType<typeof record>[]) =>
  [...records].sort((a, b) => b.messageTimestamp - a.messageTimestamp);

async function project(prisma: PrismaClient, internal = false) {
  return prisma.project.create({
    data: {
      name: "Boutique",
      numero: "24100000000",
      instanceName: `inst-${crypto.randomUUID()}`,
      status: "active",
      instanceStatus: "connected",
      agentSetupCompletedAt: new Date("2026-11-01T00:00:00Z"),
      internal,
    },
  });
}

test("missed WhatsApp messages are copied back without waking the AI", { timeout: 120000 }, async (t) => {
  await withTestDatabase(async (prisma) => {
    await t.test("prospects’ messages and phone replies come back at their own time", async () => {
      const { id: projectId } = await project(prisma);
      const awa = "111@lid";
      const ben = "222@lid";
      const records = newestFirst([
        // Evolution garde le même message deux fois : la copie sans numéro porte
        // l’identifiant chiffré au lieu du nom.
        record({ id: "in-1", jid: awa, at: "2026-11-26T05:32:39Z", pushName: "111222333444555" }),
        record({ id: "in-1", jid: awa, at: "2026-11-26T05:32:40Z", pushName: "Awa", alt: "24177000000@s.whatsapp.net" }),
        record({ id: "in-2", jid: ben, at: "2026-11-26T07:13:35Z", pushName: "Ben" }),
        record({ id: "out-1", jid: awa, at: "2026-11-26T11:34:16Z", fromMe: true, text: "Réponse 1" }),
        record({ id: "out-2", jid: awa, at: "2026-11-26T11:34:16Z", fromMe: true, text: "Réponse 2" }),
        record({ id: "out-3", jid: awa, at: "2026-11-26T11:34:16Z", fromMe: true, text: "Réponse 3" }),
        record({ id: "group", jid: "123@g.us", at: "2026-11-26T08:00:00Z" }),
        record({ id: "old", jid: ben, at: "2026-11-25T08:00:00Z" }),
      ]);
      // L’ordre d’Evolution à la même seconde est inversé : le plus ancien d’abord.
      const sameSecond = records.filter((row) => row.key.id.startsWith("out-"));
      records.splice(0, 3, ...sameSecond.reverse());

      const dry = await backfillEvolutionMessages(prisma, {
        projectId,
        supportNumber: false,
        records,
        since,
        until,
        apply: false,
      });
      assert.equal(await prisma.message.count({ where: { projectId } }), 0, "a dry run writes nothing");
      assert.equal(await prisma.contact.count({ where: { projectId } }), 0);
      assert.deepEqual(
        dry,
        {
          read: 8,
          inWindow: 7,
          duplicates: 1,
          ignored: 1,
          verification: 0,
          alreadyInApp: 0,
          pending: 0,
          clientMessages: 2,
          phoneReplies: 3,
          conversations: 2,
          newContacts: 2,
          aiPaused: 1,
          namesCompleted: 0,
        },
      );

      const applied = await backfillEvolutionMessages(prisma, {
        projectId,
        supportNumber: false,
        records,
        since,
        until,
        apply: true,
      });
      assert.deepEqual(applied, dry, "the dry run announces exactly what is written");
      assert.equal(await prisma.aiJob.count({ where: { projectId } }), 0, "the AI never answers late");
      assert.equal(await prisma.integrationDelivery.count({ where: { projectId } }), 0);

      const contact = await prisma.contact.findUniqueOrThrow({
        where: { projectId_remoteJid: { projectId, remoteJid: awa } },
        include: { messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] }, events: true },
      });
      assert.equal(contact.pushName, "Awa");
      assert.equal(contact.aiActive, false, "a reply from the phone hands the conversation over");
      assert.deepEqual(contact.events.map((event) => event.type), ["AI_PAUSED_FROM_PHONE"]);
      assert.deepEqual(
        contact.messages.map((message) => [message.evolutionId, message.senderType, message.fromMe]),
        [
          ["in-1", "CLIENT", false],
          ["out-1", "AGENT", true],
          ["out-2", "AGENT", true],
          ["out-3", "AGENT", true],
        ],
      );
      assert.equal(contact.messages[0].createdAt.toISOString(), "2026-11-26T05:32:39.000Z");
      assert.equal(contact.lastMessageAt?.toISOString(), "2026-11-26T11:34:16.002Z");
      const ben2 = await prisma.contact.findUniqueOrThrow({
        where: { projectId_remoteJid: { projectId, remoteJid: ben } },
      });
      assert.equal(ben2.aiActive, true, "a prospect nobody answered keeps the AI");
      assert.equal(ben2.pushName, "Ben");

      const again = await backfillEvolutionMessages(prisma, {
        projectId,
        supportNumber: false,
        records,
        since,
        until,
        apply: true,
      });
      assert.equal(again.alreadyInApp, 5);
      assert.equal(again.clientMessages + again.phoneReplies, 0, "running it twice changes nothing");
      assert.equal(await prisma.message.count({ where: { projectId } }), 5);
    });

    await t.test("messages the app knows, or is still reconciling, are left alone", async () => {
      const { id: projectId } = await project(prisma);
      const jid = "333@lid";
      const contact = await prisma.contact.create({
        data: { projectId, remoteJid: jid, phone: "333", resolvedAt: new Date("2026-11-26T01:00:00Z") },
      });
      await prisma.message.create({
        data: {
          projectId,
          contactId: contact.id,
          evolutionId: "known",
          content: "Déjà là",
          senderType: "BOT",
          fromMe: true,
          status: "SENT",
        },
      });
      await prisma.providerReceipt.create({
        data: { projectId, providerId: "echo", remoteJid: jid, content: "Écho", status: "SENT" },
      });
      const report = await backfillEvolutionMessages(prisma, {
        projectId,
        supportNumber: false,
        records: newestFirst([
          record({ id: "known", jid, at: "2026-11-26T06:00:00Z", fromMe: true }),
          record({ id: "echo", jid, at: "2026-11-26T06:01:00Z", fromMe: true }),
          record({ id: "fresh", jid, at: "2026-11-26T06:02:00Z" }),
        ]),
        since,
        until,
        apply: true,
      });
      assert.equal(report.alreadyInApp, 1);
      assert.equal(report.pending, 1, "the worker reconciles its own echoes");
      assert.equal(report.clientMessages, 1);
      const after = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
      assert.equal(after.resolvedAt, null, "a newer client message reopens the conversation");
      assert.equal(after.aiActive, true);
    });

    await t.test("a contact imported without its name gets it, and digits never become a name", async () => {
      const { id: projectId } = await project(prisma);
      const named = "777@lid";
      const anonymous = "888@lid";
      const contact = await prisma.contact.create({
        data: { projectId, remoteJid: named, phone: "777", pushName: "777000111222333" },
      });
      await prisma.message.create({
        data: {
          projectId,
          contactId: contact.id,
          evolutionId: "imported",
          content: "Bonjour",
          senderType: "CLIENT",
          status: "DELIVERED",
        },
      });
      const records = newestFirst([
        record({ id: "imported", jid: named, at: "2026-11-26T05:00:00Z", pushName: "777000111222333" }),
        record({ id: "imported", jid: named, at: "2026-11-26T05:00:01Z", pushName: "Mireille K", alt: "24166000000@s.whatsapp.net" }),
        record({ id: "lonely", jid: anonymous, at: "2026-11-26T06:00:00Z", pushName: "888000111222333" }),
      ]);
      const dry = await backfillEvolutionMessages(prisma, {
        projectId, supportNumber: false, records, since, until, apply: false,
      });
      assert.equal(dry.namesCompleted, 1);
      assert.equal(
        (await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).pushName,
        "777000111222333",
        "a dry run writes nothing",
      );
      const applied = await backfillEvolutionMessages(prisma, {
        projectId, supportNumber: false, records, since, until, apply: true,
      });
      assert.deepEqual(applied, dry);
      assert.equal((await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).pushName, "Mireille K");
      const lonely = await prisma.contact.findUniqueOrThrow({
        where: { projectId_remoteJid: { projectId, remoteJid: anonymous } },
      });
      assert.equal(lonely.pushName, null, "an encrypted identifier is not a name");
      const again = await backfillEvolutionMessages(prisma, {
        projectId, supportNumber: false, records, since, until, apply: true,
      });
      assert.equal(again.namesCompleted, 0, "a real name is never replaced by a repair");
    });

    await t.test("an AI re-enabled after the phone reply stays on", async () => {
      const { id: projectId } = await project(prisma);
      const jid = "444@lid";
      const contact = await prisma.contact.create({ data: { projectId, remoteJid: jid, phone: "444" } });
      await prisma.contactEvent.create({
        data: { projectId, contactId: contact.id, type: "AI_ENABLED", createdAt: new Date("2026-11-26T11:50:00Z") },
      });
      const report = await backfillEvolutionMessages(prisma, {
        projectId,
        supportNumber: false,
        records: [record({ id: "reply", jid, at: "2026-11-26T11:34:00Z", fromMe: true })],
        since,
        until,
        apply: true,
      });
      assert.equal(report.phoneReplies, 1);
      assert.equal(report.aiPaused, 0);
      assert.equal((await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).aiActive, true);
    });

    await t.test("a STOP sent during the outage is honoured", async () => {
      const { id: projectId } = await project(prisma);
      const jid = "555@lid";
      await backfillEvolutionMessages(prisma, {
        projectId,
        supportNumber: false,
        records: [record({ id: "stop", jid, at: "2026-11-26T09:00:00Z", text: "STOP" })],
        since,
        until,
        apply: true,
      });
      const contact = await prisma.contact.findUniqueOrThrow({
        where: { projectId_remoteJid: { projectId, remoteJid: jid } },
        include: { events: true },
      });
      assert.equal(contact.broadcastOptOutAt?.toISOString(), "2026-11-26T09:00:00.000Z");
      assert.deepEqual(contact.events.map((event) => event.type), ["BROADCAST_OPT_OUT"]);
    });

    await t.test("verification codes never reach the support inbox", async () => {
      const { id: projectId } = await project(prisma, true);
      const jid = "666@lid";
      const report = await backfillEvolutionMessages(prisma, {
        projectId,
        supportNumber: true,
        records: newestFirst([
          record({ id: "code", jid, at: "2026-11-26T06:00:00Z", text: "Bonjour ExtravertyAI, voici mon code de vérification : 123456" }),
          record({ id: "bare", jid, at: "2026-11-26T06:00:30Z", text: "654321" }),
          record({ id: "auto", jid, at: "2026-11-26T06:01:00Z", fromMe: true, text: INBOUND_REPLIES.unknown }),
          record({ id: "help", jid, at: "2026-11-26T06:02:00Z", text: "J’ai besoin d’aide" }),
        ]),
        since,
        until,
        apply: true,
      });
      assert.equal(report.verification, 3);
      assert.equal(report.clientMessages, 1);
      const messages = await prisma.message.findMany({ where: { projectId } });
      assert.deepEqual(messages.map((message) => message.evolutionId), ["help"]);
      assert.ok(!messages.some((message) => /\d{6}/.test(message.content)), "no code is kept in clear");
    });

    await t.test("an invalid window is refused", async () => {
      const { id: projectId } = await project(prisma);
      await assert.rejects(
        backfillEvolutionMessages(prisma, {
          projectId,
          supportNumber: false,
          records: [],
          since: until,
          until: since,
          apply: false,
        }),
      );
      await assert.rejects(
        backfillEvolutionMessages(prisma, {
          projectId,
          supportNumber: false,
          records: [],
          since: new Date("2026-10-01T00:00:00Z"),
          until,
          apply: false,
        }),
      );
    });
  });
});
