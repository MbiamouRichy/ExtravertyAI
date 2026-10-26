import { test } from "node:test";
import assert from "node:assert/strict";
import { claimAiJob, runAiJob } from "../lib/ai-jobs";
import { SandboxError, runAgentTest } from "../lib/agent-sandbox";
import {
  answerGap,
  dismissCorrection,
  improvementOverview,
  promoteCorrection,
  rateAiMessage,
} from "../lib/ai-feedback";
import { MISSING_INFO_MARKER, splitMissingInfo } from "../lib/missing-info";
import { saveEntry } from "../lib/knowledge";
import { SettingsError } from "../lib/project-settings";
import { addMember, createUser, ingestText, withTestDatabase } from "./helpers/database";

test("the missing-information marker never survives", () => {
  assert.deepEqual(splitMissingInfo("Je vérifie. [[INFO_MANQUANTE]]"), { text: "Je vérifie.", missing: true });
  for (const variant of ["[INFO MANQUANTE]", "[[ info-manquante ]]", "[[Info_Manquante]]"]) {
    const result = splitMissingInfo(`Un instant ${variant} merci`);
    assert.equal(result.missing, true, variant);
    assert.doesNotMatch(result.text, /manquante/i, variant);
  }
  assert.match(splitMissingInfo(MISSING_INFO_MARKER).text, /vérifie/);
  assert.deepEqual(splitMissingInfo("Bonjour !"), { text: "Bonjour !", missing: false });
});

