import { test } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "../src/generated/prisma/client";
import { claimAiJob, runAiJob } from "../lib/ai-jobs";
import { avoidedReplies, setAiQuietMode, wakeAssistant } from "../lib/ai-quiet";
import { runAgentTest } from "../lib/agent-sandbox";
import { writeContactAiState } from "../lib/contact-ai-state";
import { notificationFeed } from "../lib/notifications";
import {
  QUIET_INSTRUCTION,
  findRepetition,
  isAcknowledgment,
  splitConversationEnd,
} from "../lib/conversation-end";
import { addMember, createUser, ingestText, withTestDatabase } from "./helpers/database";

test("end-of-conversation markers never survive", () => {
  assert.deepEqual(splitConversationEnd("Avec plaisir, à bientôt ! [[FIN]]"), {
    text: "Avec plaisir, à bientôt !",
    end: true,
    silent: false,
  });
  for (const variant of ["[[SILENCE]]", " [silence] ", "[[ Silence ]]", "[[FIN]]"]) {
    assert.deepEqual(splitConversationEnd(variant), { text: "", end: true, silent: true }, variant);
  }
  for (const variant of ["[FIN]", "[[ fin ]]", "[[Fin]]"]) {
    const result = splitConversationEnd(`Bonne journée ${variant}`);
    assert.equal(result.end, true, variant);
    assert.equal(result.text, "Bonne journée", variant);
  }
  // A stray silence marker never swallows a real answer.
  assert.deepEqual(splitConversationEnd("Oui, en 48 h. [SILENCE]"), {
    text: "Oui, en 48 h.",
    end: true,
    silent: false,
  });
  assert.deepEqual(splitConversationEnd("Bonjour !"), { text: "Bonjour !", end: false, silent: false });
});

test("only bare acknowledgments are recognised", () => {
  for (const text of [
    "ok",
    "Merci 🙏",
    "D'accord. \nJe vous reviens",
    "👍",
    "ok merci beaucoup",
    "Merci madame",
    "Bonne soirée à vous aussi !",
    "Ça marche, à demain",
    "D’accord",
  ]) {
    assert.equal(isAcknowledgment(text), true, text);
  }
  for (const text of [
    "",
    "Oui",
    "Madame",
    "Quel est le prix ?",
    "Merci, et pour la livraison à Port-Gentil",
    "D'accord, je prends deux paires",
    "Je suis prêt, envoyez le devis",
    "ok ".repeat(40),
  ]) {
    assert.equal(isAcknowledgment(text), false, text);
  }
});

test("repeated replies and questions are detected", () => {
  // Second example from the field: the qualification question asked again.
  const earlier = [
    "Pas de souci. Je reste à votre disposition quand vous serez prêt.",
    "C'est une excellente idée ! Pour vous proposer le plan le plus adapté, pourriez-vous me dire quel est votre objectif principal en utilisant WhatsApp ?",
  ];
  const repeated = findRepetition(
    "Entendu. Pour vous aider à intégrer WhatsApp à votre stratégie de communication, quel est votre objectif principal ? Cela nous permettra de choisir le plan le plus adapté pour vous.",
    earlier,
  );
  assert.equal(repeated?.kind, "question");
  assert.match(repeated?.sample ?? "", /objectif principal/);
  assert.equal(findRepetition("Notre offre Pro coûte 25 000 FCFA par mois. Voulez-vous une démonstration ?", earlier), null);
  assert.equal(findRepetition("Quelle pointure portez-vous ?", earlier), null);

  const answer = "La sneaker Urban blanche coûte 45 000 FCFA, disponible du 38 au 45.";
  assert.equal(findRepetition(answer, [answer])?.kind, "message");
  // The client asked again: the same answer is legitimate.
  assert.equal(findRepetition(answer, [answer], { clientAsked: true }), null);
  // Short closings are left to the quiet mode.
  assert.equal(findRepetition("Avec plaisir !", ["Avec plaisir !"]), null);
});

const pause = () => new Promise((resolve) => setTimeout(resolve, 5));

// Marks every queued reply as sent, so the next AI job of the contact can run.
async function deliverAll(prisma: PrismaClient, projectId: string) {
  await prisma.outboundJob.updateMany({ where: { projectId, state: "QUEUED" }, data: { state: "ACCEPTED" } });
  await prisma.message.updateMany({
    where: { projectId, senderType: "BOT", status: "PENDING" },
    data: { status: "SENT" },
  });
}

