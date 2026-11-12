import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createTestPGlite } from "./helpers/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { PolarSubscription } from "../lib/polar";
import {
  billingAccess,
  getBillingAccess,
  type BillingSnapshot,
} from "../lib/billing-access";
import {
  queueBillingEmails,
  deliverNextBillingEmail,
  reconcileNextBillingProject,
} from "../lib/billing-lifecycle";
import { syncPolarSubscription } from "../lib/billing-polar";
import { applySubscriptionState } from "../lib/billing-quota";
import { reserveMessageQuota } from "../lib/message-quota";
import { runInstinctCycle } from "../lib/ai-instinct";
import { claimAiJob, runAiJob } from "../lib/ai-jobs";
import { ingestMessage } from "../lib/evolution-ingestion";
import { createOutboundProcessor } from "../lib/outbound-jobs";

test("billing access expires at the exact deadline and respects billing versus manual pause", () => {
  const now = new Date("2026-10-05T10:00:00Z");
  const snapshot: BillingSnapshot = {
    status: "trialing",
    automationPaused: false,
    statusBeforePause: null,
    stripeStatus: "trialing",
    deletionPending: false,
    kind: "trialing",
    startsAt: new Date(now.getTime() - 10000),
    endsAt: now,
  };
  assert.equal(
    billingAccess(snapshot, new Date(now.getTime() - 1)).allowed,
    true,
  );
  assert.equal(billingAccess(snapshot, now).reason, "trial_expired");
  const future = { ...snapshot, endsAt: new Date(now.getTime() + 1000) };
  assert.equal(
    billingAccess(
      {
        ...future,
        status: "paused",
        automationPaused: true,
        statusBeforePause: "trialing",
      },
      now,
    ).allowed,
    true,
  );
  assert.equal(
    billingAccess(
      { ...future, status: "paused", stripeStatus: "past_due" },
      now,
    ).reason,
    "payment_failed",
  );
  assert.equal(
    billingAccess({ ...future, status: "active" }, now).allowed,
    false,
  );
  assert.equal(
    billingAccess({ ...future, deletionPending: true }, now).allowed,
    false,
  );
  assert.equal(billingAccess(null, now).allowed, false);
});

