import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "../src/generated/prisma/client";
import { contactEventLabel } from "../lib/contact-details";
import {
  SCHEDULED_MESSAGE_LIMITS,
  SCHEDULED_SOURCE,
  cancelScheduledMessage,
  dismissScheduledMessage,
  formatScheduleDate,
  runScheduledMessageTick,
  scheduleMessage,
  scheduleTimeError,
  schedulePresets,
  scheduledFailureLabel,
  scheduledMessagesForChat,
  updateScheduledMessage,
  windowClosesAt,
  zonedDateTime,
  zonedInputs,
} from "../lib/scheduled-messages";
import { addMember, createProject, createUser, ingestText, withTestDatabase } from "./helpers/database";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

test("schedule times are bounded and read in the business time zone", () => {
  const now = new Date("2026-11-22T10:00:00Z");
  assert.match(scheduleTimeError(new Date(now.getTime() - MINUTE), now) ?? "", /déjà passée/);
  assert.match(scheduleTimeError(new Date(now.getTime() + 30 * 1000), now) ?? "", /déjà passée/);
  assert.match(scheduleTimeError(new Date(now.getTime() + 31 * DAY), now) ?? "", /30 prochains jours/);
  assert.match(scheduleTimeError(new Date(Number.NaN), now) ?? "", /Choisissez/);
  assert.equal(scheduleTimeError(new Date(now.getTime() + 2 * MINUTE), now), null);
  assert.equal(scheduleTimeError(new Date(now.getTime() + 30 * DAY - MINUTE), now), null);

  // Libreville : UTC+1 toute l'année.
  assert.equal(zonedDateTime("2026-11-23", "09:00", "Africa/Libreville")?.toISOString(), "2026-11-23T08:00:00.000Z");
  assert.deepEqual(zonedInputs(new Date("2026-11-23T08:00:00Z"), "Africa/Libreville"), {
    date: "2026-11-23",
    time: "09:00",
  });
  // Paris : heure d'été, et une heure qui n'existe pas le jour du changement.
  assert.equal(zonedDateTime("2026-07-01", "09:00", "Europe/Paris")?.toISOString(), "2026-07-01T07:00:00.000Z");
  assert.equal(zonedDateTime("2026-03-29", "02:30", "Europe/Paris"), null);
  for (const [date, time] of [
    ["2026-02-30", "09:00"],
    ["2026-11-23", "24:00"],
    ["23/11/2026", "09:00"],
    ["2026-11-23", "9h"],
  ]) {
    assert.equal(zonedDateTime(date, time, "Africa/Libreville"), null, `${date} ${time}`);
  }
  assert.equal(formatScheduleDate("2026-11-24T08:00:00Z", "Africa/Libreville"), "mar. 24 nov. à 09:00");
});

test("shortcuts are always ahead and follow the local clock", () => {
  const zone = "Africa/Libreville";
  // Dimanche 22 novembre 2026, 10 h 07 à Libreville.
  const morning = schedulePresets(new Date("2026-11-22T09:07:00Z"), zone);
  assert.deepEqual(
    morning.map((preset) => [preset.id, zonedInputs(preset.at, zone).date, zonedInputs(preset.at, zone).time]),
    [
      ["hour", "2026-11-22", "11:10"],
      ["evening", "2026-11-22", "18:00"],
      ["tomorrow-morning", "2026-11-23", "09:00"],
      ["tomorrow-afternoon", "2026-11-23", "14:00"],
    ],
    "demain est lundi : « Lundi matin » ferait doublon",
  );
  // Mercredi 18 h : plus de « Ce soir », lundi suivant proposé.
  const evening = schedulePresets(new Date("2026-11-25T17:00:00Z"), zone);
  assert.deepEqual(evening.map((preset) => preset.id), ["hour", "tomorrow-morning", "tomorrow-afternoon", "monday"]);
  assert.equal(zonedInputs(evening.at(-1)!.at, zone).date, "2026-11-30");
  for (const preset of evening) assert.ok(preset.at.getTime() > Date.parse("2026-11-25T17:00:00Z"));
});

