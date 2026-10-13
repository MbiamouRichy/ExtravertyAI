import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { ingestMessage } from "../lib/evolution-ingestion";
import {
  claimMessageExtraction,
  runMessageExtraction,
} from "../lib/message-extraction";
import { claimAiJob, runAiJob } from "../lib/ai-jobs";
import { runInstinctCycle } from "../lib/ai-instinct";
import { DEFAULT_IMAGE_MODEL, ImageAnalysisError } from "../lib/image-analysis";
import { messageAiContent } from "../lib/message-ai-content";
import {
  TRANSCRIPTION_MODELS,
  TranscriptionError,
} from "../lib/audio-transcription";

test(
  "durable audio extraction, cache, leases and AI consumers",
  { timeout: 120000 },
  async (t) => {
    const db = await PGlite.create();
    const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 0 });
    let prisma: PrismaClient | undefined;
    try {
      for (const dir of (await readdir("prisma/migrations"))
        .filter((d) => /^\d/.test(d))
        .sort())
        await db.exec(
          await readFile("prisma/migrations/" + dir + "/migration.sql", "utf8"),
        );
      await server.start();
      prisma = new PrismaClient({
        adapter: new PrismaPg({
          connectionString:
            "postgresql://postgres:postgres@" +
            server.getServerConn() +
            "/postgres",
          max: 1,
        }),
      });
      const client = prisma;
      const remoteJid = "24112345678@s.whatsapp.net";
      async function fixture(manual = true) {
        const project = await client.project.create({
          data: {
            name: "Audio test",
            numero: "24100000000",
            instanceName: crypto.randomUUID(),
            status: "active",
            instanceStatus: "connected",
            agentSetupCompletedAt: new Date(),
            agentSystemMessage:
              "Vendre des sites web professionnels et accompagner les prospects dans leur demande de devis.",
          },
        });
        await client.quotaPeriod.create({
          data: {
            projectId: project.id,
            key: "test",
            kind: "active",
            startsAt: new Date(Date.now() - 60000),
            endsAt: new Date(Date.now() + 86400000),
            limit: 100,
          },
        });
        const contact = await client.contact.create({
          data: {
            projectId: project.id,
            phone: "24112345678",
            remoteJid,
            aiActive: !manual,
          },
        });
        return { project, contact };
      }
      async function audio(projectId: string, id: string) {
        await client.$transaction((tx) =>
          ingestMessage(tx, projectId, {
            key: { id, remoteJid, fromMe: false },
            message: { audioMessage: { mimetype: "audio/ogg" } },
          }),
        );
      }
      const load = async () => ({
        bytes: Buffer.from("OggS-test"),
        mime: "audio/ogg" as const,
        filename: "audio.ogg",
      });
      const result = {
        text: "Je souhaite un devis de 50 000 francs.",
        model: TRANSCRIPTION_MODELS[0],
      };
      await t.test(
        "manual conversation is transcribed once; duplicates and competing claims cost nothing",
        async () => {
          const { project, contact } = await fixture();
          await audio(project.id, "manual");
          await audio(project.id, "manual");
          assert.equal(
            await client.message.count({ where: { projectId: project.id } }),
            1,
          );
          assert.equal(
            await client.aiJob.count({ where: { projectId: project.id } }),
            0,
          );
          const job = await claimMessageExtraction(client);
          assert.ok(job);
          assert.equal(job.projectId, project.id);
          assert.equal(await claimMessageExtraction(client), null);
          assert.equal(
            await runInstinctCycle(client, async () => {
              throw Error("Must wait");
            }),
            null,
          );
          await client.contact.update({
            where: { id: contact.id },
            data: {
              instinctClassification: "none",
              instinctSourceId: job.id,
              instinctLeaseToken: "old-analysis",
            },
          });
          let calls = 0;
          await runMessageExtraction(
            client,
            job,
            async () => {
              calls++;
              return result;
            },
            load,
          );
          const saved = await client.message.findUniqueOrThrow({
            where: { id: job.id },
          });
          assert.equal(saved.extractedText, result.text);
          assert.equal(saved.content, "[AUDIO]");
          assert.equal(saved.extractionStatus, "COMPLETED");
          assert.equal(saved.extractionModel, TRANSCRIPTION_MODELS[0]);
          assert.equal(saved.extractionVersion, 1);
          assert.ok(saved.extractedAt);
          const refreshed = await client.contact.findUniqueOrThrow({
            where: { id: contact.id },
          });
          assert.equal(refreshed.instinctSourceId, null);
          assert.equal(refreshed.instinctLeaseToken, null);
          await runMessageExtraction(
            client,
            job,
            async () => {
              calls++;
              return result;
            },
            load,
          );
          assert.equal(await claimMessageExtraction(client), null);
          assert.equal(calls, 1);
          assert.equal(
            await runInstinctCycle(client, async (_goals, history) => {
              assert.equal(history[0].extractedText, result.text);
              return "interesting";
            }),
            project.id,
          );
          await client.project.delete({ where: { id: project.id } });
        },
      );
      await t.test(
        "automatic replies and later text wait for the persisted audio",
        async () => {
          const { project } = await fixture(false);
          await audio(project.id, "automatic");
          await client.$transaction((tx) =>
            ingestMessage(tx, project.id, {
              key: { id: "later-text", remoteJid, fromMe: false },
              message: { conversation: "Merci" },
            }),
          );
          assert.equal(await claimAiJob(client), null);
          const job = await claimMessageExtraction(client);
          assert.ok(job);
          await runMessageExtraction(client, job, async () => result, load);
          const aiJob = await claimAiJob(client);
          assert.ok(aiJob);
          let sawTranscript = false;
          await runAiJob(client, aiJob, async (history) => {
            sawTranscript = history.some((m) =>
              m.content.includes(result.text),
            );
            return "Quel type de site souhaitez-vous ?";
          });
          assert.equal(sawTranscript, true);
          assert.equal(
            (await client.aiJob.findUniqueOrThrow({ where: { id: aiJob.id } }))
              .state,
            "COMPLETED",
          );
          await client.project.delete({ where: { id: project.id } });
        },
      );
      await t.test(
        "expired leases are reclaimed and stale workers cannot write or call providers",
        async () => {
          const { project } = await fixture();
          await audio(project.id, "expired");
          const old = await claimMessageExtraction(client);
          assert.ok(old);
          await client.message.update({
            where: { id: old.id },
            data: { extractionLeaseUntil: new Date(0) },
          });
          const fresh = await claimMessageExtraction(client);
          assert.ok(fresh);
          assert.notEqual(fresh.extractionLeaseToken, old.extractionLeaseToken);
          let staleCalls = 0;
          await runMessageExtraction(
            client,
            old,
            async () => {
              staleCalls++;
              return result;
            },
            load,
          );
          assert.equal(staleCalls, 0);
          await runMessageExtraction(client, fresh, async () => result, load);
          assert.equal(
            (await client.message.findUniqueOrThrow({ where: { id: old.id } }))
              .extractionStatus,
            "COMPLETED",
          );
          await client.project.delete({ where: { id: project.id } });
        },
      );
      await t.test(
        "retries are bounded and a permanent failure is explicit",
        async () => {
          const { project } = await fixture();
          await audio(project.id, "failure");
          for (let attempt = 1; attempt <= 3; attempt++) {
            const job = await claimMessageExtraction(client);
            assert.ok(job);
            await runMessageExtraction(
              client,
              job,
              async () => {
                throw new TranscriptionError("TRANSCRIPTION_FAILED");
              },
              load,
            );
            const saved = await client.message.findUniqueOrThrow({
              where: { id: job.id },
            });
            assert.equal(
              saved.extractionStatus,
              attempt === 3 ? "FAILED" : "PENDING",
            );
            assert.equal(saved.extractedText, null);
            assert.equal(saved.extractionAttempts, attempt);
            await client.message.update({
              where: { id: job.id },
              data: { extractionAvailableAt: new Date(0) },
            });
          }
          assert.equal(await claimMessageExtraction(client), null);
          await audio(project.id, "account-error");
          const job = await claimMessageExtraction(client);
          assert.ok(job);
          await runMessageExtraction(
            client,
            job,
            async () => {
              throw new TranscriptionError("TRANSCRIPTION_HTTP_402", false);
            },
            load,
          );
          assert.equal(
            (await client.message.findUniqueOrThrow({ where: { id: job.id } }))
              .extractionStatus,
            "FAILED",
          );
          await client.project.delete({ where: { id: project.id } });
        },
      );
      await t.test(
        "paused manual access works, expired billing and deleted projects do not spend",
        async () => {
          const { project } = await fixture();
          await audio(project.id, "paused");
          await client.project.update({
            where: { id: project.id },
            data: {
              automationPaused: true,
              status: "paused",
              statusBeforePause: "active",
            },
          });
          const job = await claimMessageExtraction(client);
          assert.ok(job);
          await runMessageExtraction(client, job, async () => result, load);
          await audio(project.id, "expired-billing");
          await client.quotaPeriod.updateMany({
            where: { projectId: project.id },
            data: { startsAt: new Date(0), endsAt: new Date(1000) },
          });
          assert.equal(await claimMessageExtraction(client), null);
          await client.quotaPeriod.updateMany({
            where: { projectId: project.id },
            data: { endsAt: new Date(Date.now() + 60000) },
          });
          await client.project.update({
            where: { id: project.id },
            data: { deletionPending: true },
          });
          assert.equal(await claimMessageExtraction(client), null);
          await client.project.delete({ where: { id: project.id } });
        },
      );
      await t.test(
        "images with and without captions are queued once, persisted and reused by automatic replies",
        async () => {
          for (const caption of ["", "Je cherche ce modèle"]) {
            const { project } = await fixture(false);
            const raw = {
              key: { id: "image", remoteJid, fromMe: false },
              message: { imageMessage: { caption } },
            };
            await client.$transaction((tx) =>
              ingestMessage(tx, project.id, raw),
            );
            await client.$transaction((tx) =>
              ingestMessage(tx, project.id, raw),
            );
            assert.equal(
              await client.message.count({ where: { projectId: project.id } }),
              1,
            );
            assert.equal(
              await client.aiJob.count({ where: { projectId: project.id } }),
              1,
            );
            assert.equal(await claimAiJob(client), null);
            const job = await claimMessageExtraction(client);
            assert.ok(job);
            assert.equal(job.type, "IMAGE");
            assert.equal(await claimMessageExtraction(client), null);
            let analysisCalls = 0,
              audioCalls = 0;
            const imageResult = {
              text: "Description : ordinateur gris. Texte lisible : ABC-123.",
              model: DEFAULT_IMAGE_MODEL,
            };
            const imageLoad = async () => ({
              bytes: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
              mime: "image/png" as const,
              filename: "image.png",
            });
            const audioProcessor = async () => {
              audioCalls++;
              return result;
            };
            const imageProcessor = async () => {
              analysisCalls++;
              return imageResult;
            };
            await runMessageExtraction(
              client,
              job,
              audioProcessor,
              imageLoad,
              imageProcessor,
            );
            await runMessageExtraction(
              client,
              job,
              audioProcessor,
              imageLoad,
              imageProcessor,
            );
            assert.equal(analysisCalls, 1);
            assert.equal(audioCalls, 0);
            assert.equal(await claimMessageExtraction(client), null);
            const saved = await client.message.findUniqueOrThrow({
              where: { id: job.id },
            });
            assert.equal(saved.extractionStatus, "COMPLETED");
            assert.equal(saved.extractedText, imageResult.text);
            assert.equal(saved.extractionModel, DEFAULT_IMAGE_MODEL);
            assert.equal(saved.content, caption || "[IMAGE]");
            assert.ok(saved.extractedAt);
            await runInstinctCycle(client, async (_goals, history) => {
              assert.match(messageAiContent(history[0]), /ABC-123/);
              if (caption)
                assert.match(
                  messageAiContent(history[0]),
                  /Je cherche ce modèle/,
                );
              return "interesting";
            });
            const aiJob = await claimAiJob(client);
            assert.ok(aiJob);
            let sawImage = false;
            await runAiJob(client, aiJob, async (history) => {
              sawImage = history.some(
                (m) =>
                  m.content.includes("ABC-123") &&
                  (!caption || m.content.includes(caption)),
              );
              return "Quelle quantité souhaitez-vous ?";
            });
            assert.equal(sawImage, true);
            assert.equal(
              (
                await client.aiJob.findUniqueOrThrow({
                  where: { id: aiJob.id },
                })
              ).state,
              "COMPLETED",
            );
            await client.project.delete({ where: { id: project.id } });
          }
        },
      );
      await t.test(
        "image analysis runs in manual mode and permanent errors do not retry",
        async () => {
          const { project } = await fixture();
          await client.$transaction((tx) =>
            ingestMessage(tx, project.id, {
              key: { id: "image-failure", remoteJid, fromMe: false },
              message: { imageMessage: {} },
            }),
          );
          assert.equal(
            await client.aiJob.count({ where: { projectId: project.id } }),
            0,
          );
          const job = await claimMessageExtraction(client);
          assert.ok(job);
          await runMessageExtraction(
            client,
            job,
            async () => result,
            load,
            async () => {
              throw new ImageAnalysisError("IMAGE_HTTP_402", false);
            },
          );
          const saved = await client.message.findUniqueOrThrow({
            where: { id: job.id },
          });
          assert.equal(saved.extractionStatus, "FAILED");
          assert.equal(saved.extractionErrorCode, "IMAGE_HTTP_402");
          assert.equal(saved.extractedText, null);
          assert.equal(await claimMessageExtraction(client), null);
          await client.project.delete({ where: { id: project.id } });
        },
      );
    } finally {
      await prisma?.$disconnect();
      await server.stop();
      await db.close();
    }
  },
);
