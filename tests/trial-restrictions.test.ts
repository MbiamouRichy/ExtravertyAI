import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { ingestMessage } from "../lib/evolution-ingestion";
import { claimAiJob, runAiJob } from "../lib/ai-jobs";
import { createOutboundProcessor } from "../lib/outbound-jobs";
import {
  isTrialRestricted,
  trialAllowsJid,
  trialContactWhere,
} from "../lib/trial-restrictions";

const trial = {
  status: "trialing",
  automationPaused: false,
  statusBeforePause: null,
  trialTestNumber: "24166000001",
  trialTestJid: "123456789@lid",
};

test("l'essai limite les échanges au numéro de test, par numéro ou par @lid", () => {
  assert.equal(isTrialRestricted(trial), true);
  assert.equal(trialAllowsJid(trial, "24166000001@s.whatsapp.net"), true);
  assert.equal(trialAllowsJid(trial, "123456789@lid"), true);
  assert.equal(trialAllowsJid(trial, "24166000002@s.whatsapp.net"), false);
  assert.equal(trialAllowsJid({ ...trial, trialTestNumber: null, trialTestJid: null }, "x@lid"), false);
  assert.deepEqual(trialContactWhere(trial), {
    remoteJid: { in: ["24166000001@s.whatsapp.net", "123456789@lid"] },
  });
});

test("un projet payant ou en pause depuis un abonnement payé n'est pas limité", () => {
  assert.equal(trialAllowsJid({ ...trial, status: "active" }, "autre@s.whatsapp.net"), true);
  assert.deepEqual(trialContactWhere({ ...trial, status: "active" }), {});
  const paused = { ...trial, status: "paused", automationPaused: true };
  assert.equal(isTrialRestricted({ ...paused, statusBeforePause: "trialing" }), true);
  assert.equal(isTrialRestricted({ ...paused, statusBeforePause: "active" }), false);
});

// Base PostgreSQL WASM isolée : aucun appel à un fournisseur.
test("pendant l'essai, seuls les messages du numéro de test sont reçus et envoyés", { timeout: 120000 }, async () => {
  const db = await PGlite.create();
  const server = new PGLiteSocketServer({ db, host: "127.0.0.1", port: 0 });
  let prisma: PrismaClient | undefined;
  try {
    for (const folder of (await readdir("prisma/migrations")).filter((f) => /^\d/.test(f)).sort())
      await db.exec(await readFile(`prisma/migrations/${folder}/migration.sql`, "utf8"));
    await server.start();
    prisma = new PrismaClient({
      adapter: new PrismaPg({
        connectionString: `postgresql://postgres:postgres@${server.getServerConn()}/postgres`,
        max: 1,
      }),
    });
    const client = prisma;
    const project = await client.project.create({
      data: {
        agentSetupCompletedAt: new Date(),
        agentSystemMessage: "Accueille les prospects de notre entreprise et propose un conseiller.",
        name: "Essai",
        numero: "24100000000",
        instanceName: crypto.randomUUID(),
        status: "trialing",
        instanceStatus: "connected",
      },
    });
    await client.quotaPeriod.create({
      data: {
        projectId: project.id,
        key: "trial",
        kind: "trialing",
        startsAt: new Date(Date.now() - 60000),
        endsAt: new Date(Date.now() + 86400000),
        limit: 150,
      },
    });
    const incoming = (id: string, key: Record<string, string>) =>
      client.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM project WHERE id = ${project.id} FOR UPDATE`;
        await ingestMessage(tx, project.id, {
          key: { id, fromMe: false, ...key },
          message: { conversation: "Bonjour" },
        });
      });

    // Aucun numéro enregistré : personne n'est reçu.
    await incoming("stranger", { remoteJid: "24166000002@s.whatsapp.net" });
    assert.equal(await client.contact.count({ where: { projectId: project.id } }), 0);

    await client.project.update({
      where: { id: project.id },
      data: { trialTestNumber: "24166000001" },
    });
    await incoming("stranger-again", { remoteJid: "24166000002@s.whatsapp.net" });
    await incoming("tester", { remoteJid: "24166000001@s.whatsapp.net" });
    assert.deepEqual(
      (await client.contact.findMany({ where: { projectId: project.id } })).map((c) => c.remoteJid),
      ["24166000001@s.whatsapp.net"],
    );
    assert.equal(await client.aiJob.count({ where: { projectId: project.id } }), 1);

    // Le même testeur écrit sous son @lid : il est reconnu par son numéro réel.
    await incoming("tester-lid", { remoteJid: "987654321@lid", remoteJidAlt: "24166000001@s.whatsapp.net" });
    assert.equal(
      (await client.project.findUniqueOrThrow({ where: { id: project.id } })).trialTestJid,
      "987654321@lid",
    );
    assert.equal(await client.contact.count({ where: { projectId: project.id } }), 2);

    // La réponse au testeur part ; elle est annulée si le numéro change avant l'envoi.
    const ai = await claimAiJob(client);
    assert.ok(ai);
    await runAiJob(client, ai, async () => "Bonjour, que puis-je faire pour vous ?");
    await client.project.update({
      where: { id: project.id },
      data: { trialTestNumber: "24166000003", trialTestJid: null },
    });
    const sender = createOutboundProcessor(client, async () => {});
    assert.equal((await sender.claimNextJob())?.cancelled, true);

    // Après le premier paiement, tout le monde est reçu.
    await client.project.update({ where: { id: project.id }, data: { status: "active" } });
    await incoming("customer", { remoteJid: "24166000004@s.whatsapp.net" });
    assert.equal(
      await client.contact.count({ where: { projectId: project.id, remoteJid: "24166000004@s.whatsapp.net" } }),
      1,
    );
  } finally {
    await prisma?.$disconnect();
    await server.stop();
    await db.close();
  }
});