test("window, failure and journal labels are explicit", () => {
  assert.equal(windowClosesAt(null), null);
  assert.equal(windowClosesAt("2026-11-22T10:00:00Z")?.toISOString(), "2026-11-23T10:00:00.000Z");
  assert.match(scheduledFailureLabel("WINDOW_CLOSED"), /fenêtre de 24 h/);
  assert.equal(scheduledFailureLabel("<script>"), "envoi impossible");
  assert.equal(
    contactEventLabel("SCHEDULED_MESSAGE_FAILED", "Paul Nzé", "QUOTA"),
    "Message programmé par Paul non envoyé · quota de messages épuisé",
  );
  assert.equal(
    contactEventLabel("SCHEDULED_MESSAGE_FAILED", null, "EXPIRED").startsWith("Message programmé non envoyé · "),
    true,
  );
  assert.equal(contactEventLabel("SCHEDULED_MESSAGE_CANCELLED", "Clara Mba"), "Clara a annulé un message programmé");
});

async function connectedProject(prisma: PrismaClient) {
  const project = await createProject(prisma, { plan: "pro" });
  await prisma.project.update({
    where: { id: project.id },
    data: { instanceStatus: "connected", agentSetupCompletedAt: new Date() },
  });
  await prisma.quotaPeriod.create({
    data: {
      projectId: project.id,
      key: "test-" + project.id,
      kind: "active",
      startsAt: new Date(Date.now() - DAY),
      endsAt: new Date(Date.now() + 40 * DAY),
      limit: 1000,
    },
  });
  return project;
}

let phone = 24166300000;
const jid = () => `${++phone}@s.whatsapp.net`;

