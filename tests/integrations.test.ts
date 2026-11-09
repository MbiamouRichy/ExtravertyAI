import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

process.env.INTEGRATIONS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
process.env.BETTER_AUTH_SECRET = "test-secret-for-state-signing";

import { MESSAGE_TEXT_MAX, defaultIntegrationEvents, emitIntegrationEvent } from "../lib/integration-events";
import { ingestMessage } from "../lib/evolution-ingestion";
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
import {
  connectGoogleSheets,
  headerUpdate,
  sheetHeader,
  sheetRow,
  signState,
  verifyState,
} from "../lib/google-sheets";
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
  const job = {
    event: "pipeline.stage_changed",
    payload: {
      occurredAt: "2026-10-19T14:05:00.000Z",
      data: {
        contact: {
          name: "=HYPERLINK(\"x\")",
          phone: "24101000001",
          firstInteractionAt: "2026-10-01T08:30:00.000Z",
          lastInteractionAt: "2026-10-19T13:59:00.000Z",
          instinct: "interesting",
          sources: ["android", "whatsapp"],
        },
        fromLabel: "Devis envoyé",
        toLabel: "Gagné",
        dealValue: 45000,
        dealValueLabel: "45 000 FCFA",
      },
    },
  };
  const common = [
    "2026-10-19 15:05",
    "Étape du pipeline modifiée",
    "=HYPERLINK(\"x\")",
    "24101000001",
    "2026-10-01 09:30",
    "2026-10-19 14:59",
    "Android, WhatsApp",
    "Devis envoyé → Gagné · 45 000 FCFA",
  ];
  // Instinct IA inclus : dernière colonne, alignée sur l’en-tête.
  assert.deepEqual(sheetRow(job, "Africa/Libreville", true), [...common, "Prospect intéressant"]);
  assert.equal(sheetHeader(true).at(-1), "Instinct IA");
  assert.equal(sheetHeader(true).length, sheetRow(job, "UTC", true).length);
  // Sans Instinct IA dans l’offre : aucune cellule, même si l’envoi en file en contenait une.
  assert.deepEqual(sheetRow(job, "Africa/Libreville"), common);
  assert.ok(!sheetHeader(false).includes("Instinct IA"));
  assert.equal(sheetHeader(false).length, sheetRow(job).length);
  // Une valeur inattendue n’est jamais recopiée dans la feuille.
  const odd = { ...job, payload: { ...job.payload, data: { ...job.payload.data, contact: { instinct: "=CMD()" } } } };
  assert.equal(sheetRow(odd, "UTC", true).at(-1), "");
});

test("our spreadsheet header follows the plan, never the customer's own header", () => {
  const previous = [
    "Date", "Événement", "Prospect", "Téléphone", "Première interaction",
    "Dernière interaction", "Instinct IA", "Sources des messages", "Détail",
  ];
  // Ancienne disposition vers Starter : une cellule de trop est vidée.
  assert.deepEqual(headerUpdate(previous, false), [...sheetHeader(false), ""]);
  assert.deepEqual(headerUpdate(previous, true), sheetHeader(true));
  // Changement d’offre dans les deux sens.
  assert.deepEqual(headerUpdate(sheetHeader(false), true), sheetHeader(true));
  assert.deepEqual(headerUpdate(sheetHeader(true), false), [...sheetHeader(false), ""]);
  assert.deepEqual(headerUpdate(["Date (UTC)", "Événement"], true), sheetHeader(true));
  // Déjà à jour, absent, ou écrit par le client : rien n’est réécrit.
  assert.equal(headerUpdate(sheetHeader(true), true), null);
  assert.equal(headerUpdate(sheetHeader(false), false), null);
  assert.equal(headerUpdate(undefined, true), null);
  assert.equal(headerUpdate(["Client", "Montant"], false), null);
});

test("the qualified prospect event exists only where Instinct IA runs", () => {
  const ids = (plan: string) => defaultIntegrationEvents(plan).map((event) => event.id);
  assert.ok(!ids("starter").includes("contact.qualified"));
  assert.ok(ids("pro").includes("contact.qualified"));
  assert.ok(ids("business").includes("contact.qualified"));
});

