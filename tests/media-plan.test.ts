import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "../src/generated/prisma/client";
import { claimAiJob } from "../lib/ai-jobs";
import { TRANSCRIPTION_MODELS } from "../lib/audio-transcription";
import { ingestMessage } from "../lib/evolution-ingestion";
import {
  claimMessageExtraction,
  runMessageExtraction,
} from "../lib/message-extraction";
import { mediaFeature, planAllows } from "../lib/plan-features";
import { activateBilling, createProject, withTestDatabase } from "./helpers/database";

const PLANS = ["starter", "pro", "business"] as const;

/** Note vocale ou photo reçue par WhatsApp, par le vrai chemin d’ingestion. */
async function receive(prisma: PrismaClient, projectId: string, kind: "audio" | "image") {
  const id = crypto.randomUUID();
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
    await ingestMessage(tx, projectId, {
      key: { id, fromMe: false, remoteJid: "24112345678@s.whatsapp.net" },
      message:
        kind === "audio"
          ? { audioMessage: { mimetype: "audio/ogg" } }
          : { imageMessage: {} },
    });
  });
  return prisma.message.findFirstOrThrow({ where: { projectId, evolutionId: id } });
}

const load = async () => ({
  bytes: Buffer.from("OggS-test"),
  mime: "audio/ogg" as const,
  filename: "audio.ogg",
});

test("voice notes are understood from Pro, images on Business only", () => {
  assert.deepEqual(
    PLANS.map((plan) => planAllows(plan, "audio")),
    [false, true, true],
  );
  assert.deepEqual(
    PLANS.map((plan) => planAllows(plan, "images")),
    [false, false, true],
  );
  assert.equal(mediaFeature("AUDIO"), "audio");
  assert.equal(mediaFeature("IMAGE"), "images");
  assert.equal(mediaFeature("VIDEO"), null);
  assert.equal(mediaFeature("TEXT"), null);
});

test("media is only sent to paid analysis on plans that include it", async () => {
  await withTestDatabase(async (prisma) => {
    async function project(plan: (typeof PLANS)[number]) {
      const { id } = await createProject(prisma, { plan });
      await activateBilling(prisma, id);
      await prisma.project.update({
        where: { id },
        data: {
          instanceStatus: "connected",
          agentSetupCompletedAt: new Date(),
          agentSystemMessage: "Vendre des sites web professionnels à Libreville.",
        },
      });
      return id;
    }
    const message = (id: string) => prisma.message.findUniqueOrThrow({ where: { id } });
    let paidCalls = 0;
    const transcribe = async () => {
      paidCalls += 1;
      return { text: "Je souhaite un devis.", model: TRANSCRIPTION_MODELS[0] };
    };

    // Starter : rien en file d’analyse, et la réponse de l’IA n’attend pas.
    const starter = await project("starter");
    const starterAudio = await receive(prisma, starter, "audio");
    assert.equal(starterAudio.extractionStatus, null);
    assert.equal((await claimAiJob(prisma))?.projectId, starter);
    const starterImage = await receive(prisma, starter, "image");
    assert.equal(starterImage.extractionStatus, null);
    assert.equal(await claimMessageExtraction(prisma), null);

    // Pro : la note vocale est transcrite, la photo ne l’est pas.
    const pro = await project("pro");
    const proAudio = await receive(prisma, pro, "audio");
    const proImage = await receive(prisma, pro, "image");
    assert.equal(proAudio.extractionStatus, "PENDING");
    assert.equal(proImage.extractionStatus, null);
    const proJob = await claimMessageExtraction(prisma);
    assert.equal(proJob?.id, proAudio.id);
    assert.equal(await claimMessageExtraction(prisma), null);
    await runMessageExtraction(prisma, proJob!, transcribe, load);
    assert.equal((await message(proAudio.id)).extractionStatus, "COMPLETED");
    assert.equal(paidCalls, 1);

    // Business : les deux médias attendent leur analyse.
    const business = await project("business");
    const businessAudio = await receive(prisma, business, "audio");
    const businessImage = await receive(prisma, business, "image");
    assert.equal(businessAudio.extractionStatus, "PENDING");
    assert.equal(businessImage.extractionStatus, "PENDING");

    // Passage à Pro avant l’analyse : la photo est libérée sans appel payant,
    // la note vocale reste comprise.
    await prisma.project.update({ where: { id: business }, data: { plan: "pro" } });
    const audioJob = await claimMessageExtraction(prisma);
    assert.equal(audioJob?.id, businessAudio.id);
    const released = await message(businessImage.id);
    assert.equal(released.extractionStatus, null);
    assert.equal(released.extractionErrorCode, "PLAN_EXCLUDED");
    assert.equal(await claimMessageExtraction(prisma), null);

    // Passage à Starter après la réservation : aucun appel payant, rien en attente.
    await prisma.project.update({ where: { id: business }, data: { plan: "starter" } });
    await runMessageExtraction(prisma, audioJob!, transcribe, load);
    assert.equal(paidCalls, 1);
    const fenced = await message(businessAudio.id);
    assert.equal(fenced.extractionStatus, null);
    assert.equal(fenced.extractionLeaseToken, null);
    assert.equal(fenced.extractedText, null);
    assert.equal(fenced.extractionErrorCode, "PLAN_EXCLUDED");
  });
});
