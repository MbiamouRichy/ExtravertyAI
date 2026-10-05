import {
  conversationUnreadCounts,
  markConversationRead,
} from "../lib/conversation-reads";
import { createOutboundProcessor } from "../lib/outbound-jobs";
import {
  writeAgentConfig,
  writeProjectPause,
  markProjectForDeletion,
} from "../lib/project-settings";
import { AGENT_DEFAULTS, buildAgentSystemMessage } from "../lib/agent-config";
import { csvCell } from "../lib/export-csv";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  ingestMessage,
  latestStatus,
  deliveryStatus,
  saveReceipt,
  reconcileReceipt,
} from "../lib/evolution-ingestion";
import { claimAiJob, runAiJob } from "../lib/ai-jobs";
import { runInstinctCycle } from "../lib/ai-instinct";
import { reserveMessageQuota } from "../lib/message-quota";
import { syncSubscription, subscriptionStatus } from "../lib/billing-quota";
import type Stripe from "stripe";

// Isolated PostgreSQL WASM database. Never reads DATABASE_URL or sends to any provider.
test(
  "durable messaging, migration chain and billing",
  { timeout: 120000 },
  async (t) => {
    const db = await PGlite.create();
    const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 0 });
    let prisma: PrismaClient | undefined;
    try {
      for (const folder of (await readdir("prisma/migrations"))
        .filter((f) => /^\d/.test(f))
        .sort()) {
        await db.exec(
          await readFile(`prisma/migrations/${folder}/migration.sql`, "utf8"),
        );
      }
      await server.start();
      const connectionString = `postgresql://postgres:postgres@${server.getServerConn()}/postgres`;
      prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString, max: 1 }),
      });
      const client = prisma;
      async function fixture(limit = 10) {
        const id = crypto.randomUUID();
        const p = await client.project.create({
          data: {
            agentSetupCompletedAt: new Date(),
            agentSystemMessage:
              "Accueille les prospects de notre entreprise et propose un conseiller si nécessaire.",
            name: "Test",
            numero: "24100000000",
            instanceName: id,
            status: "active",
            instanceStatus: "connected",
          },
        });
        await client.quotaPeriod.create({
          data: {
            projectId: p.id,
            key: "test",
            kind: "active",
            startsAt: new Date(Date.now() - 60000),
            endsAt: new Date(Date.now() + 86400000),
            limit,
          },
        });
        return p;
      }
      async function pauseActor(
        projectId: string,
        role: "OWNER" | "ADMIN" | "USER" = "ADMIN",
      ) {
        const actor = await client.user.create({
          data: {
            id: crypto.randomUUID(),
            name: "Pause test",
            email: crypto.randomUUID() + "@example.test",
            emailVerified: false,
          },
        });
        await client.projectMembership.create({
          data: { projectId, userId: actor.id, role },
        });
        return actor;
      }
      async function incoming(projectId: string, id: string) {
        await client.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
          await ingestMessage(tx, projectId, {
            key: { id, fromMe: false, remoteJid: "24112345678@s.whatsapp.net" },
            message: { conversation: "Bonjour" },
          });
        });
      }
      await t.test(
        "AI instinct persists manual-chat assessments, caches and fences concurrent workers",
        async () => {
          const project = await fixture();
          await incoming(project.id, "instinct-first");
          const contact = await client.contact.findFirstOrThrow({
            where: { projectId: project.id },
          });
          await client.contact.update({
            where: { id: contact.id },
            data: { aiActive: false },
          });
          let unexpectedCalls = 0;
          assert.equal(
            await runInstinctCycle(client, async (goals, history) => {
              assert.equal(goals, project.agentSystemMessage);
              assert.equal(history[0].content, "Bonjour");
              assert.equal(
                await runInstinctCycle(client, async () => {
                  unexpectedCalls += 1;
                  return false;
                }),
                null,
              );
              return true;
            }),
            project.id,
          );
          let saved = await client.contact.findUniqueOrThrow({
            where: { id: contact.id },
          });
          assert.equal(saved.instinctInteresting, true);
          assert.ok(saved.instinctSourceId);
          assert.equal(unexpectedCalls, 0);
          assert.equal(
            await runInstinctCycle(client, async () => {
              unexpectedCalls += 1;
              return false;
            }),
            null,
          );
          await incoming(project.id, "instinct-second");
          assert.equal(unexpectedCalls, 0);
          await runInstinctCycle(client, async () => false);
          saved = await client.contact.findUniqueOrThrow({
            where: { id: contact.id },
          });
          assert.equal(saved.instinctInteresting, false);
          await client.project.update({
            where: { id: project.id },
            data: { agentConfigVersion: { increment: 1 } },
          });
          assert.equal(
            await runInstinctCycle(client, async () => true),
            project.id,
          );
          await incoming(project.id, "instinct-third");
          await runInstinctCycle(client, async () => {
            throw new Error("provider down");
          });
          assert.equal(
            await runInstinctCycle(client, async () => {
              unexpectedCalls += 1;
              return false;
            }),
            null,
          );
          await client.project.delete({ where: { id: project.id } });
          assert.equal(unexpectedCalls, 0);
        },
      );
      await t.test(
        "conversation reads are member-scoped, monotonic and isolated by project",
        async () => {
          const project = await fixture();
          const otherProject = await fixture();
          const first = await pauseActor(project.id);
          const second = await pauseActor(project.id);
          const outsider = await pauseActor(otherProject.id);
          const contact = await client.contact.create({
            data: {
              projectId: project.id,
              phone: "24111111111",
              remoteJid: "reads@test",
            },
          });
          const otherContact = await client.contact.create({
            data: {
              projectId: otherProject.id,
              phone: "24122222222",
              remoteJid: "reads@test",
            },
          });
          const prefix = crypto.randomUUID();
          const at = new Date("2026-10-03T10:00:00Z");
          const ids = [prefix + "a", prefix + "b", prefix + "c"];
          for (const id of ids)
            await client.message.create({
              data: {
                id,
                projectId: project.id,
                contactId: contact.id,
                content: "Bonjour",
                senderType: "CLIENT",
                fromMe: false,
                status: "SENT",
                createdAt: at,
              },
            });
          await client.message.create({
            data: {
              projectId: project.id,
              contactId: contact.id,
              content: "Réponse",
              senderType: "BOT",
              fromMe: true,
              status: "SENT",
              createdAt: at,
            },
          });
          const count = async (userId: string) =>
            (
              await conversationUnreadCounts(client, project.id, userId, [
                contact.id,
              ])
            ).get(contact.id) ?? 0;
          assert.equal(await count(first.id), 3);
          assert.equal(await count(outsider.id), 0);
          assert.equal(
            await markConversationRead(
              client,
              project.id,
              outsider.id,
              contact.id,
              ids[2],
            ),
            0,
          );
          assert.equal(
            await markConversationRead(
              client,
              otherProject.id,
              outsider.id,
              contact.id,
              ids[2],
            ),
            0,
          );
          assert.equal(
            await markConversationRead(
              client,
              project.id,
              first.id,
              otherContact.id,
              ids[2],
            ),
            0,
          );
          await markConversationRead(
            client,
            project.id,
            first.id,
            contact.id,
            ids[1],
          );
          assert.equal(await count(first.id), 1);
          assert.equal(await count(second.id), 3);
          await markConversationRead(
            client,
            project.id,
            first.id,
            contact.id,
            ids[1],
          );
          await markConversationRead(
            client,
            project.id,
            first.id,
            contact.id,
            ids[0],
          );
          assert.equal(await count(first.id), 1);
          await client.message.create({
            data: {
              projectId: project.id,
              contactId: contact.id,
              content: "Nouveau message",
              senderType: "CLIENT",
              fromMe: false,
              status: "SENT",
              createdAt: new Date(at.getTime() + 1000),
            },
          });
          assert.equal(await count(first.id), 2);
          await markConversationRead(
            client,
            project.id,
            first.id,
            contact.id,
            ids[2],
          );
          assert.equal(await count(first.id), 1);
          await client.projectMembership.delete({
            where: {
              userId_projectId: { userId: first.id, projectId: project.id },
            },
          });
          assert.equal(await count(first.id), 0);
          assert.equal(
            await markConversationRead(
              client,
              project.id,
              first.id,
              contact.id,
              ids[2],
            ),
            0,
          );
        },
      );
      await t.test(
        "deletion is owner-only and blocks uncertain sends without losing references",
        async () => {
          const p = await fixture();
          const owner = await client.user.create({
            data: {
              id: crypto.randomUUID(),
              name: "Owner",
              email: crypto.randomUUID() + "@example.test",
              emailVerified: false,
            },
          });
          const admin = await client.user.create({
            data: {
              id: crypto.randomUUID(),
              name: "Admin",
              email: crypto.randomUUID() + "@example.test",
              emailVerified: false,
            },
          });
          await client.projectMembership.createMany({
            data: [
              { projectId: p.id, userId: owner.id, role: "OWNER" },
              { projectId: p.id, userId: admin.id, role: "ADMIN" },
            ],
          });
          await assert.rejects(
            client.$transaction((tx) =>
              markProjectForDeletion(tx, p.id, admin.id),
            ),
            /droits/,
          );
          await incoming(p.id, "delete-pending");
          const job = await claimAiJob(client);
          assert.ok(job);
          await runAiJob(client, job, async () => "Draft reply");
          const outbound = await client.outboundJob.findFirstOrThrow({
            where: { projectId: p.id },
          });
          await client.outboundJob.update({
            where: { id: outbound.id },
            data: { state: "UNCERTAIN" },
          });
          await assert.rejects(
            client.$transaction((tx) =>
              markProjectForDeletion(tx, p.id, owner.id),
            ),
            /envoi/,
          );
          assert.equal(
            (await client.project.findUniqueOrThrow({ where: { id: p.id } }))
              .deletionPending,
            false,
          );
          await client.outboundJob.update({
            where: { id: outbound.id },
            data: { state: "CANCELLED" },
          });
          await client.$transaction((tx) =>
            markProjectForDeletion(tx, p.id, owner.id),
          );
          const retained = await client.project.findUniqueOrThrow({
            where: { id: p.id },
          });
          assert.equal(retained.deletionPending, true);
          assert.equal(retained.automationPaused, true);
          assert.equal(retained.instanceName, p.instanceName);
          assert.equal(retained.status, "active");
          await assert.rejects(
            client.$transaction((tx) => reserveMessageQuota(tx, p.id)),
            /actif/,
          );
        },
      );
      await t.test(
        "exhausted quota cancels generation before contacting the model",
        async () => {
          const p = await fixture(0);
          await incoming(p.id, "quota-empty");
          assert.equal(await claimAiJob(client), null);
          const job = await client.aiJob.findFirstOrThrow({
            where: { projectId: p.id },
          });
          assert.equal(job.state, "CANCELLED");
          assert.equal(job.errorCode, "QUOTA_EXCEEDED");
          assert.equal(job.attempts, 0);
        },
      );
      await t.test(
        "agent setup gates jobs and configuration enforces access and versioning",
        async () => {
          const p = await fixture();
          await client.project.update({
            where: { id: p.id },
            data: { agentSetupCompletedAt: null },
          });
          await incoming(p.id, "before-setup");
          assert.equal(
            await client.aiJob.count({ where: { projectId: p.id } }),
            0,
          );
          const owner = await client.user.create({
            data: {
              id: crypto.randomUUID(),
              name: "Owner",
              email: crypto.randomUUID() + "@example.test",
              emailVerified: false,
            },
          });
          const member = await client.user.create({
            data: {
              id: crypto.randomUUID(),
              name: "Member",
              email: crypto.randomUUID() + "@example.test",
              emailVerified: false,
            },
          });
          await client.projectMembership.createMany({
            data: [
              { userId: owner.id, projectId: p.id, role: "OWNER" },
              { userId: member.id, projectId: p.id, role: "USER" },
            ],
          });
          const config = {
            ...AGENT_DEFAULTS,
            agentName: "Nora",
            agentSystemMessage:
              "Notre entreprise accompagne les prospects dans leur recherche de services.",
          };
          await assert.rejects(
            client.$transaction((tx) =>
              writeAgentConfig(tx, p.id, member.id, 0, config),
            ),
            /droits/,
          );
          await assert.rejects(
            client.$transaction((tx) =>
              writeAgentConfig(tx, p.id, "outsider", 0, config),
            ),
            /droits/,
          );
          assert.equal(
            await client.$transaction((tx) =>
              writeAgentConfig(tx, p.id, owner.id, 0, config),
            ),
            1,
          );
          await assert.rejects(
            client.$transaction((tx) =>
              writeAgentConfig(tx, p.id, owner.id, 0, config),
            ),
            /modifié/,
          );
          assert.equal(
            await client.settingsAudit.count({ where: { projectId: p.id } }),
            1,
          );
          await incoming(p.id, "after-setup");
          const job = await claimAiJob(client);
          assert.ok(job);
          assert.equal(job.agentConfigVersion, 1);
          await runAiJob(
            client,
            job,
            async (_history, _project, _contact, actualConfig) => {
              assert.equal(actualConfig.agentName, "Nora");
              await client.$transaction((tx) =>
                writeAgentConfig(tx, p.id, owner.id, 1, {
                  ...config,
                  agentName: "Lina",
                }),
              );
              return "Obsolete response";
            },
          );
          assert.equal(
            (await client.aiJob.findUniqueOrThrow({ where: { id: job.id } }))
              .state,
            "CANCELLED",
          );
          assert.equal(
            (
              await client.quotaPeriod.findFirstOrThrow({
                where: { projectId: p.id },
              })
            ).used,
            0,
          );
          const prompt = buildAgentSystemMessage(
            { ...config, agentLanguage: "en", agentUseEmojis: false },
            p.name,
          );
          assert.match(prompt, /Nora/);
          assert.match(prompt, /anglais/);
          assert.match(prompt, /pas d'emoji/);
        },
      );
      await t.test(
        "project pause and configuration changes cancel queued bot sends",
        async () => {
          const p = await fixture();
          await incoming(p.id, "pause-send");
          const job = await claimAiJob(client);
          assert.ok(job);
          await runAiJob(client, job, async () => "Ready to send");
          await client.project.update({
            where: { id: p.id },
            data: {
              automationPaused: true,
              agentConfigVersion: { increment: 1 },
            },
          });
          const outbound = createOutboundProcessor(client, async () => {});
          const send = await outbound.claimNextJob();
          assert.ok(send);
          assert.equal(send.cancelled, true);
          await incoming(p.id, "paused-inbound");
          assert.equal(
            await client.aiJob.count({ where: { projectId: p.id } }),
            1,
          );
          assert.equal(
            (await client.project.findUniqueOrThrow({ where: { id: p.id } }))
              .status,
            "active",
          );
        },
      );
      await t.test(
        "project pause is scoped to owners and admins and preserves individual contact choices",
        async () => {
          for (const role of ["OWNER", "ADMIN", "USER"] as const) {
            const p = await fixture();
            const actor = await pauseActor(p.id, role);
            if (role === "USER") {
              await assert.rejects(
                client.$transaction((tx) =>
                  writeProjectPause(tx, p.id, actor.id, 0, true),
                ),
                /droits/,
              );
              continue;
            }
            const contact = await client.contact.create({
              data: {
                projectId: p.id,
                remoteJid: "241000001@s.whatsapp.net",
                phone: "241000001",
                aiActive: false,
              },
            });
            await client.$transaction((tx) =>
              writeProjectPause(tx, p.id, actor.id, 0, true),
            );
            const paused = await client.project.findUniqueOrThrow({
              where: { id: p.id },
            });
            assert.equal(paused.status, "paused");
            assert.equal(paused.statusBeforePause, "active");
            assert.equal(paused.automationPaused, true);
            await assert.rejects(
              client.$transaction((tx) =>
                writeProjectPause(tx, p.id, actor.id, 0, false),
              ),
              /réglages ont changé/,
            );
            // Manual replies still use the paid quota while automation is paused.
            await client.$transaction((tx) => reserveMessageQuota(tx, p.id));
            await client.$transaction((tx) =>
              writeProjectPause(tx, p.id, actor.id, 1, false),
            );
            const resumed = await client.project.findUniqueOrThrow({
              where: { id: p.id },
            });
            assert.equal(resumed.status, "active");
            assert.equal(resumed.automationPaused, false);
            assert.equal(resumed.messageCount, 1);
            assert.equal(
              (
                await client.contact.findUniqueOrThrow({
                  where: { id: contact.id },
                })
              ).aiActive,
              false,
            );
            const other = await fixture();
            await assert.rejects(
              client.$transaction((tx) =>
                writeProjectPause(tx, other.id, actor.id, 0, true),
              ),
              /droits/,
            );
          }
        },
      );
      await t.test(
        "global pause fences in-flight generation and queued bot replies even after resuming",
        async () => {
          const p = await fixture();
          const actor = await pauseActor(p.id);
          await incoming(p.id, "global-generating");
          const job = await claimAiJob(client);
          assert.ok(job);
          await client.$transaction((tx) =>
            writeProjectPause(tx, p.id, actor.id, 0, true),
          );
          await incoming(p.id, "global-paused-inbound");
          assert.equal(
            await client.aiJob.count({ where: { projectId: p.id } }),
            1,
          );
          await client.$transaction((tx) =>
            writeProjectPause(tx, p.id, actor.id, 1, false),
          );
          await runAiJob(client, job, async () => "Must never be sent");
          assert.equal(
            (await client.aiJob.findUniqueOrThrow({ where: { id: job.id } }))
              .state,
            "CANCELLED",
          );
          assert.equal(
            await client.outboundJob.count({ where: { projectId: p.id } }),
            0,
          );
          await incoming(p.id, "global-queued-bot");
          const next = await claimAiJob(client);
          assert.ok(next);
          await runAiJob(client, next, async () => "Queued before pause");
          await client.$transaction((tx) =>
            writeProjectPause(tx, p.id, actor.id, 2, true),
          );
          await client.$transaction((tx) =>
            writeProjectPause(tx, p.id, actor.id, 3, false),
          );
          const sender = createOutboundProcessor(client, async () => {});
          assert.equal((await sender.claimNextJob())?.cancelled, true);
        },
      );
      await t.test(
        "duplicate inbound creates one message/job and no quota charge",
        async () => {
          const p = await fixture();
          await incoming(p.id, "duplicate");
          await incoming(p.id, "duplicate");
          assert.equal(
            await client.message.count({ where: { projectId: p.id } }),
            1,
          );
          assert.equal(
            await client.aiJob.count({ where: { projectId: p.id } }),
            1,
          );
          assert.equal(
            (
              await client.quotaPeriod.findFirstOrThrow({
                where: { projectId: p.id },
              })
            ).used,
            0,
          );
          const job = await claimAiJob(client);
          assert.ok(job);
          await runAiJob(client, job, async () => "Bonjour !");
          await runAiJob(client, job, async () => "Bonjour !");
          assert.equal(
            await client.outboundJob.count({ where: { projectId: p.id } }),
            1,
          );
          assert.equal(
            (
              await client.quotaPeriod.findFirstOrThrow({
                where: { projectId: p.id },
              })
            ).used,
            1,
          );
          const send = await client.outboundJob.findFirstOrThrow({
            where: { projectId: p.id },
            include: { message: true },
          });
          assert.equal(send.message.senderType, "BOT");
          assert.equal(send.message.status, "PENDING");
        },
      );
      await t.test(
        "handover during generation cancels admission without consuming quota",
        async () => {
          const p = await fixture();
          await incoming(p.id, "handover");
          const job = await claimAiJob(client);
          assert.ok(job);
          await runAiJob(client, job, async () => {
            await client.contact.update({
              where: { id: job.contactId },
              data: { aiActive: false, aiVersion: { increment: 1 } },
            });
            return "Obsolete reply";
          });
          assert.equal(
            (await client.aiJob.findUniqueOrThrow({ where: { id: job.id } }))
              .state,
            "CANCELLED",
          );
          assert.equal(
            await client.outboundJob.count({ where: { projectId: p.id } }),
            0,
          );
          assert.equal(
            (
              await client.quotaPeriod.findFirstOrThrow({
                where: { projectId: p.id },
              })
            ).used,
            0,
          );
        },
      );
      await t.test(
        "failed generation retries without creating an outbound or consuming quota",
        async () => {
          const p = await fixture();
          await incoming(p.id, "retry");
          const job = await claimAiJob(client);
          assert.ok(job);
          await runAiJob(client, job, async () => {
            throw new Error("AI_HTTP_503");
          });
          const current = await client.aiJob.findUniqueOrThrow({
            where: { id: job.id },
          });
          assert.equal(current.state, "QUEUED");
          assert.equal(current.attempts, 1);
          assert.equal(
            await client.outboundJob.count({ where: { projectId: p.id } }),
            0,
          );
          await client.aiJob.update({
            where: { id: job.id },
            data: { state: "CANCELLED" },
          });
        },
      );
      await t.test(
        "expired generation is fenced and cannot admit a reply",
        async () => {
          const p = await fixture();
          await incoming(p.id, "lease");
          const job = await claimAiJob(client);
          assert.ok(job);
          await client.aiJob.update({
            where: { id: job.id },
            data: { leaseUntil: new Date(0) },
          });
          const replacement = await claimAiJob(client);
          assert.ok(replacement);
          assert.notEqual(replacement.leaseToken, job.leaseToken);
          await runAiJob(client, job, async () => "Stale");
          assert.equal(
            await client.outboundJob.count({ where: { projectId: p.id } }),
            0,
          );
          await runAiJob(client, replacement, async () => "Fresh");
          assert.equal(
            await client.outboundJob.count({ where: { projectId: p.id } }),
            1,
          );
        },
      );
      await t.test(
        "quota rejection and transaction rollback never overcharge",
        async () => {
          const p = await fixture(1);
          await assert.rejects(
            client.$transaction(async (tx) => {
              await reserveMessageQuota(tx, p.id);
              throw new Error("Rollback");
            }),
          );
          assert.equal(
            (
              await client.quotaPeriod.findFirstOrThrow({
                where: { projectId: p.id },
              })
            ).used,
            0,
          );
          await client.$transaction((tx) => reserveMessageQuota(tx, p.id));
          await assert.rejects(
            client.$transaction((tx) => reserveMessageQuota(tx, p.id)),
            /quota/,
          );
          assert.equal(
            (
              await client.quotaPeriod.findFirstOrThrow({
                where: { projectId: p.id },
              })
            ).used,
            1,
          );
        },
      );
      await t.test(
        "early READ receipt and echo reconcile without regression or duplicate",
        async () => {
          const p = await fixture();
          await incoming(p.id, "echo-test");
          const job = await claimAiJob(client);
          assert.ok(job);
          await runAiJob(client, job, async () => "Reply");
          const outbound = await client.outboundJob.findFirstOrThrow({
            where: { projectId: p.id },
          });
          await client.$transaction(async (tx) => {
            await saveReceipt(tx, p.id, "provider-123", "READ");
            await saveReceipt(tx, p.id, "provider-123", "SENT", {
              remoteJid: "24112345678@s.whatsapp.net",
              content: "Reply",
            });
            await tx.message.update({
              where: { id: outbound.messageId },
              data: { evolutionId: "provider-123" },
            });
            const receipt = await tx.providerReceipt.findUniqueOrThrow({
              where: {
                projectId_providerId: {
                  projectId: p.id,
                  providerId: "provider-123",
                },
              },
            });
            await reconcileReceipt(tx, receipt.id);
          });
          assert.equal(
            (
              await client.message.findUniqueOrThrow({
                where: { id: outbound.messageId },
              })
            ).status,
            "READ",
          );
          assert.equal(
            await client.message.count({ where: { projectId: p.id } }),
            2,
          );
          assert.equal(deliveryStatus(4), "READ");
          assert.equal(latestStatus("READ", "SENT"), "READ");
        },
      );
      await t.test("provider IDs are isolated per project", async () => {
        const a = await fixture(),
          b = await fixture();
        await incoming(a.id, "shared-provider-id");
        await incoming(b.id, "shared-provider-id");
        assert.equal(
          await client.message.count({
            where: { evolutionId: "shared-provider-id" },
          }),
          2,
        );
        await client.aiJob.updateMany({
          where: { projectId: { in: [a.id, b.id] } },
          data: { state: "CANCELLED" },
        });
      });
      await t.test(
        "outbound accepts an early echo exactly once and never retries uncertain transport",
        async () => {
          // Isolate this test from queued sends produced by earlier scenarios.
          await client.outboundJob.updateMany({
            where: { state: "QUEUED" },
            data: { state: "CANCELLED" },
          });
          const p = await fixture();
          await incoming(p.id, "dispatch-test");
          const ai = await claimAiJob(client);
          assert.ok(ai);
          await runAiJob(client, ai, async () => "Reply");
          const processor = createOutboundProcessor(client, async () => {});
          const claimed = await processor.claimNextJob();
          assert.ok(claimed && !claimed.cancelled);
          assert.equal(await processor.claimNextJob(), null);
          const originalFetch = globalThis.fetch;
          process.env.EVOLUTION_API_URL = "https://provider.invalid";
          process.env.EVOLUTION_API_KEY = "test";
          let calls = 0;
          try {
            globalThis.fetch = async () => {
              calls++;
              await client.$transaction((tx) =>
                saveReceipt(tx, p.id, "ack-early", "READ", {
                  remoteJid: "24112345678@s.whatsapp.net",
                  content: "Reply",
                }),
              );
              return new Response(
                JSON.stringify({ key: { id: "ack-early" } }),
                { status: 200 },
              );
            };
            await processor.dispatch(claimed);
            assert.equal(calls, 1);
            assert.equal(
              (
                await client.message.findUniqueOrThrow({
                  where: { id: claimed.messageId },
                })
              ).status,
              "READ",
            );
            assert.equal(
              (
                await client.outboundJob.findUniqueOrThrow({
                  where: { id: claimed.jobId },
                })
              ).state,
              "ACCEPTED",
            );
            assert.equal(await processor.claimNextJob(), null);
            await incoming(p.id, "dispatch-timeout");
            const nextAi = await claimAiJob(client);
            assert.ok(nextAi);
            await runAiJob(client, nextAi, async () => "Reply two");
            const next = await processor.claimNextJob();
            assert.ok(next && !next.cancelled);
            globalThis.fetch = async () => {
              calls++;
              throw new Error("Network timeout");
            };
            await processor.dispatch(next);
            assert.equal(
              (
                await client.outboundJob.findUniqueOrThrow({
                  where: { id: next.jobId },
                })
              ).state,
              "UNCERTAIN",
            );
            assert.equal(await processor.claimNextJob(), null);
            assert.equal(calls, 2);
          } finally {
            globalThis.fetch = originalFetch;
          }
        },
      );
      await t.test(
        "BOT queued before handover is cancelled at dispatch",
        async () => {
          const p = await fixture();
          await incoming(p.id, "queued-handover");
          const job = await claimAiJob(client);
          assert.ok(job);
          await runAiJob(client, job, async () => "Do not send");
          await client.contact.update({
            where: { id: job.contactId },
            data: { aiVersion: { increment: 1 }, aiActive: false },
          });
          const processor = createOutboundProcessor(client, async () => {});
          const claimed = await processor.claimNextJob();
          assert.ok(claimed?.cancelled);
          const outbound = await client.outboundJob.findFirstOrThrow({
            where: { projectId: p.id },
            include: { message: true },
          });
          assert.equal(outbound.state, "CANCELLED");
          assert.equal(outbound.message.status, "FAILED");
        },
      );
      await t.test(
        "billing duplicates preserve quota and renewal opens exactly one new period",
        async () => {
          process.env.STRIPE_STARTER_PLAN_ID = "price_test";
          process.env.MESSAGE_LIMIT_STARTER = "1000";
          const p = await fixture();
          await client.quotaPeriod.deleteMany({ where: { projectId: p.id } });
          await client.project.update({
            where: { id: p.id },
            data: { status: "inactive", messageCount: 0, allMessagesCount: 0 },
          });
          assert.equal(
            (await client.project.findUniqueOrThrow({ where: { id: p.id } }))
              .status,
            "inactive",
          );
          const start = Math.floor(Date.now() / 1000);
          const sub = {
            id: "sub_test",
            metadata: { projectId: p.id },
            customer: "cus_test",
            status: "trialing",
            trial_start: start,
            trial_end: start + 864000,
            items: {
              data: [
                {
                  price: { id: "price_test" },
                  current_period_start: start,
                  current_period_end: start + 864000,
                },
              ],
            },
            latest_invoice: null,
          } as unknown as Stripe.Subscription;
          await syncSubscription(client, sub, 10);
          const activated = await client.project.findUniqueOrThrow({
            where: { id: p.id },
          });
          assert.equal(activated.status, "trialing");
          assert.equal(activated.stripeSubscriptionId, sub.id);
          assert.equal(activated.allMessagesCount, 150);
          assert.equal(activated.messageCount, 0);
          assert.equal(activated.expiredAt?.getTime(), (start + 864000) * 1000);
          await client.$transaction((tx) => reserveMessageQuota(tx, p.id));
          await syncSubscription(client, sub, 10);
          assert.equal(
            (
              await client.quotaPeriod.findFirstOrThrow({
                where: { projectId: p.id, isCurrent: true },
              })
            ).used,
            1,
          );
          sub.status = "active";
          sub.items.data[0].current_period_end = start + 2592000;
          sub.latest_invoice = {
            status: "paid",
            lines: {
              data: [
                {
                  period: { start, end: start + 2592000 },
                  pricing: { price_details: { price: "price_test" } },
                },
              ],
            },
          } as unknown as Stripe.Invoice;
          await syncSubscription(client, sub, 11);
          await syncSubscription(client, sub, 11);
          const period = await client.quotaPeriod.findFirstOrThrow({
            where: { projectId: p.id, isCurrent: true },
          });
          assert.equal(period.used, 0);
          assert.equal(period.limit, 1000);
          assert.equal(
            await client.quotaPeriod.count({
              where: { projectId: p.id, isCurrent: true },
            }),
            1,
          );
          assert.equal(subscriptionStatus("incomplete"), "inactive");
          const actor = await pauseActor(p.id);
          await client.$transaction((tx) =>
            writeProjectPause(tx, p.id, actor.id, 0, true),
          );
          await syncSubscription(client, sub, 11);
          assert.equal(
            (await client.project.findUniqueOrThrow({ where: { id: p.id } }))
              .status,
            "paused",
          );
          sub.status = "past_due";
          await syncSubscription(client, sub, 12);
          await assert.rejects(
            client.$transaction((tx) =>
              writeProjectPause(tx, p.id, actor.id, 1, false),
            ),
            /abonnement/,
          );
          sub.status = "active";
          await syncSubscription(client, sub, 13);
          await client.$transaction((tx) =>
            writeProjectPause(tx, p.id, actor.id, 1, false),
          );
          assert.equal(
            (await client.project.findUniqueOrThrow({ where: { id: p.id } }))
              .status,
            "active",
          );
        },
      );
    } finally {
      await prisma?.$disconnect();
      await server.stop();
      await db.close();
    }
  },
);

test("CSV exports neutralize formulas and escape cells", () => {
  assert.equal(csvCell("=SUM(1,2)"), '"\'=SUM(1,2)"');
  assert.equal(csvCell('a;"b'), '"a;""b"');
});
