import { test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "../src/generated/prisma/client";
import type { generateReply } from "../lib/ai-jobs";
import { tomorrowWindow } from "../lib/broadcast-shared";
import { SILENCE_MARKER } from "../lib/conversation-end";
import {
  FOLLOW_UP_SOURCE,
  FollowUpSettingsSchema,
  followUpInstruction,
  followUpStats,
  runFollowUpTick,
  saveFollowUpSettings,
} from "../lib/follow-ups";
import { PlanFeatureError, planAllows, planFeatures } from "../lib/plan-features";
import { PLAN_CAPABILITIES, PRICING_PLANS } from "../lib/pricing";
import { SettingsError } from "../lib/project-settings";
import { MATRIX_GROUPS, MATRIX_HINTS } from "../components/website/vitrine/data";
import { addMember, createProject, createUser, ingestText, withTestDatabase } from "./helpers/database";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const SETTINGS = { enabled: true, interestedDays: 1, quoteDays: 2, max: 2, template: "" };

test("follow-up settings are bounded and need at least one stage", () => {
  assert.ok(FollowUpSettingsSchema.safeParse(SETTINGS).success);
  for (const invalid of [
    { ...SETTINGS, interestedDays: 0, quoteDays: 0 },
    { ...SETTINGS, max: 0 },
    { ...SETTINGS, max: 4 },
    { ...SETTINGS, quoteDays: 15 },
    { ...SETTINGS, interestedDays: 1.5 },
    { ...SETTINGS, template: "Coucou" },
    { ...SETTINGS, template: "x".repeat(501) },
  ]) {
    assert.equal(FollowUpSettingsSchema.safeParse(invalid).success, false, JSON.stringify(invalid));
  }
  // Switched off, the stages may all be empty.
  assert.ok(
    FollowUpSettingsSchema.safeParse({ ...SETTINGS, enabled: false, interestedDays: 0, quoteDays: 0 })
      .success,
  );
  assert.equal(
    FollowUpSettingsSchema.parse({ ...SETTINGS, template: "  Bonjour {prénom}, toujours partant ?  " })
      .template,
    "Bonjour {prénom}, toujours partant ?",
  );
});

test("the follow-up instruction lets the AI stay silent", () => {
  const quote = followUpInstruction("QUOTE_SENT", 2);
  assert.match(quote, /depuis 2 jours/);
  assert.match(quote, /devis/);
  assert.ok(quote.includes(SILENCE_MARKER));
  assert.match(followUpInstruction("INTERESTED", 1), /depuis 1 jour :/);
});

test("follow-ups are announced exactly on the plans that send them", () => {
  const row = MATRIX_GROUPS.flatMap((group) => group.rows).find(
    (candidate) => candidate.label === "Relances automatiques des prospects",
  );
  assert.ok(row, "ligne absente de la matrice");
  assert.ok(MATRIX_HINTS["Relances automatiques des prospects"]);
  assert.equal(planAllows("business", "followUps"), true);
  for (const plan of PRICING_PLANS) {
    const allowed = planAllows(plan.id, "followUps");
    assert.equal(plan.features.some((line) => /relance/i.test(line)), allowed, `${plan.id} : carte`);
    assert.equal(
      PLAN_CAPABILITIES[plan.id].some((line) => /relance/i.test(line)),
      allowed,
      `${plan.id} : liste complète`,
    );
    assert.equal(row.values[plan.id], allowed, `${plan.id} : matrice`);
    assert.equal(planFeatures(plan.id).followUpDaily > 0, allowed, `${plan.id} : limite quotidienne`);
  }
});

async function connectedProject(prisma: PrismaClient, plan: "pro" | "business" = "business") {
  const project = await createProject(prisma, { plan });
  await prisma.project.update({
    where: { id: project.id },
    data: {
      instanceStatus: "connected",
      agentSetupCompletedAt: new Date(),
      agentSystemMessage:
        "Vous êtes l’assistant de la boutique Test, qui vend des packs de cosmétiques livrés à Libreville.",
    },
  });
  await prisma.quotaPeriod.create({
    data: {
      projectId: project.id,
      key: "test-" + project.id,
      kind: "active",
      startsAt: new Date(Date.now() - DAY),
      endsAt: new Date(Date.now() + 5 * DAY),
      limit: 1000,
    },
  });
  return project;
}

let phone = 24166200000;
/** A prospect whose last client message and last reply are back-dated. */
async function prospect(
  prisma: PrismaClient,
  projectId: string,
  input: {
    name: string;
    stage: "NEW" | "INTERESTED" | "QUOTE_SENT";
    clientAt: Date;
    replyAt?: Date;
    text?: string;
    skip?: "SILENCE" | "QUIET_ACK";
  },
) {
  const contact = await ingestText(
    prisma,
    projectId,
    input.text ?? "Combien pour le pack complet ?",
    `${++phone}@s.whatsapp.net`,
  );
  await prisma.aiJob.updateMany({ where: { contactId: contact.id }, data: { state: "CANCELLED" } });
  await prisma.message.updateMany({
    where: { contactId: contact.id },
    data: { createdAt: input.clientAt, aiSkip: input.skip ?? null },
  });
  if (input.replyAt) {
    await prisma.message.create({
      data: {
        projectId,
        contactId: contact.id,
        content: "Le pack complet est à 150 000 FCFA, livraison comprise.",
        fromMe: true,
        senderType: "BOT",
        status: "SENT",
        source: "ai",
        createdAt: input.replyAt,
      },
    });
  }
  return prisma.contact.update({
    where: { id: contact.id },
    data: { name: input.name, pipelineStage: input.stage, stageChangedAt: input.clientAt },
  });
}

test("silent prospects are followed up end to end", { timeout: 240000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const owner = await createUser(prisma, "Clara Mba");
    const agent = await createUser(prisma, "Paul Nzé");
    const project = await connectedProject(prisma);
    const pro = await connectedProject(prisma, "pro");
    await addMember(prisma, project.id, owner.id, "OWNER");
    await addMember(prisma, project.id, agent.id, "AGENT");
    await addMember(prisma, pro.id, owner.id, "OWNER");

    // Rights, plan and bounds are checked on the server.
    await assert.rejects(
      saveFollowUpSettings(prisma, { projectId: project.id, userId: agent.id, settings: SETTINGS }),
      SettingsError,
    );
    await assert.rejects(
      saveFollowUpSettings(prisma, { projectId: pro.id, userId: owner.id, settings: SETTINGS }),
      PlanFeatureError,
    );
    await assert.rejects(
      saveFollowUpSettings(prisma, {
        projectId: project.id,
        userId: owner.id,
        settings: { ...SETTINGS, max: 9 },
      }),
    );
    // Switching off stays possible after a downgrade.
    await saveFollowUpSettings(prisma, {
      projectId: pro.id,
      userId: owner.id,
      settings: { ...SETTINGS, enabled: false },
    });
    await saveFollowUpSettings(prisma, { projectId: project.id, userId: owner.id, settings: SETTINGS });
    // Forced on in the database, a Pro project is still never followed up.
    await prisma.project.update({ where: { id: pro.id }, data: { followUpEnabled: true } });

    const now = new Date(tomorrowWindow(new Date(), "Africa/Libreville").getTime() + 2 * HOUR); // 10 h
    const ago = (ms: number) => new Date(now.getTime() - ms);
    const at = (ms: number) => new Date(now.getTime() + ms);

    const quote = await prospect(prisma, project.id, {
      name: "Awa Nguema",
      stage: "QUOTE_SENT",
      clientAt: ago(3 * DAY),
      replyAt: ago(2.5 * DAY),
    });
    // « Merci, je vais voir » : the AI stayed silent on purpose.
    const thanked = await prospect(prisma, project.id, {
      name: "Jean Obiang",
      stage: "INTERESTED",
      clientAt: ago(2 * DAY),
      text: "Ok merci je vais voir",
      skip: "QUIET_ACK",
    });

    // None of these may be followed up.
    await prospect(prisma, project.id, { name: "Attend une réponse", stage: "QUOTE_SENT", clientAt: ago(3 * DAY) });
    const taken = await prospect(prisma, project.id, {
      name: "Repris par l’équipe",
      stage: "QUOTE_SENT",
      clientAt: ago(3 * DAY),
      replyAt: ago(2.6 * DAY),
    });
    await prisma.contact.update({ where: { id: taken.id }, data: { aiActive: false } });
    const stopped = await prospect(prisma, project.id, {
      name: "Désinscrit",
      stage: "QUOTE_SENT",
      clientAt: ago(3 * DAY),
      replyAt: ago(2.6 * DAY),
    });
    await prisma.contact.update({ where: { id: stopped.id }, data: { broadcastOptOutAt: ago(2 * DAY) } });
    const resolved = await prospect(prisma, project.id, {
      name: "Résolu",
      stage: "QUOTE_SENT",
      clientAt: ago(3 * DAY),
      replyAt: ago(2.6 * DAY),
    });
    await prisma.contact.update({ where: { id: resolved.id }, data: { resolvedAt: ago(2 * DAY) } });
    await prospect(prisma, project.id, { name: "Trop ancien", stage: "QUOTE_SENT", clientAt: ago(10 * DAY), replyAt: ago(9.5 * DAY) });
    await prospect(prisma, project.id, { name: "Trop récent", stage: "QUOTE_SENT", clientAt: ago(1.5 * DAY), replyAt: ago(DAY) });
    await prospect(prisma, project.id, { name: "Nouveau", stage: "NEW", clientAt: ago(3 * DAY), replyAt: ago(2.6 * DAY) });
    const maxed = await prospect(prisma, project.id, {
      name: "Déjà relancé",
      stage: "QUOTE_SENT",
      clientAt: ago(8 * DAY),
      replyAt: ago(7 * DAY),
    });
    for (const createdAt of [ago(5 * DAY), ago(2.5 * DAY)]) {
      await prisma.message.create({
        data: {
          projectId: project.id,
          contactId: maxed.id,
          content: "Avez-vous pu regarder notre proposition ?",
          fromMe: true,
          senderType: "BOT",
          status: "SENT",
          source: FOLLOW_UP_SOURCE,
          createdAt,
        },
      });
    }
    await prospect(prisma, pro.id, { name: "Client Pro", stage: "QUOTE_SENT", clientAt: ago(3.2 * DAY), replyAt: ago(2.9 * DAY) });

    const calls: Array<{ roles: string[]; contactName: string; task: string }> = [];
    const generate = (async (history, _projectName, contactName, _config, extras) => {
      calls.push({ roles: history.map((message) => message.role), contactName, task: extras?.task ?? "" });
      return contactName.startsWith("Awa")
        ? "Bonjour Awa, avez-vous pu regarder le devis du pack complet ?"
        : SILENCE_MARKER;
    }) as typeof generateReply;

    // 21 h : outside business hours, nothing is drafted.
    assert.equal(await runFollowUpTick(prisma, { now: at(11 * HOUR), generate }), null);
    assert.equal(calls.length, 0);

    const first = await runFollowUpTick(prisma, { now, generate });
    assert.deepEqual(first, { projectId: project.id, contactId: quote.id, outcome: "sent" });
    const sent = await prisma.message.findFirstOrThrow({
      where: { contactId: quote.id, source: FOLLOW_UP_SOURCE },
      include: { outboundJob: true },
    });
    assert.equal(sent.content, "Bonjour Awa, avez-vous pu regarder le devis du pack complet ?");
    assert.equal(sent.senderType, "BOT");
    assert.equal(sent.fromMe, true);
    assert.equal(sent.status, "PENDING");
    assert.equal(sent.outboundJob?.state, "QUEUED");
    // Cancelled at sending time if a member takes over the conversation.
    assert.equal(sent.outboundJob?.aiVersion, quote.aiVersion);
    assert.match(calls[0].task, /Relance d’un prospect/);
    assert.match(calls[0].task, /devis/);
    assert.deepEqual(calls[0].roles, ["user", "assistant"]);
    const period = await prisma.quotaPeriod.findFirstOrThrow({ where: { projectId: project.id } });
    assert.equal(period.used, 1);

    // 20 seconds at least between two follow-ups of the same project.
    assert.equal(await runFollowUpTick(prisma, { now: at(5_000), generate }), null);
    const second = await runFollowUpTick(prisma, { now: at(30_000), generate });
    assert.deepEqual(second, { projectId: project.id, contactId: thanked.id, outcome: "declined" });
    assert.equal(await prisma.message.count({ where: { contactId: thanked.id, fromMe: true } }), 0);
    // Declined by the AI: not proposed again before a new exchange.
    assert.equal(await runFollowUpTick(prisma, { now: at(60_000), generate }), null);
    assert.equal(calls.length, 2);
    assert.equal(await prisma.message.count({ where: { source: FOLLOW_UP_SOURCE, createdAt: { gte: now } } }), 1);
    assert.equal(await prisma.message.count({ where: { projectId: pro.id, source: FOLLOW_UP_SOURCE } }), 0);

    // The team's own message, with the first name, without any AI call.
    await saveFollowUpSettings(prisma, {
      projectId: project.id,
      userId: owner.id,
      settings: { ...SETTINGS, template: "Bonjour {prénom}, toujours partant pour le pack complet ?" },
    });
    const templated = await prospect(prisma, project.id, {
      name: "moussa ndong",
      stage: "QUOTE_SENT",
      clientAt: ago(3 * DAY),
      replyAt: ago(2.2 * DAY),
    });
    const third = await runFollowUpTick(prisma, { now: at(90_000), generate });
    assert.deepEqual(third, { projectId: project.id, contactId: templated.id, outcome: "sent" });
    const written = await prisma.message.findFirstOrThrow({
      where: { contactId: templated.id, source: FOLLOW_UP_SOURCE },
    });
    assert.equal(written.content, "Bonjour Moussa, toujours partant pour le pack complet ?");
    assert.equal(calls.length, 2);

    // Awa answers the next hour and buys: the follow-up is credited.
    await prisma.message.create({
      data: {
        projectId: project.id,
        contactId: quote.id,
        content: "Oui, je prends le pack.",
        fromMe: false,
        senderType: "CLIENT",
        createdAt: at(HOUR),
      },
    });
    await prisma.contact.update({
      where: { id: quote.id },
      data: { pipelineStage: "WON", stageChangedAt: at(2 * HOUR), dealValue: 150_000 },
    });
    assert.deepEqual(await followUpStats(prisma, project.id, ago(30 * DAY)), {
      sent: 4,
      replied: 1,
      won: 1,
      wonValue: 150_000,
    });

    // Switched off: nothing is sent any more.
    await saveFollowUpSettings(prisma, {
      projectId: project.id,
      userId: owner.id,
      settings: { ...SETTINGS, enabled: false },
    });
    await prospect(prisma, project.id, { name: "Après coupure", stage: "QUOTE_SENT", clientAt: ago(3 * DAY), replyAt: ago(2.1 * DAY) });
    assert.equal(await runFollowUpTick(prisma, { now: at(DAY / 24), generate }), null);
  });
});