test("quiet mode at the end of a conversation", { timeout: 240000 }, async (t) => {
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
    const period = await prisma.quotaPeriod.create({
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
    const outsider = await createUser(prisma, "Paul Extérieur");
    await addMember(prisma, project.id, owner.id, "OWNER");
    await addMember(prisma, project.id, member.id, "USER");
    let phone = 24166000000;
    const jid = () => `${++phone}@s.whatsapp.net`;

    await t.test("a closing reply puts the assistant in quiet mode", async () => {
      const remoteJid = jid();
      const contact = await ingestText(prisma, project.id, "Merci, je vous reviens", remoteJid);
      const job = await claimAiJob(prisma);
      assert.ok(job);
      let quietPrompt = false;
      await runAiJob(prisma, job, async (_history, _name, _contact, _config, extras) => {
        quietPrompt = !!extras?.quiet;
        return "Avec plaisir, à bientôt ! [[FIN]]";
      });
      assert.equal(quietPrompt, true);
      const sent = await prisma.message.findFirstOrThrow({ where: { contactId: contact.id, senderType: "BOT" } });
      assert.equal(sent.content, "Avec plaisir, à bientôt !");
      const quiet = await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } });
      assert.ok(quiet.aiQuietSince);
      const event = await prisma.contactEvent.findFirstOrThrow({ where: { contactId: contact.id, type: "AI_QUIET" } });
      assert.equal(event.detail, "END");
      await deliverAll(prisma, project.id);

      // A bare acknowledgment is kept, unanswered, at no cost.
      const used = (await prisma.quotaPeriod.findUniqueOrThrow({ where: { id: period.id } })).used;
      await ingestText(prisma, project.id, "D'accord 👍", remoteJid);
      const ack = await prisma.message.findFirstOrThrow({
        where: { contactId: contact.id, content: "D'accord 👍" },
        include: { aiJob: true },
      });
      assert.equal(ack.aiSkip, "QUIET_ACK");
      assert.equal(ack.aiJob, null);
      assert.equal((await prisma.quotaPeriod.findUniqueOrThrow({ where: { id: period.id } })).used, used);

      // A real question wakes it up.
      await ingestText(prisma, project.id, "Finalement, quel est le prix des sneakers ?", remoteJid);
      const question = await prisma.message.findFirstOrThrow({
        where: { contactId: contact.id, content: { startsWith: "Finalement" } },
        include: { aiJob: true },
      });
      assert.ok(question.aiJob);
      assert.equal(question.aiSkip, null);
      assert.equal((await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).aiQuietSince, null);
      const woken = await prisma.contactEvent.findFirstOrThrow({ where: { contactId: contact.id, type: "AI_WOKEN" } });
      assert.equal(woken.actorId, null);
      await prisma.aiJob.update({ where: { id: question.aiJob.id }, data: { state: "CANCELLED" } });
    });

    await t.test("a silent reply sends nothing and costs nothing", async () => {
      const contact = await ingestText(prisma, project.id, "ok", jid());
      const used = (await prisma.quotaPeriod.findUniqueOrThrow({ where: { id: period.id } })).used;
      const job = await claimAiJob(prisma);
      assert.ok(job);
      await runAiJob(prisma, job, async () => "[[SILENCE]]");
      assert.equal(await prisma.message.count({ where: { contactId: contact.id, senderType: "BOT" } }), 0);
      assert.equal(await prisma.outboundJob.count({ where: { message: { contactId: contact.id } } }), 0);
      assert.equal((await prisma.quotaPeriod.findUniqueOrThrow({ where: { id: period.id } })).used, used);
      assert.equal((await prisma.aiJob.findUniqueOrThrow({ where: { id: job.id } })).state, "COMPLETED");
      const input = await prisma.message.findUniqueOrThrow({ where: { id: job.messageId } });
      assert.equal(input.aiSkip, "SILENCE");
      assert.ok((await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).aiQuietSince);
    });

    await t.test("a repeated reply gets one second chance, then is withheld", async () => {
      const remoteJid = jid();
      const contact = await ingestText(prisma, project.id, "Bonjour", remoteJid);
      const question = "Bonjour ! Pour bien vous conseiller, quel est votre secteur d’activité ?";
      const first = await claimAiJob(prisma);
      assert.ok(first);
      await runAiJob(prisma, first, async () => question);
      await deliverAll(prisma, project.id);

      await ingestText(prisma, project.id, "Je veux juste des infos", remoteJid);
      const looping = await claimAiJob(prisma);
      assert.ok(looping);
      const hints: string[] = [];
      await runAiJob(prisma, looping, async (_history, _name, _contact, _config, extras) => {
        hints.push(extras?.avoid ?? "");
        return "D’accord. Quel est votre secteur d’activité ?";
      });
      assert.equal(hints.length, 2);
      assert.equal(hints[0], "");
      assert.match(hints[1], /secteur d’activité/);
      assert.equal(await prisma.message.count({ where: { contactId: contact.id, senderType: "BOT" } }), 1);
      const input = await prisma.message.findUniqueOrThrow({ where: { id: looping.messageId } });
      assert.equal(input.aiSkip, "REPEATED");
      const event = await prisma.contactEvent.findFirstOrThrow({ where: { contactId: contact.id, type: "AI_QUIET" } });
      assert.equal(event.detail, "REPEATED");

      // The second chance is used when it brings something new.
      const other = jid();
      await ingestText(prisma, project.id, "Bonjour", other);
      const opening = await claimAiJob(prisma);
      assert.ok(opening);
      await runAiJob(prisma, opening, async () => question);
      await deliverAll(prisma, project.id);
      await ingestText(prisma, project.id, "Je veux juste des infos", other);
      const retried = await claimAiJob(prisma);
      assert.ok(retried);
      let calls = 0;
      await runAiJob(prisma, retried, async () =>
        ++calls === 1
          ? "Quel est votre secteur d’activité ?"
          : "Nous vendons des sneakers de 25 000 à 60 000 FCFA, livrées à Libreville sous 24 h.",
      );
      assert.equal(calls, 2);
      const reply = await prisma.message.findFirstOrThrow({
        where: { contactId: retried.contactId, senderType: "BOT" },
        orderBy: { createdAt: "desc" },
      });
      assert.match(reply.content, /sneakers/);
      await deliverAll(prisma, project.id);
    });

    await t.test("messages sent in a row get a single reply", async () => {
      const remoteJid = jid();
      await ingestText(prisma, project.id, "Bonjour", remoteJid);
      await pause();
      const contact = await ingestText(prisma, project.id, "Vous avez la taille 42 ?", remoteJid);
      // The older job is merged at claim time, without calling the model.
      assert.equal(await claimAiJob(prisma), null);
      const merged = await prisma.message.findFirstOrThrow({ where: { contactId: contact.id, content: "Bonjour" } });
      assert.equal(merged.aiSkip, "MERGED");
      const job = await claimAiJob(prisma);
      assert.ok(job);
      const input = await prisma.message.findUniqueOrThrow({ where: { id: job.messageId } });
      assert.equal(input.content, "Vous avez la taille 42 ?");
      let history: Array<{ role: string; content: string }> = [];
      await runAiJob(prisma, job, async (messages) => {
        history = messages;
        return "Bonjour ! Oui, la taille 42 est disponible.";
      });
      assert.deepEqual(
        history.map((message) => message.content),
        ["Bonjour", "Vous avez la taille 42 ?"],
      );
      await deliverAll(prisma, project.id);

      // A message arriving during generation makes the draft obsolete.
      await ingestText(prisma, project.id, "Et en noir ?", remoteJid);
      const generating = await claimAiJob(prisma);
      assert.ok(generating);
      await pause();
      await ingestText(prisma, project.id, "Plutôt en 43 en fait", remoteJid);
      await runAiJob(prisma, generating, async () => "Oui, en noir aussi.");
      assert.equal((await prisma.aiJob.findUniqueOrThrow({ where: { id: generating.id } })).errorCode, "AI_MERGED");
      assert.equal(
        await prisma.message.count({ where: { contactId: contact.id, senderType: "BOT", content: "Oui, en noir aussi." } }),
        0,
      );
      const next = await claimAiJob(prisma);
      assert.ok(next);
      const latest = await prisma.message.findUniqueOrThrow({ where: { id: next.messageId } });
      assert.equal(latest.content, "Plutôt en 43 en fait");
      await prisma.aiJob.update({ where: { id: next.id }, data: { state: "CANCELLED" } });
    });

    await t.test("a client asking again gets the same answer again", async () => {
      const remoteJid = jid();
      const answer = "La sneaker Urban blanche coûte 45 000 FCFA, disponible du 38 au 45.";
      await ingestText(prisma, project.id, "Combien coûte la sneaker Urban blanche ?", remoteJid);
      const first = await claimAiJob(prisma);
      assert.ok(first);
      await runAiJob(prisma, first, async () => answer);
      await deliverAll(prisma, project.id);
      await ingestText(prisma, project.id, "Pardon, combien coûte la sneaker Urban blanche ?", remoteJid);
      const again = await claimAiJob(prisma);
      assert.ok(again);
      let calls = 0;
      await runAiJob(prisma, again, async () => {
        calls++;
        return answer;
      });
      assert.equal(calls, 1);
      assert.equal(await prisma.message.count({ where: { contactId: again.contactId, senderType: "BOT" } }), 2);
      await deliverAll(prisma, project.id);
    });

    await t.test("hot prospects put in quiet mode are flagged to the team", async () => {
      const contact = await ingestText(prisma, project.id, "Je vous reviens pour le devis", jid());
      await prisma.contact.update({ where: { id: contact.id }, data: { pipelineStage: "QUOTE_SENT" } });
      const job = await claimAiJob(prisma);
      assert.ok(job);
      await runAiJob(prisma, job, async () => "Très bien, à bientôt ! [[FIN]]");
      const feed = await notificationFeed(prisma, member.id);
      assert.ok(feed.items.some((item) => item.key === "quiet:" + contact.id));
      assert.equal((await notificationFeed(prisma, outsider.id)).items.length, 0);
      await deliverAll(prisma, project.id);
    });

    await t.test("the team can wake the assistant up", async () => {
      const contact = await ingestText(prisma, project.id, "ok", jid());
      await prisma.contact.update({ where: { id: contact.id }, data: { aiQuietSince: new Date() } });
      await prisma.aiJob.updateMany({ where: { contactId: contact.id }, data: { state: "CANCELLED" } });
      await assert.rejects(
        wakeAssistant(prisma, { projectId: project.id, contactId: contact.id, userId: outsider.id }),
        /indisponible/,
      );
      assert.deepEqual(
        await wakeAssistant(prisma, { projectId: project.id, contactId: contact.id, userId: member.id }),
        { woken: true },
      );
      assert.deepEqual(
        await wakeAssistant(prisma, { projectId: project.id, contactId: contact.id, userId: member.id }),
        { woken: false },
      );
      const events = await prisma.contactEvent.findMany({ where: { contactId: contact.id, type: "AI_WOKEN" } });
      assert.equal(events.length, 1);
      assert.equal(events[0].actorId, member.id);

      // Re-enabling the assistant after a handover also ends the quiet mode.
      await prisma.contact.update({ where: { id: contact.id }, data: { aiQuietSince: new Date(), aiActive: false } });
      await writeContactAiState(prisma, project.id, contact.id, member.id, true);
      assert.equal((await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).aiQuietSince, null);
    });

    await t.test("only admins switch the quiet mode, and turning it off wakes everyone", async () => {
      const contact = await ingestText(prisma, project.id, "Merci", jid());
      await prisma.aiJob.updateMany({ where: { contactId: contact.id }, data: { state: "CANCELLED" } });
      await prisma.contact.update({ where: { id: contact.id }, data: { aiQuietSince: new Date() } });
      await assert.rejects(
        setAiQuietMode(prisma, { projectId: project.id, userId: member.id, enabled: false }),
        /droits/,
      );
      await setAiQuietMode(prisma, { projectId: project.id, userId: owner.id, enabled: false });
      assert.equal((await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).aiQuietEnabled, false);
      assert.equal(await prisma.contact.count({ where: { projectId: project.id, aiQuietSince: { not: null } } }), 0);
      const audit = await prisma.settingsAudit.findFirstOrThrow({ where: { projectId: project.id } });
      assert.equal(audit.action, "ai_quiet.disabled");

      // Without the mode, a closing reply is sent but nothing goes quiet.
      const remoteJid = jid();
      const other = await ingestText(prisma, project.id, "Merci beaucoup", remoteJid);
      const job = await claimAiJob(prisma);
      assert.ok(job);
      let quietPrompt = true;
      await runAiJob(prisma, job, async (_history, _name, _contact, _config, extras) => {
        quietPrompt = !!extras?.quiet;
        return "Avec plaisir ! [[FIN]]";
      });
      assert.equal(quietPrompt, false);
      assert.equal((await prisma.contact.findUniqueOrThrow({ where: { id: other.id } })).aiQuietSince, null);
      assert.equal(
        (await prisma.message.findFirstOrThrow({ where: { contactId: other.id, senderType: "BOT" } })).content,
        "Avec plaisir !",
      );
      await setAiQuietMode(prisma, { projectId: project.id, userId: owner.id, enabled: true });
      await deliverAll(prisma, project.id);
    });

    await t.test("avoided replies are counted", async () => {
      const stats = await avoidedReplies(prisma, project.id, new Date(Date.now() - 3600_000));
      assert.equal(stats.quiet, 2);
      assert.equal(stats.repeated, 1);
      assert.equal(stats.merged, 2);
      assert.equal(stats.total, 5);
    });

    await t.test("the sandbox shows the same ending", async () => {
      const result = await runAgentTest(
        prisma,
        {
          projectId: project.id,
          userId: owner.id,
          messages: [
            { role: "user", content: "Merci pour tout" },
            { role: "assistant", content: "Avec plaisir, à bientôt !" },
            { role: "user", content: "ok" },
          ],
        },
        async (_history, _name, _contact, _config, extras) => {
          assert.equal(extras?.quiet, true);
          return "[[SILENCE]]";
        },
      );
      assert.equal(result.reply, "");
      assert.equal(result.trace.ending, "silent");
    });
  });
});

test("the quiet instruction names both markers", () => {
  assert.match(QUIET_INSTRUCTION, /\[\[FIN\]\]/);
  assert.match(QUIET_INSTRUCTION, /\[\[SILENCE\]\]/);
});