// Isolated PostgreSQL WASM; no live DB, Polar request, AI call or email.
test(
  "billing lifecycle, recovery and durable owner notifications",
  { timeout: 120000 },
  async (t) => {
    const db = await createTestPGlite();
    const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 0 });
    let prisma: PrismaClient | undefined;
    const config = {
      from: "Test <billing@example.test>",
      origin: "https://app.example.test",
    };
    try {
      for (const folder of (await readdir("prisma/migrations"))
        .filter((f) => /^\d/.test(f))
        .sort())
        await db.exec(
          await readFile(`prisma/migrations/${folder}/migration.sql`, "utf8"),
        );
      await server.start();
      prisma = new PrismaClient({
        transactionOptions: { maxWait: 15000, timeout: 20000 },
        adapter: new PrismaPg({
          connectionString: `postgresql://postgres:postgres@${server.getServerConn()}/postgres`,
          max: 1,
        }),
      });
      const client = prisma;
      async function fixture(expired = true) {
        // Keep unrelated fixtures out of the worker queue.
        await client.project.updateMany({
          data: { billingNextCheckAt: new Date("2099-01-01") },
        });
        await client.billingEmail.updateMany({
          where: { state: { in: ["PENDING", "SENDING"] } },
          data: { state: "CANCELLED" },
        });
        const owner = await client.user.create({
          data: {
            id: crypto.randomUUID(),
            name: "Owner",
            email: `${crypto.randomUUID()}@example.test`,
            emailVerified: true,
          },
        });
        const project = await client.project.create({
          data: {
            name: "Essai <test>",
            numero: "24100000000",
            instanceName: crypto.randomUUID(),
            status: "trialing",
            stripeStatus: "trialing",
            instanceStatus: "connected",
            agentSetupCompletedAt: new Date(),
            agentSystemMessage:
              "Accueillir les prospects de notre entreprise et les orienter vers un conseiller.",
            billingNextCheckAt: new Date(0),
            members: { create: { userId: owner.id, role: "OWNER" } },
          },
        });
        const period = await client.quotaPeriod.create({
          data: {
            projectId: project.id,
            kind: "trialing",
            key: `trial:${project.id}`,
            startsAt: new Date(Date.now() - 10 * 86400000),
            endsAt: new Date(Date.now() + (expired ? -1000 : 2 * 86400000)),
            limit: 150,
          },
        });
        return { project, owner, period };
      }
      const cycleStart = Math.floor(Date.now() / 1000);
      function subscription(
        projectId: string,
        status = "active",
      ): PolarSubscription {
        return {
          id: `sub_${projectId}`,
          status,
          customer_id: `cus_${projectId}`,
          product_id: "prod_billing_test",
          amount: 1599,
          currency: "usd",
          recurring_interval: "month",
          current_period_start: new Date(cycleStart * 1000).toISOString(),
          current_period_end: new Date(
            (cycleStart + 2592000) * 1000,
          ).toISOString(),
          trial_start: null,
          trial_end: null,
          cancel_at_period_end: false,
          metadata: { projectId },
        };
      }
      process.env.POLAR_STARTER_PRODUCT_ID = "prod_billing_test";
      process.env.MESSAGE_LIMIT_STARTER = "4000";

      await t.test(
        "an unknown product cannot trigger stale expiry emails; once configured, access is restored",
        async () => {
          const { project } = await fixture();
          const sub = subscription(project.id);
          await client.project.update({
            where: { id: project.id },
            data: { stripeSubscriptionId: sub.id },
          });
          process.env.POLAR_STARTER_PRODUCT_ID = "prod_other";
          try {
            await reconcileNextBillingProject(client, config, async () => sub);
            assert.equal(
              await client.billingEmail.count({
                where: { projectId: project.id },
              }),
              0,
            );
          } finally {
            process.env.POLAR_STARTER_PRODUCT_ID = "prod_billing_test";
          }
          await client.project.update({
            where: { id: project.id },
            data: { billingNextCheckAt: new Date(0) },
          });
          await reconcileNextBillingProject(client, config, async () => sub);
          assert.equal(
            (await getBillingAccess(client, project.id)).allowed,
            true,
          );
          assert.equal(
            await client.billingEmail.count({
              where: { projectId: project.id },
            }),
            0,
          );
        },
      );

      await t.test(
        "expired trials block manual, automatic and auxiliary AI access without a webhook",
        async () => {
          const { project } = await fixture();
          // Offre avec Instinct IA : seul l’essai expiré doit bloquer l’analyse.
          await client.project.update({ where: { id: project.id }, data: { plan: "pro" } });
          assert.equal(
            (await getBillingAccess(client, project.id)).reason,
            "trial_expired",
          );
          await assert.rejects(
            client.$transaction((tx) => reserveMessageQuota(tx, project.id)),
            { code: "PERIOD_UNAVAILABLE" },
          );
          await client.$transaction((tx) =>
            ingestMessage(tx, project.id, {
              key: {
                id: "expired-inbound",
                remoteJid: "24100000001@s.whatsapp.net",
                fromMe: false,
              },
              message: { conversation: "Bonjour" },
            }),
          );
          assert.equal(await claimAiJob(client), null);
          assert.equal(
            await runInstinctCycle(client, async () => {
              throw Error("Unexpected paid generation");
            }),
            null,
          );
        },
      );

      await t.test(
        "expiry is deduplicated and only owners receive an email",
        async () => {
          const { project, owner } = await fixture();
          const admin = await client.user.create({
            data: {
              id: crypto.randomUUID(),
              name: "Admin",
              email: "admin@example.test",
              emailVerified: true,
            },
          });
          await client.projectMembership.create({
            data: { projectId: project.id, userId: admin.id, role: "ADMIN" },
          });
          // PGlite exposes a single connection: replay duplicate events serially.
          await queueBillingEmails(client, project.id, config);
          await queueBillingEmails(client, project.id, config);
          assert.equal(
            await client.billingEmail.count({
              where: { projectId: project.id },
            }),
            1,
          );
          let calls = 0;
          await deliverNextBillingEmail(client, async (email) => {
            calls++;
            assert.equal(email.recipient, owner.email);
            assert.equal(email.kind, "access_ended");
            assert.match(email.text, /UTC/);
            assert.match(email.html ?? "", /Essai &lt;test&gt;/);
            assert.match(email.html ?? "", /Consulter la facturation/);
            assert.match(email.text, /https:\/\/app.example.test\/projects\//);
            return "sent_expiry";
          });
          await queueBillingEmails(client, project.id, config);
          await deliverNextBillingEmail(client, async () => {
            calls++;
            return "duplicate";
          });
          assert.equal(calls, 1);
        },
      );

      await t.test(
        "reminder before trial end is replaced by expiry, never delivered late",
        async () => {
          const { project, period } = await fixture(false);
          await queueBillingEmails(client, project.id, config);
          const reminder = await client.billingEmail.findFirstOrThrow({
            where: { projectId: project.id },
          });
          assert.equal(reminder.kind, "trial_ending");
          await client.quotaPeriod.update({
            where: { id: period.id },
            data: { endsAt: new Date(Date.now() - 1000) },
          });
          await deliverNextBillingEmail(client, async () => {
            throw Error("Late reminder");
          });
          assert.equal(
            (
              await client.billingEmail.findUniqueOrThrow({
                where: { id: reminder.id },
              })
            ).state,
            "CANCELLED",
          );
          await queueBillingEmails(client, project.id, config);
          assert.equal(
            await client.billingEmail.count({
              where: {
                projectId: project.id,
                kind: "access_ended",
                state: "PENDING",
              },
            }),
            1,
          );
        },
      );

      await t.test(
        "an incomplete first payment keeps access closed; confirmed payment restores once and cancels expiry",
        async () => {
          const { project } = await fixture();
          await syncPolarSubscription(
            client,
            subscription(project.id, "incomplete"),
            10,
          );
          assert.equal(
            (await getBillingAccess(client, project.id)).allowed,
            false,
          );
          await queueBillingEmails(client, project.id, config);
          const paid = subscription(project.id);
          await syncPolarSubscription(client, paid, 11);
          await client.$transaction((tx) =>
            reserveMessageQuota(tx, project.id),
          );
          await syncPolarSubscription(client, paid, 11);
          assert.equal(
            (await getBillingAccess(client, project.id)).allowed,
            true,
          );
          const quota = await client.quotaPeriod.findFirstOrThrow({
            where: { projectId: project.id, isCurrent: true },
          });
          assert.equal(quota.used, 1);
          assert.equal(quota.limit, 4000);
          await deliverNextBillingEmail(client, async () => {
            throw Error("Obsolete expiry");
          });
          assert.equal(
            (
              await client.billingEmail.findFirstOrThrow({
                where: { projectId: project.id },
              })
            ).state,
            "CANCELLED",
          );
        },
      );

      await t.test(
        "a new subscription replaces only an ended one",
        async () => {
          const { project } = await fixture();
          const now = Math.floor(Date.now() / 1000);
          const state = (id: string) => ({
            id,
            customerId: "polar-customer",
            providerStatus: "active",
            status: "active" as const,
            plan: "starter" as const,
            priceId: "polar-product",
            metadataProjectId: project.id,
            startsAt: now,
            endsAt: now + 2592000,
            cycle: { start: now, end: now + 2592000 },
            paidCycle: true,
          });
          await client.project.update({
            where: { id: project.id },
            data: {
              stripeSubscriptionId: `old_${project.id}`,
              stripeStatus: "active",
            },
          });
          await applySubscriptionState(client, state(`new_${project.id}`), 50);
          assert.equal(
            (await client.project.findUniqueOrThrow({ where: { id: project.id } }))
              .stripeSubscriptionId,
            `old_${project.id}`,
          );
          await client.project.update({
            where: { id: project.id },
            data: { stripeStatus: "canceled" },
          });
          await applySubscriptionState(client, state(`new_${project.id}`), 51);
          assert.equal(
            (await client.project.findUniqueOrThrow({ where: { id: project.id } }))
              .stripeSubscriptionId,
            `new_${project.id}`,
          );
        },
      );

      await t.test(
        "a paid renewal opens a fresh quota for the new cycle",
        async () => {
          const { project, period } = await fixture();
          const sub = subscription(project.id);
          // Cycle payé précédent, qui vient de se terminer au début du nouveau cycle.
          await client.project.update({
            where: { id: project.id },
            data: {
              status: "active",
              stripeStatus: "active",
              stripeSubscriptionId: sub.id,
            },
          });
          await client.quotaPeriod.update({
            where: { id: period.id },
            data: {
              kind: "active",
              key: `cycle:${sub.id}:${cycleStart - 2592000}`,
              startsAt: new Date((cycleStart - 2592000) * 1000),
              endsAt: new Date(cycleStart * 1000 - 1000),
              limit: 4000,
              used: 12,
            },
          });
          assert.equal(
            (await getBillingAccess(client, project.id)).allowed,
            false,
          );
          await syncPolarSubscription(client, sub, 20);
          const renewed = await client.quotaPeriod.findFirstOrThrow({
            where: { projectId: project.id, isCurrent: true },
          });
          assert.equal(renewed.key, `cycle:${sub.id}:${cycleStart}`);
          assert.equal(renewed.used, 0);
          assert.equal(renewed.limit, 4000);
          assert.equal(
            (await getBillingAccess(client, project.id)).allowed,
            true,
          );
        },
      );

      await t.test(
        "a failed renewal payment closes access immediately",
        async () => {
          const { project } = await fixture();
          await syncPolarSubscription(client, subscription(project.id), 30);
          assert.equal(
            (await getBillingAccess(client, project.id)).allowed,
            true,
          );
          await syncPolarSubscription(
            client,
            subscription(project.id, "past_due"),
            31,
          );
          const access = await getBillingAccess(client, project.id);
          assert.equal(access.allowed, false);
          assert.equal(access.reason, "payment_failed");
        },
      );

      await t.test(
        "retry uses identical message identity and payload; uncertain sends stop before provider dedup expires",
        async () => {
          const { project } = await fixture();
          await queueBillingEmails(client, project.id, config);
          let previous = "";
          await deliverNextBillingEmail(client, async (email) => {
            previous = JSON.stringify([
              email.id,
              email.recipient,
              email.subject,
              email.text,
              email.html,
              email.from,
            ]);
            throw Error("Provider response lost");
          });
          await client.billingEmail.updateMany({
            where: { projectId: project.id },
            data: { availableAt: new Date(0) },
          });
          await deliverNextBillingEmail(client, async (email) => {
            assert.equal(
              JSON.stringify([
                email.id,
                email.recipient,
                email.subject,
                email.text,
                email.html,
                email.from,
              ]),
              previous,
            );
            return "same_provider_id";
          });
          assert.equal(
            (
              await client.billingEmail.findFirstOrThrow({
                where: { projectId: project.id },
              })
            ).state,
            "SENT",
          );
          const next = await fixture();
          await queueBillingEmails(client, next.project.id, config);
          await client.billingEmail.updateMany({
            where: { projectId: next.project.id },
            data: {
              state: "SENDING",
              leaseUntil: new Date(0),
              firstAttemptAt: new Date(Date.now() - 24 * 3600000),
            },
          });
          await deliverNextBillingEmail(client, async () => {
            throw Error("Unsafe late retry");
          });
          assert.equal(
            (
              await client.billingEmail.findFirstOrThrow({
                where: { projectId: next.project.id },
              })
            ).state,
            "REVIEW_REQUIRED",
          );
        },
      );

      await t.test(
        "owner revoked before delivery cannot receive the notification",
        async () => {
          const { project, owner } = await fixture();
          await queueBillingEmails(client, project.id, config);
          await client.projectMembership.update({
            where: {
              userId_projectId: { userId: owner.id, projectId: project.id },
            },
            data: { role: "ADMIN" },
          });
          await deliverNextBillingEmail(client, async () => {
            throw Error("Former owner email");
          });
          assert.equal(
            (
              await client.billingEmail.findFirstOrThrow({
                where: { projectId: project.id },
              })
            ).state,
            "CANCELLED",
          );
        },
      );

      await t.test(
        "reconciliation recovers missing webhooks but cannot overwrite a newer webhook",
        async () => {
          const { project } = await fixture();
          const sub = subscription(project.id);
          await client.project.update({
            where: { id: project.id },
            data: { stripeSubscriptionId: sub.id },
          });
          await reconcileNextBillingProject(client, config, async () => sub);
          assert.equal(
            (await getBillingAccess(client, project.id)).allowed,
            true,
          );
          assert.equal(
            (
              await client.project.findUniqueOrThrow({
                where: { id: project.id },
              })
            ).billingEventCreated,
            0,
          );
          await client.project.update({
            where: { id: project.id },
            data: { billingNextCheckAt: new Date(0) },
          });
          await reconcileNextBillingProject(client, config, async () => {
            await syncPolarSubscription(
              client,
              subscription(project.id, "past_due"),
              20,
            );
            return sub; // Stale retrieval from before the webhook.
          });
          assert.equal(
            (await getBillingAccess(client, project.id)).reason,
            "payment_failed",
          );
          assert.equal(
            (
              await client.project.findUniqueOrThrow({
                where: { id: project.id },
              })
            ).billingEventCreated,
            20,
          );
        },
      );

      await t.test(
        "Polar outage cannot prevent expiry notifications",
        async () => {
          const { project } = await fixture();
          await client.project.update({
            where: { id: project.id },
            data: { stripeSubscriptionId: `sub_${project.id}` },
          });
          await reconcileNextBillingProject(client, config, async () => {
            throw Error("Polar offline");
          });
          assert.equal(
            (await getBillingAccess(client, project.id)).allowed,
            false,
          );
          assert.equal(
            await client.billingEmail.count({
              where: { projectId: project.id, state: "PENDING" },
            }),
            1,
          );
        },
      );

      await t.test(
        "a reply queued before expiration is cancelled before dispatch",
        async () => {
          const { project, period } = await fixture(false);
          await client.$transaction((tx) =>
            ingestMessage(tx, project.id, {
              key: {
                id: "queued-inbound",
                remoteJid: "24100000002@s.whatsapp.net",
                fromMe: false,
              },
              message: { conversation: "Bonjour" },
            }),
          );
          const job = await claimAiJob(client);
          assert.ok(job);
          await runAiJob(client, job, async () => "Bonjour !");
          await client.quotaPeriod.update({
            where: { id: period.id },
            data: { endsAt: new Date(Date.now() - 1000) },
          });
          const processor = createOutboundProcessor(client, async () => {});
          assert.equal((await processor.claimNextJob())?.cancelled, true);
          assert.equal(
            (
              await client.outboundJob.findFirstOrThrow({
                where: { projectId: project.id },
              })
            ).state,
            "CANCELLED",
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