test("scheduling, rights, edits and sending end to end", { timeout: 600000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const owner = await createUser(prisma, "Clara Mba");
    const agent = await createUser(prisma, "Paul Nzé");
    const colleague = await createUser(prisma, "Awa Obiang");
    const viewer = await createUser(prisma, "Lecteur");
    const project = await connectedProject(prisma);
    const other = await connectedProject(prisma);
    await addMember(prisma, project.id, owner.id, "OWNER");
    await addMember(prisma, project.id, agent.id, "AGENT");
    await addMember(prisma, project.id, colleague.id, "AGENT");
    await addMember(prisma, project.id, viewer.id, "VIEWER");
    const contact = await ingestText(prisma, project.id, "Bonjour, vous livrez à Owendo ?", jid());
    const foreign = await ingestText(prisma, other.id, "Bonjour", jid());

    const now = new Date();
    const at = new Date(now.getTime() + 2 * HOUR);
    const base = {
      projectId: project.id,
      contactId: contact.id,
      content: "Bonjour, votre commande part demain matin.",
      scheduledAt: at,
    };
    const schedule = (userId: string, extra: Partial<typeof base> & { requestId?: string } = {}) =>
      scheduleMessage(prisma, { ...base, userId, requestId: randomUUID(), ...extra });

    // Droits, contact du projet, contenu et date revérifiés côté serveur.
    await assert.rejects(schedule(viewer.id), { message: "Accès refusé." });
    await assert.rejects(schedule(randomUUID()), { message: "Accès refusé." });
    await assert.rejects(schedule(agent.id, { contactId: foreign.id }), { message: "Contact indisponible." });
    await assert.rejects(schedule(agent.id, { content: "   " }), /Écrivez un message/);
    await assert.rejects(schedule(agent.id, { scheduledAt: new Date(now.getTime() - MINUTE) }), /déjà passée/);
    await assert.rejects(schedule(agent.id, { scheduledAt: new Date(now.getTime() + 31 * DAY) }), /30 prochains jours/);

    // Une même demande ne programme qu'un message.
    const requestId = randomUUID();
    const first = await schedule(agent.id, { requestId });
    assert.equal(first.status, "SCHEDULED");
    assert.equal(first.authorId, agent.id);
    assert.equal((await schedule(agent.id, { requestId })).id, first.id);
    await assert.rejects(schedule(agent.id, { requestId, content: "Autre texte" }), /déjà été utilisé/);
    assert.equal(await prisma.scheduledMessage.count({ where: { projectId: project.id } }), 1);

    // Ce que voit chacun dans la conversation.
    const flags = async (viewerId: string, role: string) =>
      (await scheduledMessagesForChat(prisma, { projectId: project.id, contactId: contact.id, viewerId, role })).map(
        (item) => [item.canEdit, item.canCancel],
      );
    assert.deepEqual(await flags(agent.id, "AGENT"), [[true, true]]);
    assert.deepEqual(await flags(colleague.id, "AGENT"), [[false, false]]);
    assert.deepEqual(await flags(owner.id, "OWNER"), [[false, true]]);

    // Seul l'auteur modifie ; un collègue n'annule pas ; un autre projet ne voit rien.
    const edit = (userId: string, version: number, content = "Bonjour, votre commande part demain à 9 h.") =>
      updateScheduledMessage(prisma, {
        projectId: project.id,
        userId,
        scheduledMessageId: first.id,
        version,
        content,
        scheduledAt: at,
      });
    await assert.rejects(edit(owner.id, first.version), /Seul son auteur/);
    await assert.rejects(
      cancelScheduledMessage(prisma, { projectId: project.id, userId: colleague.id, scheduledMessageId: first.id }),
      /Seuls son auteur et les responsables/,
    );
    await assert.rejects(
      cancelScheduledMessage(prisma, { projectId: other.id, userId: agent.id, scheduledMessageId: first.id }),
      { message: "Accès refusé." },
    );
    const edited = await edit(agent.id, first.version);
    assert.equal(edited.version, first.version + 1);
    await assert.rejects(edit(agent.id, first.version, "Écrasement"), /modifié entre-temps/);

    // Rien avant l'heure ; à l'heure, la file d'envoi normale, au nom de l'auteur.
    assert.equal(await runScheduledMessageTick(prisma, { now: new Date(at.getTime() - MINUTE) }), null);
    const tick = await runScheduledMessageTick(prisma, { now: new Date(at.getTime() + 1000) });
    assert.deepEqual(tick, {
      projectId: project.id,
      contactId: contact.id,
      scheduledMessageId: first.id,
      outcome: "sent",
    });
    const sent = await prisma.scheduledMessage.findUniqueOrThrow({
      where: { id: first.id },
      include: { message: { include: { outboundJob: true } } },
    });
    assert.equal(sent.status, "SENT");
    assert.ok(sent.sentAt);
    assert.equal(sent.message?.content, "Bonjour, votre commande part demain à 9 h.");
    assert.equal(sent.message?.agentId, agent.id);
    assert.equal(sent.message?.senderType, "AGENT");
    assert.equal(sent.message?.source, SCHEDULED_SOURCE);
    assert.equal(sent.message?.outboundJob?.state, "QUEUED");
    // Comme une réponse immédiate : l'équipe reprend la main.
    assert.equal((await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).aiActive, false);
    assert.equal(await runScheduledMessageTick(prisma, { now: new Date(at.getTime() + 2000) }), null);
    await assert.rejects(edit(agent.id, sent.version), /déjà parti/);
    await assert.rejects(
      cancelScheduledMessage(prisma, { projectId: project.id, userId: agent.id, scheduledMessageId: first.id }),
      /déjà parti/,
    );

    // Un responsable annule le message d'un collègue : c'est noté dans la conversation.
    const second = await schedule(colleague.id);
    await cancelScheduledMessage(prisma, { projectId: project.id, userId: owner.id, scheduledMessageId: second.id });
    const cancelled = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: second.id } });
    assert.equal(cancelled.status, "CANCELLED");
    assert.equal(cancelled.cancelledById, owner.id);
    const journal = await prisma.contactEvent.findMany({
      where: { contactId: contact.id, type: "SCHEDULED_MESSAGE_CANCELLED" },
    });
    assert.deepEqual(journal.map((event) => event.actorId), [owner.id]);
    // L'auteur qui annule le sien ne laisse pas de trace.
    const third = await schedule(colleague.id);
    await cancelScheduledMessage(prisma, { projectId: project.id, userId: colleague.id, scheduledMessageId: third.id });
    assert.equal(
      await prisma.contactEvent.count({ where: { contactId: contact.id, type: "SCHEDULED_MESSAGE_CANCELLED" } }),
      1,
    );
    assert.equal(await runScheduledMessageTick(prisma, { now: new Date(at.getTime() + HOUR) }), null);

    // Au plus dix messages en attente par conversation.
    for (let index = 0; index < SCHEDULED_MESSAGE_LIMITS.perContact; index += 1) {
      await schedule(agent.id, { scheduledAt: new Date(now.getTime() + 20 * DAY + index * MINUTE) });
    }
    await assert.rejects(
      schedule(agent.id, { scheduledAt: new Date(now.getTime() + 21 * DAY) }),
      /10 messages programmés au plus par conversation/,
    );
  });
});