test("integrations", { timeout: 180000 }, async (t) => {
  await withTestDatabase(async (prisma) => {
    const owner = await createUser(prisma, "Clara Mba");
    const member = await createUser(prisma);
    const project = await createProject(prisma, { plan: "business" });
    await addMember(prisma, project.id, owner.id, "OWNER");
    await addMember(prisma, project.id, member.id, "AGENT");
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
      // Starter : Google Sheets reste servi, mais seulement pour les événements de l’offre.
      await prisma.integrationEndpoint.create({
        data: {
          projectId: starter.id,
          kind: "GOOGLE_SHEETS",
          name: "Feuille",
          events: ["csat.received", "conversation.resolved"],
        },
      });
      assert.equal(
        await prisma.$transaction((tx) => emitIntegrationEvent(tx, starter.id, "csat.received", {})),
        0,
      );
      assert.equal(
        await prisma.$transaction((tx) => emitIntegrationEvent(tx, starter.id, "conversation.resolved", {})),
        1,
      );
      // Ne pas laisser cet envoi à la file des tests suivants.
      await prisma.integrationEndpoint.deleteMany({ where: { projectId: starter.id } });
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

    await t.test("a worker with another encryption key says so and keeps retrying", async () => {
      await sendTestEvent(prisma, { ...admin, endpointId: created.id });
      const job = await claimDelivery(prisma);
      assert.ok(job);
      const appKey = process.env.INTEGRATIONS_ENCRYPTION_KEY;
      // Constaté en préproduction : « Erreur inattendue » sans code HTTP.
      process.env.INTEGRATIONS_ENCRYPTION_KEY = randomBytes(32).toString("base64");
      let sent = false;
      try {
        await runDelivery(prisma, job, {
          webhook: async () => {
            sent = true;
            return { status: 204 };
          },
          sheets: async () => ({ status: 200 }),
        });
      } finally {
        process.env.INTEGRATIONS_ENCRYPTION_KEY = appKey;
      }
      assert.equal(sent, false);
      const delivery = await prisma.integrationDelivery.findUniqueOrThrow({ where: { id: job.id } });
      assert.equal(delivery.state, "QUEUED");
      assert.match(delivery.lastError ?? "", /clé de chiffrement du serveur d’envoi diffère/);
      // Remise à zéro pour le test suivant.
      await prisma.integrationDelivery.delete({ where: { id: job.id } });
      await prisma.integrationEndpoint.update({ where: { id: created.id }, data: { consecutiveFailures: 0 } });
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
      const instinctColumn: boolean[] = [];
      const connected = await connectGoogleSheets(
        prisma,
        { ...admin, code: "code" },
        {
          exchangeCode: async () => ({ refreshToken: "1//refresh", accessToken: "ya29", email: "clara@example.test" }),
          createSpreadsheet: async (_token, _title, instinct) => {
            instinctColumn.push(instinct);
            return {
              spreadsheetId: "sheet-1",
              spreadsheetUrl: "https://docs.google.com/spreadsheets/d/sheet-1",
              sheetName: "Événements",
            };
          },
        },
      );
      const endpoint = await prisma.integrationEndpoint.findUniqueOrThrow({ where: { id: connected.id } });
      assert.equal(endpoint.kind, "GOOGLE_SHEETS");
      assert.doesNotMatch(endpoint.refreshTokenCiphertext ?? "", /refresh/);
      assert.ok(endpoint.events.includes("csat.received"));

      await prisma.$transaction((tx) => emitIntegrationEvent(tx, project.id, "csat.received", { score: 5 }));
      const job = await claimDelivery(prisma);
      assert.ok(job);
      await runDelivery(prisma, job, {
        webhook: async () => ({ status: 200 }),
        sheets: async (target) => {
          instinctColumn.push(target.instinct);
          return { status: 401 };
        },
      });
      // Projet Business : la colonne Instinct IA existe à la création et à chaque envoi.
      assert.deepEqual(instinctColumn, [true, true]);
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

    await t.test("a first message emits contact.created, then every client message emits message.received", async () => {
      const inbox = await createProject(prisma, { plan: "business" });
      await addMember(prisma, inbox.id, owner.id, "OWNER");
      const endpoint = await createWebhook(prisma, {
        projectId: inbox.id,
        userId: owner.id,
        name: "Boîte",
        url: "https://hook.example.com/inbox",
        events: ["contact.created", "message.received"],
      });
      const raw = {
        key: { id: "first", fromMe: false, remoteJid: "24107000000@s.whatsapp.net" },
        pushName: "Awa",
        message: { imageMessage: { caption: "x".repeat(MESSAGE_TEXT_MAX + 50), url: "https://mmg.whatsapp.net/secret" } },
      };
      const ingest = (message: unknown) =>
        prisma.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT id FROM project WHERE id = ${inbox.id} FOR UPDATE`;
          await ingestMessage(tx, inbox.id, message);
        });
      await ingest(raw);
      await ingest(raw); // Webhook rejoué : aucun doublon.
      await ingest({ ...raw, key: { ...raw.key, id: "second" }, message: { audioMessage: {} } });
      const deliveries = await prisma.integrationDelivery.findMany({
        where: { endpointId: endpoint.id },
        orderBy: { createdAt: "asc" },
      });
      assert.deepEqual(
        deliveries.map((delivery) => delivery.event).sort(),
        ["contact.created", "message.received", "message.received"],
      );
      const received = deliveries.filter((delivery) => delivery.event === "message.received");
      const data = received.map((delivery) => (delivery.payload as { data: { message: { text: string | null; type: string }; contact: { phone: string } } }).data);
      const image = data.find((item) => item.message.type === "IMAGE");
      assert.equal(image?.message.text?.length, MESSAGE_TEXT_MAX);
      assert.equal(image?.contact.phone, "24107000000");
      assert.equal(data.find((item) => item.message.type === "AUDIO")?.message.text, null);
      assert.doesNotMatch(JSON.stringify(deliveries.map((delivery) => delivery.payload)), /mmg\.whatsapp\.net/);

      // Le texte ne reste pas dans la file après livraison.
      let job;
      while ((job = await claimDelivery(prisma))) {
        await runDelivery(prisma, job, { webhook: async () => ({ status: 200 }) } as unknown as DeliveryTransport);
      }
      const delivered = await prisma.integrationDelivery.findUniqueOrThrow({ where: { id: received[0].id } });
      assert.equal(delivered.state, "DELIVERED");
      assert.deepEqual(delivered.payload, {});
      assert.ok(Object.keys((await prisma.integrationDelivery.findFirstOrThrow({ where: { endpointId: endpoint.id, event: "contact.created" } })).payload as object).length);
    });

    await t.test("message.received stays opt-in for connections subscribed by default", () => {
      const ids = defaultIntegrationEvents("business").map((event) => event.id as string);
      assert.ok(ids.includes("contact.created"));
      assert.ok(!ids.includes("message.received"));
    });
  });
});
