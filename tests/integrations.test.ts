import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

process.env.INTEGRATIONS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.BETTER_AUTH_SECRET = "test-secret-for-state-signing";

import { emitIntegrationEvent } from "../lib/integration-events";
import {
  DISABLE_AFTER_FAILURES,
  MAX_DELIVERY_ATTEMPTS,
  MAX_ENDPOINTS,
  claimDelivery,
  createWebhook,
  redeliver,
  runDelivery,
  sendTestEvent,
  signPayload,
  verifySignature,
  type DeliveryTransport,
} from "../lib/integrations";
import { connectGoogleSheets, sheetRow, signState, verifyState } from "../lib/google-sheets";
import { PlanFeatureError } from "../lib/plan-features";
import { assignConversation, setConversationResolved } from "../lib/conversation-workflow";
import { movePipelineStage } from "../lib/pipeline";
import { SafeFetchError } from "../lib/safe-fetch";
import { addMember, createProject, createUser, ingestText, withTestDatabase } from "./helpers/database";

test("webhook signatures verify and reject tampering or replays", () => {
  const body = JSON.stringify({ event: "test.ping" });
  const header = signPayload("whsec_abc", body, 1_000_000);
  assert.match(header, /^t=1000000,v1=[0-9a-f]{64}$/);
  assert.equal(verifySignature("whsec_abc", body, header, 300, 1_000_100), true);
  assert.equal(verifySignature("whsec_abc", body + " ", header, 300, 1_000_100), false);
  assert.equal(verifySignature("whsec_other", body, header, 300, 1_000_100), false);
  assert.equal(verifySignature("whsec_abc", body, header, 300, 1_000_400), false);
  assert.equal(verifySignature("whsec_abc", body, "garbage", 300, 1_000_100), false);
});

test("OAuth state is signed, bound and short-lived", () => {
  const state = signState({ projectId: "p", userId: "u", nonce: "n" }, 1_000);
  assert.deepEqual(verifyState(state, 2_000), { projectId: "p", userId: "u", nonce: "n", expiresAt: 601_000 });
  assert.equal(verifyState(state, 700_000), null);
  const [body, mac] = state.split(".");
  const forged = Buffer.from(JSON.stringify({ projectId: "x", userId: "u", nonce: "n", expiresAt: 9e15 })).toString("base64url");
  assert.equal(verifyState(`${forged}.${mac}`, 2_000), null);
  assert.equal(verifyState(`${body}.`, 2_000), null);
});

test("spreadsheet rows are plain readable values", () => {
  assert.deepEqual(
    sheetRow({
      event: "pipeline.stage_changed",
      payload: {
        occurredAt: "2026-10-19T14:05:00.000Z",
        data: {
          contact: { name: "=HYPERLINK(\"x\")", phone: "24101000001" },
          fromLabel: "Devis envoyé",
          toLabel: "Gagné",
          dealValue: 45000,
          dealValueLabel: "45 000 FCFA",
        },
      },
    }),
    ["2026-10-19 14:05:00", "Étape du pipeline modifiée", "=HYPERLINK(\"x\")", "24101000001", "Devis envoyé → Gagné · 45 000 FCFA"],
  );
});