test("agent improvement loop", { timeout: 180000 }, async (t) => {
  await withTestDatabase(async (prisma) => {
    const project = await prisma.project.create({
      data: {
        name: "Boutique",
        numero: "24100000000",
        instanceName: crypto.randomUUID(),
        status: "active",
        plan: "starter",
        instanceStatus: "connected",
        agentSetupCompletedAt: new Date(),
        agentSystemMessage: "Tu es l’assistant d’une boutique de chaussures à Libreville.",
      },
    });
    await prisma.quotaPeriod.create({
      data: {
        projectId: project.id,
        key: "test",
        kind: "active",
        startsAt: new Date(Date.now() - 60000),
        endsAt: new Date(Date.now() + 86400000),
        limit: 100,
      },
    });
    const owner = await createUser(prisma, "Clara Mba");
    const member = await createUser(prisma, "Inès Obame");
    await addMember(prisma, project.id, owner.id, "OWNER");
    await addMember(prisma, project.id, member.id, "AGENT");
    await saveEntry(prisma, {
      projectId: project.id,
      userId: owner.id,
      entry: { kind: "FAQ", title: "Livrez-vous à Port-Gentil ?", content: "Oui, en 48 h.", price: null, stock: null },
    });

    await t.test("a reply flagged as missing information is cleaned and logged", async () => {
      const contact = await ingestText(prisma, project.id, "Vous avez la pointure 47 ?");
      const job = await claimAiJob(prisma);
      assert.ok(job);
      let prompt = "";
      await runAiJob(prisma, job, async (history, _name, _contact, _config, extras) => {
        prompt = (extras?.knowledge ?? "") + (extras?.flagMissing ? "FLAG" : "");
        return `Je vérifie la disponibilité en 47 auprès de l’équipe. ${MISSING_INFO_MARKER}`;
      });
      assert.match(prompt, /FLAG/);
      const sent = await prisma.message.findFirstOrThrow({ where: { contactId: contact.id, senderType: "BOT" } });
      assert.doesNotMatch(sent.content, /INFO_MANQUANTE/);
      const gap = await prisma.knowledgeGap.findFirstOrThrow({ where: { contactId: contact.id } });
      assert.equal(gap.question, "Vous avez la pointure 47 ?");
      assert.equal(gap.status, "OPEN");

      const entry = await answerGap(prisma, {
        projectId: project.id,
        userId: owner.id,
        gapId: gap.id,
        draft: { question: "Avez-vous la pointure 47 ?", answer: "Oui, sur commande sous 5 jours." },
      });
      assert.equal((await prisma.knowledgeGap.findUniqueOrThrow({ where: { id: gap.id } })).entryId, entry.id);
      await assert.rejects(
        answerGap(prisma, { projectId: project.id, userId: owner.id, gapId: gap.id, draft: { question: "Encore ?", answer: "Non merci" } }),
        /déjà été traitée/,
      );
    });

    await t.test("knowledge reaches the prompt of real replies", async () => {
      const contact = await ingestText(prisma, project.id, "Vous livrez à Port-Gentil ?", "24199999998@s.whatsapp.net");
      const job = await claimAiJob(prisma);
      assert.ok(job);
      let knowledge = "";
      await runAiJob(prisma, job, async (_history, _name, _contact, _config, extras) => {
        knowledge = extras?.knowledge ?? "";
        return "Oui, en 48 h.";
      });
      assert.match(knowledge, /Port-Gentil/);
      assert.equal(await prisma.knowledgeGap.count({ where: { contactId: contact.id } }), 0);
    });

    await t.test("members rate replies; admins review corrections", async () => {
      const reply = await prisma.message.findFirstOrThrow({ where: { projectId: project.id, senderType: "BOT" } });
      const client = await prisma.message.findFirstOrThrow({ where: { projectId: project.id, senderType: "CLIENT" } });
      await assert.rejects(
        rateAiMessage(prisma, { projectId: project.id, userId: member.id, messageId: client.id, rating: "UP" }),
        /introuvable/,
      );
      const outsider = await createUser(prisma);
      await assert.rejects(
        rateAiMessage(prisma, { projectId: project.id, userId: outsider.id, messageId: reply.id, rating: "UP" }),
        /introuvable/,
      );
      const saved = await rateAiMessage(prisma, {
        projectId: project.id,
        userId: member.id,
        messageId: reply.id,
        rating: "DOWN",
        correction: "Oui, nous avons le 47 en noir uniquement.",
      });
      assert.equal(saved.rating, "DOWN");
      // One opinion per member and message: rating again replaces it.
      await rateAiMessage(prisma, { projectId: project.id, userId: owner.id, messageId: reply.id, rating: "UP" });
      const overview = await improvementOverview(prisma, project.id);
      assert.deepEqual(overview.ratings, { up: 1, down: 1 });
      assert.equal(overview.corrections.length, 1);
      assert.equal(overview.corrections[0].question, "Vous avez la pointure 47 ?");

      const feedbackId = overview.corrections[0].id;
      await assert.rejects(
        promoteCorrection(prisma, {
          projectId: project.id,
          userId: member.id,
          feedbackId,
          draft: { question: "Pointure 47 ?", answer: "Oui, en noir." },
        }),
        SettingsError,
      );
      await promoteCorrection(prisma, {
        projectId: project.id,
        userId: owner.id,
        feedbackId,
        draft: { question: "Pointure 47 ?", answer: "Oui, en noir." },
      });
      assert.equal((await improvementOverview(prisma, project.id)).corrections.length, 0);
      await assert.rejects(
        dismissCorrection(prisma, { projectId: project.id, userId: owner.id, feedbackId }),
        /déjà été traitée/,
      );
    });

    await t.test("the sandbox uses production generation within a daily limit", async () => {
      await assert.rejects(
        runAgentTest(prisma, { projectId: project.id, userId: member.id, messages: [{ role: "user", content: "Salut" }] }, async () => "x"),
        SettingsError,
      );
      const result = await runAgentTest(
        prisma,
        { projectId: project.id, userId: owner.id, messages: [{ role: "user", content: "Livrez-vous à Port-Gentil ?" }] },
        async (_history, _name, contact, _config, extras) => {
          assert.equal(contact, "Client test");
          assert.equal(extras?.flagMissing, true);
          return `Oui, en 48 h. ${MISSING_INFO_MARKER}`;
        },
      );
      assert.equal(result.reply, "Oui, en 48 h.");
      assert.equal(result.trace.missingInfo, true);
      assert.ok(result.trace.sources.some((source) => /Port-Gentil/.test(source.title)));
      assert.equal(result.remaining, 29);
      // Nothing is sent: no outbound job, no knowledge gap, no message.
      assert.equal(await prisma.knowledgeGap.count({ where: { projectId: project.id, status: "OPEN" } }), 0);

      // A failed generation is refunded.
      await assert.rejects(
        runAgentTest(prisma, { projectId: project.id, userId: owner.id, messages: [{ role: "user", content: "?" }] }, async () => {
          throw new Error("AI_HTTP_500");
        }),
        SandboxError,
      );
      assert.equal(await prisma.agentTestRun.count({ where: { projectId: project.id } }), 1);

      await prisma.agentTestRun.createMany({
        data: Array.from({ length: 29 }, () => ({ projectId: project.id, actorId: owner.id })),
      });
      await assert.rejects(
        runAgentTest(prisma, { projectId: project.id, userId: owner.id, messages: [{ role: "user", content: "Encore" }] }, async () => "x"),
        /Limite de 30 tests/,
      );
    });
  });
});
