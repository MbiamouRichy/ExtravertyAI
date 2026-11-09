import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { createTestPGlite } from "./helpers/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import {
  TRIAL_RESERVATION_MS,
  consumeTrial,
  hashTrialNumber,
  isTrialAvailable,
  reserveTrial,
} from "../lib/trial-eligibility";
import { applySubscriptionState } from "../lib/billing-quota";
import { isForeignTrialNumber, ownerNumberOf } from "../lib/instance-connection";

process.env.BETTER_AUTH_SECRET ??= "trial-eligibility-test-secret";

test("l'empreinte ne dépend que des chiffres du numéro et ne le contient pas", () => {
  const hash = hashTrialNumber("+241 66 00 00 01");
  assert.equal(hash, hashTrialNumber("24166000001"));
  assert.notEqual(hash, hashTrialNumber("+24166000002"));
  assert.ok(!hash.includes("24166000001"));
  assert.throws(() => hashTrialNumber("12"), /TRIAL_NUMBER_INVALID/);
});

test("pendant l'essai, seul le numéro déclaré peut être relié à WhatsApp", () => {
  const project = { numero: "+24166000001", status: "trialing" };
  assert.equal(ownerNumberOf("24166000001:12@s.whatsapp.net"), "24166000001");
  assert.equal(ownerNumberOf("123456@lid"), null);
  assert.equal(isForeignTrialNumber(project, "24166000001@s.whatsapp.net"), false);
  assert.equal(isForeignTrialNumber(project, "24166000009@s.whatsapp.net"), true);
  // Numéro inconnu : rien n'est bloqué ; abonnement payé : libre.
  assert.equal(isForeignTrialNumber(project, null), false);
  assert.equal(
    isForeignTrialNumber({ ...project, status: "active" }, "24166000009@s.whatsapp.net"),
    false,
  );
});

// Base PostgreSQL WASM isolée : aucun appel à un fournisseur.
test("un seul essai par numéro, réservé pendant le paiement puis consommé", { timeout: 120000 }, async () => {
  const db = await createTestPGlite();
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
    const numero = "+24166000001";
    const project = (name: string) =>
      client.project.create({
        data: { name, numero, instanceName: crypto.randomUUID(), status: "inactive" },
      });
    const first = await project("Premier");
    const second = await project("Second");

    assert.equal(await isTrialAvailable(client, numero), true);
    assert.equal(await reserveTrial(client, numero, first.id), true);
    // Paiement avec essai en cours pour un autre projet : pas de second essai.
    assert.equal(await isTrialAvailable(client, numero, second.id), false);
    assert.equal(await reserveTrial(client, numero, second.id), false);
    // Le même projet peut reprendre son paiement.
    assert.equal(await isTrialAvailable(client, numero, first.id), true);
    assert.equal(await reserveTrial(client, numero, first.id), true);

    // Réservation expirée (paiement abandonné) : le numéro redevient libre.
    await client.trialClaim.update({
      where: { numberHash: hashTrialNumber(numero) },
      data: { reservedUntil: new Date(Date.now() - 1000) },
    });
    assert.equal(await reserveTrial(client, numero, second.id), true);
    const claim = await client.trialClaim.findUniqueOrThrow({
      where: { numberHash: hashTrialNumber(numero) },
    });
    assert.equal(claim.projectId, second.id);
    assert.ok(claim.reservedUntil!.getTime() > Date.now() + TRIAL_RESERVATION_MS - 60000);

    // L'abonnement entre en essai : le numéro est consommé, même après suppression.
    const now = Math.floor(Date.now() / 1000);
    await applySubscriptionState(
      client,
      {
        id: "sub_trial",
        customerId: "cus_1",
        providerStatus: "trialing",
        status: "trialing",
        plan: "starter",
        priceId: "prod_starter",
        metadataProjectId: second.id,
        startsAt: now,
        endsAt: now + 10 * 86400,
        cycle: { start: now, end: now + 10 * 86400 },
        paidCycle: false,
      },
      1,
    );
    const consumed = await client.trialClaim.findUniqueOrThrow({
      where: { numberHash: hashTrialNumber(numero) },
    });
    assert.equal(consumed.subscriptionId, "sub_trial");
    assert.ok(consumed.consumedAt);
    assert.equal(consumed.reservedUntil, null);

    await client.project.delete({ where: { id: second.id } });
    assert.equal(await isTrialAvailable(client, numero), false);
    assert.equal(await reserveTrial(client, numero, first.id), false);
    assert.equal(await isTrialAvailable(client, "+24166000002"), true);

    // Rejouer l'événement ne change rien ; un autre abonnement ne reprend pas l'essai.
    await consumeTrial(client, { numero, projectId: first.id, subscriptionId: "sub_trial" });
    await consumeTrial(client, { numero, projectId: first.id, subscriptionId: "sub_other" });
    assert.equal(
      (await client.trialClaim.findUniqueOrThrow({ where: { numberHash: hashTrialNumber(numero) } }))
        .subscriptionId,
      "sub_trial",
    );
  } finally {
    await prisma?.$disconnect();
    await server.stop();
    await db.close();
  }
});