test("integrations", { timeout: 180000 }, async (t) => {
  await withTestDatabase(async (prisma) => {
    const owner = await createUser(prisma, "Clara Mba");
    const member = await createUser(prisma);
    const project = await createProject(prisma, { plan: "business" });
    await addMember(prisma, project.id, owner.id, "OWNER");
    await addMember(prisma, project.id, member.id, "USER");
    const admin = { projectId: project.id, userId: owner.id };

    await t.test("only Pro and Business admins create webhooks, to public URLs", async () => {
      const starter = await createProject(prisma, { plan: "starter" });
      await addMember(prisma, starter.id, owner.id, "OWNER");
      await assert.rejects(
        createWebhook(prisma, { projectId: starter.id, userId: owner.id, name: "Make", url: "https://hook.example.com/a", events: ["contact.qualified"] }),
        PlanFeatureError,
      );
      const pro = await createProject(prisma, { plan: "pro" });
      await addMember(prisma, pro.id, owner.id, "OWNER");
      const allowed = await createWebhook(prisma, { projectId: pro.id, userId: owner.id, name: "Make", url: "https://hook.example.com/a", events: ["contact.qualified"] });
      assert.match(allowed.secret, /^whsec_/);
      await assert.rejects(
        createWebhook(prisma, { projectId: project.id, userId: member.id, name: "Make", url: "https://hook.example.com/a", events: ["contact.qualified"] }),
        /droits/,
      );
      await assert.rejects(
        createWebhook(prisma, { ...admin, name: "Interne", url: "https://169.254.169.254/latest", events: ["contact.qualified"] }),
        /pas accessible publiquement/,
      );
    });

    const created = await createWebhook(prisma, {
      ...admin,
      name: "Make",
      url: "https://hook.example.com/a",
      events: ["pipeline.stage_changed"],
    });

    await t.test("the secret is shown once and stored encrypted", async () => {
      assert.match(created.secret, /^whsec_/);
      const stored = await prisma.integrationEndpoint.findUniqueOrThrow({ where: { id: created.id } });
      assert.ok(stored.secretCiphertext);
      assert.doesNotMatch(stored.secretCiphertext, new RegExp(created.secret));
    });

    await t.test("events reach subscribed, enabled endpoints of Pro and Business projects only", async () => {
      const contact = await ingestText(prisma, project.id, "Bonjour");
      const queued = await prisma.$transaction((tx) =>
        emitIntegrationEvent(tx, project.id, "pipeline.stage_changed", { contact: { id: contact.id } }),
      );
      assert.equal(queued, 1);
      assert.equal(
        await prisma.$transaction((tx) => emitIntegrationEvent(tx, project.id, "csat.received", {})),
        0,
      );
      const starter = await createProject(prisma, { plan: "starter" });
      await prisma.integrationEndpoint.create({
        data: { projectId: starter.id, kind: "WEBHOOK", name: "x", url: "https://x.example.com", events: ["csat.received"] },
      });
      assert.equal(
        await prisma.$transaction((tx) => emitIntegrationEvent(tx, starter.id, "csat.received", {})),
        0,
      );
    });

    await t.test("a delivery is signed and marked delivered", async () => {
      const job = await claimDelivery(prisma);
      assert.ok(job);
      let captured: { body?: string; signature?: string } = {};
      const transport: DeliveryTransport = {
        webhook: async (_url, init) => {
          captured = { body: init.body, signature: init.headers?.["x-extraverty-signature"] };
          return { status: 204 };
        },
        sheets: async () => ({ status: 200 }),
      };
      await runDelivery(prisma, job, transport);
      assert.ok(captured.body && captured.signature);
      assert.equal(verifySignature(created.secret, captured.body, captured.signature), true);
      assert.equal(JSON.parse(captured.body).event, "pipeline.stage_changed");
      const delivery = await prisma.integrationDelivery.findUniqueOrThrow({ where: { id: job.id } });
      assert.equal(delivery.state, "DELIVERED");
      assert.equal(delivery.lastStatus, 204);
    });

    await t.test("failures retry with backoff, then fail and disable the endpoint", async () => {
      await sendTestEvent(prisma, { ...admin, endpointId: created.id });
      const failing: DeliveryTransport = {
        webhook: async () => ({ status: 500 }),
        sheets: async () => ({ status: 200 }),
      };
      let job = await claimDelivery(prisma);
      assert.ok(job);
      await runDelivery(prisma, job, failing);
      let delivery = await prisma.integrationDelivery.findUniqueOrThrow({ where: { id: job.id } });
      assert.equal(delivery.state, "QUEUED");
      assert.equal(delivery.lastError, "Réponse HTTP 500.");
      assert.ok(delivery.availableAt.getTime() > Date.now());

      // Fast-forward through the remaining attempts.
      for (let attempt = 2; attempt <= MAX_DELIVERY_ATTEMPTS; attempt++) {
        await prisma.integrationDelivery.update({ where: { id: delivery.id }, data: { availableAt: new Date(0) } });
        job = await claimDelivery(prisma);
        assert.ok(job);
        await runDelivery(prisma, job, failing);
      }
      delivery = await prisma.integrationDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
      assert.equal(delivery.state, "FAILED");
      assert.equal(delivery.attempts, MAX_DELIVERY_ATTEMPTS);

      await redeliver(prisma, { ...admin, deliveryId: delivery.id });
      assert.equal((await prisma.integrationDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).state, "QUEUED");

      // A blocked address is a permanent failure.
      await prisma.integrationDelivery.update({ where: { id: delivery.id }, data: { availableAt: new Date(0) } });
      job = await claimDelivery(prisma);
      assert.ok(job);
      await runDelivery(prisma, job, {
        webhook: async () => {
          throw new SafeFetchError("BLOCKED_ADDRESS");
        },
        sheets: async () => ({ status: 200 }),
      });
      assert.equal((await prisma.integrationDelivery.findUniqueOrThrow({ where: { id: delivery.id } })).state, "FAILED");

      await prisma.integrationEndpoint.update({
        where: { id: created.id },
        data: { consecutiveFailures: DISABLE_AFTER_FAILURES - 1 },
      });
      await sendTestEvent(prisma, { ...admin, endpointId: created.id });
      job = await claimDelivery(prisma);
      assert.ok(job);
      await runDelivery(prisma, job, failing);
      const endpoint = await prisma.integrationEndpoint.findUniqueOrThrow({ where: { id: created.id } });
      assert.equal(endpoint.enabled, false);
      assert.match(endpoint.disabledReason ?? "", /échecs consécutifs/);
      // Deliveries of a disabled endpoint are no longer claimed.
      assert.equal(await claimDelivery(prisma), null);
    });

    await t.test("Google Sheets connects and is disabled when access is revoked", async () => {
      const connected = await connectGoogleSheets(
        prisma,
        { ...admin, code: "code" },
        {
          exchangeCode: async () => ({ refreshToken: "1//refresh", accessToken: "ya29", email: "clara@example.test" }),
          createSpreadsheet: async () => ({
            spreadsheetId: "sheet-1",
            spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet-1",
            sheetName: "Événements",
          }),
        },
      );
      const endpoint = await prisma.integrationEndpoint.findUniqueOrThrow({ where: { id: connected.id } });
      assert.equal(endpoint.kind, "GOOGLE_SHEETS");
      assert.doesNotMatch(endpoint.refreshTokenCiphertext ?? "", /refresh/);
      assert.ok(endpoint.events.includes("csat.received"));

      await prisma.$transaction((tx) => emitIntegrationEvent(tx, project.id, "csat.received", { score: 5 }));
      const job = await claimDelivery(prisma);
      assert.ok(job);
      await runDelivery(prisma, job, { webhook: async () => ({ status: 200 }), sheets: async () => ({ status: 401 }) });
      const revoked = await prisma.integrationEndpoint.findUniqueOrThrow({ where: { id: connected.id } });
      assert.equal(revoked.enabled, false);
      assert.match(revoked.disabledReason ?? "", /Reconnectez Google Sheets/);
      assert.equal((await prisma.integrationDelivery.findUniqueOrThrow({ where: { id: job.id } })).state, "FAILED");
    });

    await t.test("real actions emit their events in the same transaction", async () => {
      const listener = await createWebhook(prisma, {
        ...admin,
        name: "Tout",
        url: "https://hook.example.com/all",
        events: ["conversation.assigned", "conversation.resolved", "pipeline.stage_changed"],
      });
      const contact = await ingestText(prisma, project.id, "Je veux commander", "24155555555@s.whatsapp.net");
      const actor = { projectId: project.id, contactId: contact.id, userId: owner.id };
      await assignConversation(prisma, { ...actor, assigneeId: member.id });
      await movePipelineStage(prisma, { ...actor, stage: "QUOTE_SENT" });
      const latest = await prisma.message.findFirstOrThrow({ where: { contactId: contact.id } });
      await setConversationResolved(prisma, { ...actor, resolved: true, seenMessageId: latest.id });
      const deliveries = await prisma.integrationDelivery.findMany({
        where: { endpointId: listener.id },
        orderBy: { createdAt: "asc" },
      });
      assert.deepEqual(
        deliveries.map((delivery) => delivery.event),
        ["conversation.assigned", "pipeline.stage_changed", "conversation.resolved"],
      );
      const stage = deliveries[1].payload as { data: { from: string; to: string; contact: { phone: string } } };
      assert.equal(stage.data.from, "NEW");
      assert.equal(stage.data.to, "QUOTE_SENT");
      assert.equal(stage.data.contact.phone, "24155555555");
      await prisma.integrationEndpoint.delete({ where: { id: listener.id } });
    });

    await t.test(`a project holds at most ${MAX_ENDPOINTS} integrations`, async () => {
      for (let index = await prisma.integrationEndpoint.count({ where: { projectId: project.id } }); index < MAX_ENDPOINTS; index++) {
        await createWebhook(prisma, { ...admin, name: `W${index}`, url: `https://hook.example.com/${index}`, events: ["contact.qualified"] });
      }
      await assert.rejects(
        createWebhook(prisma, { ...admin, name: "Trop", url: "https://hook.example.com/x", events: ["contact.qualified"] }),
        /au maximum/,
      );
    });
  });
});