test("everything is re-checked when the message is due", { timeout: 600000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const owner = await createUser(prisma, "Clara Mba");
    const agent = await createUser(prisma, "Paul Nzé");
    const project = await connectedProject(prisma);
    await addMember(prisma, project.id, owner.id, "OWNER");
    const membership = await addMember(prisma, project.id, agent.id, "AGENT");
    const recent = await ingestText(prisma, project.id, "Je passe demain ?", jid());
    const silentJid = jid();
    const silent = await ingestText(prisma, project.id, "Merci", silentJid);
    // Le client n'a plus écrit depuis 30 heures.
    await prisma.message.updateMany({
      where: { contactId: silent.id },
      data: { createdAt: new Date(Date.now() - 30 * HOUR) },
    });

    const now = new Date();
    const at = (minutes: number) => new Date(now.getTime() + 2 * HOUR + minutes * MINUTE);
    const schedule = (contactId: string, minutes: number) =>
      scheduleMessage(prisma, {
        projectId: project.id,
        contactId,
        userId: agent.id,
        requestId: randomUUID(),
        content: "Votre devis est prêt.",
        scheduledAt: at(minutes),
      });
    const tickAt = (date: Date) => runScheduledMessageTick(prisma, { now: new Date(date.getTime() + 1000) });
    const reasonOf = async (id: string) =>
      (await prisma.scheduledMessage.findUniqueOrThrow({ where: { id } })).failureReason;

    // 1. Fenêtre de 24 h fermée : pas de texte libre, échec expliqué dans la conversation.
    const closed = await schedule(silent.id, 0);
    const disconnected = await schedule(recent.id, 20);
    const authorLeft = await schedule(recent.id, 10);
    const quota = await schedule(recent.id, 30);
    const deleted = await schedule(recent.id, 40);
    assert.equal((await tickAt(at(0)))?.outcome, "failed");
    assert.equal(await reasonOf(closed.id), "WINDOW_CLOSED");
    const failure = await prisma.contactEvent.findFirstOrThrow({
      where: { contactId: silent.id, type: "SCHEDULED_MESSAGE_FAILED" },
    });
    assert.equal(failure.detail, "WINDOW_CLOSED");
    assert.equal(failure.actorId, agent.id);
    assert.equal(await prisma.message.count({ where: { contactId: silent.id, fromMe: true } }), 0);
    const listed = await scheduledMessagesForChat(prisma, {
      projectId: project.id,
      contactId: silent.id,
      viewerId: agent.id,
      role: "AGENT",
    });
    assert.deepEqual(listed.map((item) => [item.status, item.reason]), [["failed", "WINDOW_CLOSED"]]);
    await assert.rejects(
      cancelScheduledMessage(prisma, { projectId: project.id, userId: agent.id, scheduledMessageId: closed.id }),
      /reprogrammez-le ou retirez-le/,
    );

    // 2. L'auteur a quitté le projet.
    await prisma.projectMembership.delete({ where: { id: membership.id } });
    assert.equal((await tickAt(at(10)))?.outcome, "failed");
    assert.equal(await reasonOf(authorLeft.id), "AUTHOR_UNAUTHORIZED");
    await addMember(prisma, project.id, agent.id, "AGENT");

    // 3. WhatsApp déconnecté : nouvel essai chaque minute, puis abandon après 6 h.
    await prisma.project.update({ where: { id: project.id }, data: { instanceStatus: "disconnected" } });
    assert.equal((await tickAt(at(20)))?.outcome, "waiting");
    const waiting = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: disconnected.id } });
    assert.equal(waiting.status, "SCHEDULED");
    assert.equal(waiting.failureReason, "DISCONNECTED");
    assert.ok(waiting.nextAttemptAt.getTime() > at(20).getTime() + 30_000);
    assert.equal(await runScheduledMessageTick(prisma, { now: new Date(at(20).getTime() + 30_000) }), null);
    assert.equal((await tickAt(new Date(at(20).getTime() + 7 * HOUR)))?.outcome, "failed");
    assert.equal(await reasonOf(disconnected.id), "EXPIRED");
    await prisma.project.update({ where: { id: project.id }, data: { instanceStatus: "connected" } });

    // 4. Quota épuisé, sans crédit prépayé.
    await prisma.quotaPeriod.updateMany({ where: { projectId: project.id }, data: { used: 1000 } });
    assert.equal((await tickAt(at(30)))?.outcome, "failed");
    assert.equal(await reasonOf(quota.id), "QUOTA");
    await prisma.quotaPeriod.updateMany({ where: { projectId: project.id }, data: { used: 0 } });
    // Un échec se retire de la conversation.
    await dismissScheduledMessage(prisma, { projectId: project.id, userId: owner.id, scheduledMessageId: quota.id });
    assert.equal(
      (
        await scheduledMessagesForChat(prisma, {
          projectId: project.id,
          contactId: recent.id,
          viewerId: owner.id,
          role: "OWNER",
        })
      ).some((item) => item.id === quota.id),
      false,
    );
    await assert.rejects(
      dismissScheduledMessage(prisma, { projectId: project.id, userId: owner.id, scheduledMessageId: quota.id }),
      /introuvable/,
    );

    // 5. Projet en cours de suppression.
    await prisma.project.update({ where: { id: project.id }, data: { deletionPending: true } });
    assert.equal((await tickAt(at(40)))?.outcome, "failed");
    assert.equal(await reasonOf(deleted.id), "PROJECT_DELETED");
    await prisma.project.update({ where: { id: project.id }, data: { deletionPending: false } });

    // Le client réécrit : l'auteur reprogramme le message en échec, qui part.
    await ingestText(prisma, project.id, "Finalement je suis intéressé", silentJid);
    const failed = await prisma.scheduledMessage.findUniqueOrThrow({ where: { id: closed.id } });
    const rescheduled = await updateScheduledMessage(prisma, {
      projectId: project.id,
      userId: agent.id,
      scheduledMessageId: closed.id,
      version: failed.version,
      content: "Votre devis est prêt, je vous l’envoie ?",
      scheduledAt: at(60),
    });
    assert.equal(rescheduled.status, "SCHEDULED");
    assert.equal(rescheduled.failureReason, null);
    assert.equal((await tickAt(at(60)))?.outcome, "sent");
    assert.equal(
      await prisma.message.count({ where: { contactId: silent.id, fromMe: true, source: SCHEDULED_SOURCE } }),
      1,
    );
  });
});
