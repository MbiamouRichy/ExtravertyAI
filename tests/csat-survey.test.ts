import { test } from "node:test";
import assert from "node:assert/strict";
import { csatStats, parseCsatScore, setCsatSettings } from "../lib/csat";
import { setConversationResolved } from "../lib/conversation-workflow";
import { PlanFeatureError } from "../lib/plan-features";
import { addMember, createUser, ingestText, withTestDatabase } from "./helpers/database";

test("only short ratings count as an answer", () => {
  for (const [text, score] of [
    ["4", 4],
    [" 5 ! ", 5],
    ["3/5", 3],
    ["2 sur 5", 2],
    ["Note : 1", 1],
    ["4 étoiles", 4],
    ["4️⃣", 4],
    ["⭐⭐⭐", 3],
    ["★★★★★", 5],
  ] as const) {
    assert.equal(parseCsatScore(text), score, text);
  }
  for (const text of ["6", "0", "merci", "J’ai 4 questions", "45", "4 paires svp", "⭐⭐⭐⭐⭐⭐"]) {
    assert.equal(parseCsatScore(text), null, text);
  }
});

test("satisfaction survey", { timeout: 180000 }, async (t) => {
  await withTestDatabase(async (prisma) => {
    async function project(plan: "starter" | "pro", csatEnabled: boolean, limit = 100) {
      const created = await prisma.project.create({
        data: {
          name: "Boutique",
          numero: "24100000000",
          instanceName: crypto.randomUUID(),
          status: "active",
          plan,
          csatEnabled,
          instanceStatus: "connected",
          agentSetupCompletedAt: new Date(),
          agentSystemMessage: "Boutique de chaussures.",
        },
      });
      await prisma.quotaPeriod.create({
        data: {
          projectId: created.id,
          key: "test",
          kind: "active",
          startsAt: new Date(Date.now() - 60000),
          endsAt: new Date(Date.now() + 86400000),
          limit,
        },
      });
      const owner = await createUser(prisma, "Clara Mba");
      await addMember(prisma, created.id, owner.id, "OWNER");
      return { project: created, owner };
    }
    async function resolve(projectId: string, contactId: string, userId: string) {
      const seen = await prisma.message.findFirstOrThrow({
        where: { contactId, senderType: "CLIENT" },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      return setConversationResolved(prisma, {
        projectId,
        contactId,
        userId,
        resolved: true,
        seenMessageId: seen.id,
      });
    }

    await t.test("settings are reserved to Pro and Business admins", async () => {
      const { project: starter, owner } = await project("starter", false);
      await assert.rejects(
        setCsatSettings(prisma, { projectId: starter.id, userId: owner.id, enabled: true, message: "Notez-nous de 1 à 5 svp" }),
        PlanFeatureError,
      );
      // Even if enabled in the database, a Starter project never sends one.
      await prisma.project.update({ where: { id: starter.id }, data: { csatEnabled: true } });
      const contact = await ingestText(prisma, starter.id, "Bonjour");
      assert.equal((await resolve(starter.id, contact.id, owner.id)).surveySent, false);
    });

    const { project: pro, owner } = await project("pro", true);

    await t.test("resolving queues one survey per contact and week", async () => {
      const contact = await ingestText(prisma, pro.id, "Ma commande est arrivée, merci !");
      const first = await resolve(pro.id, contact.id, owner.id);
      assert.equal(first.surveySent, true);
      const survey = await prisma.csatSurvey.findFirstOrThrow({ where: { contactId: contact.id } });
      const message = await prisma.message.findUniqueOrThrow({ where: { id: survey.messageId ?? "" } });
      assert.equal(message.source, "csat");
      assert.equal(message.senderType, "AGENT");
      assert.equal(message.agentId, owner.id);
      assert.ok(await prisma.outboundJob.findUnique({ where: { messageId: message.id } }));
      assert.equal((await prisma.quotaPeriod.findFirstOrThrow({ where: { projectId: pro.id } })).used, 1);

      await setConversationResolved(prisma, { projectId: pro.id, contactId: contact.id, userId: owner.id, resolved: false });
      const again = await resolve(pro.id, contact.id, owner.id);
      assert.equal(again.surveySent, false);
      assert.equal(await prisma.csatSurvey.count({ where: { contactId: contact.id } }), 1);
    });

    await t.test("a rating is recorded without reopening or waking the AI", async () => {
      const contact = await prisma.contact.findFirstOrThrow({ where: { projectId: pro.id } });
      const jobsBefore = await prisma.aiJob.count({ where: { contactId: contact.id } });
      await ingestText(prisma, pro.id, "4");
      const survey = await prisma.csatSurvey.findFirstOrThrow({ where: { contactId: contact.id } });
      assert.equal(survey.score, 4);
      assert.ok(survey.respondedAt);
      const after = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
      assert.ok(after.resolvedAt, "the conversation stays resolved");
      assert.equal(await prisma.aiJob.count({ where: { contactId: contact.id } }), jobsBefore);

      // Once answered, the next message follows the normal path and reopens.
      await ingestText(prisma, pro.id, "5");
      const reopened = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
      assert.equal(reopened.resolvedAt, null);
      assert.equal((await prisma.csatSurvey.findFirstOrThrow({ where: { contactId: contact.id } })).score, 4);
    });

    await t.test("an exhausted quota resolves without survey", async () => {
      const { project: full, owner: fullOwner } = await project("pro", true, 0);
      const contact = await ingestText(prisma, full.id, "Bonjour", "24177777777@s.whatsapp.net");
      const result = await resolve(full.id, contact.id, fullOwner.id);
      assert.ok(result.resolvedAt);
      assert.equal(result.surveySent, false);
    });

    await t.test("statistics summarize scores", async () => {
      const stats = await csatStats(prisma, pro.id, new Date(Date.now() - 86400000));
      assert.deepEqual(stats, { sent: 1, responses: 1, average: 4, distribution: [0, 0, 0, 1, 0] });
    });
  });
});
