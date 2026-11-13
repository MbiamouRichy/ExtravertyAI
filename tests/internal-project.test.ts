import { test } from "node:test";
import assert from "node:assert/strict";
import { withTestDatabase, createProject } from "./helpers/database";
import { getBillingAccess } from "../lib/billing-access";
import { reconcileNextBillingProject, queueBillingEmails } from "../lib/billing-lifecycle";
import { applySubscriptionState } from "../lib/billing-quota";
import {
  ensureInternalQuota,
  internalQuotaWindow,
  renewInternalQuotas,
} from "../lib/internal-project";
import { ownProjectNumberConflict } from "../lib/project-number-conflict";
import {
  INBOUND_REPLIES,
  isVerificationText,
  verificationMessage,
} from "../lib/phone-verification";
import { sortSupportNumberMessages } from "../lib/support-inbox";

process.env.BETTER_AUTH_SECRET ??= "test-secret-for-internal-project";

const LIMIT = 25_000;

async function internalProject(prisma: Parameters<Parameters<typeof withTestDatabase>[0]>[0]) {
  const project = await createProject(prisma, { plan: "business" });
  await prisma.project.update({
    where: { id: project.id },
    data: { internal: true, numero: "+24166000099" },
  });
  return project.id;
}

test("internal quota window covers the calendar month with an overlap", () => {
  const window = internalQuotaWindow("p1", new Date("2026-11-13T10:00:00Z"));
  assert.equal(window.key, "internal:p1:2026-11");
  assert.equal(window.startsAt.toISOString(), "2026-11-01T00:00:00.000Z");
  assert.equal(window.endsAt.toISOString(), "2026-12-03T00:00:00.000Z");
  assert.equal(
    internalQuotaWindow("p1", new Date("2026-12-31T23:59:59Z")).key,
    "internal:p1:2026-12",
  );
});

test("internal project gets Business access, renewed each month, never billed", async () => {
  await withTestDatabase(async (prisma) => {
    const id = await internalProject(prisma);
    const customer = await createProject(prisma);
    const november = new Date("2026-11-13T10:00:00Z");

    assert.equal(await ensureInternalQuota(prisma, id, LIMIT, november), true);
    // Idempotent : rien ne change tant que le mois et le plafond sont les mêmes.
    assert.equal(await ensureInternalQuota(prisma, id, LIMIT, november), false);
    // Jamais sur un projet client.
    assert.equal(await ensureInternalQuota(prisma, customer.id, LIMIT, november), false);
    assert.equal(await prisma.quotaPeriod.count({ where: { projectId: customer.id } }), 0);

    const access = await prisma.$transaction((tx) => getBillingAccess(tx, id));
    assert.equal(access.allowed, true);
    assert.equal(access.reason, "active");

    await prisma.quotaPeriod.updateMany({ where: { projectId: id }, data: { used: 120 } });
    const december = new Date("2026-12-01T00:00:30Z");
    assert.deepEqual(await renewInternalQuotas(prisma, LIMIT, december), [id]);
    const periods = await prisma.quotaPeriod.findMany({
      where: { projectId: id },
      orderBy: { startsAt: "asc" },
    });
    assert.deepEqual(
      periods.map((p) => [p.key, p.isCurrent, p.used]),
      [
        [`internal:${id}:2026-11`, false, 120],
        [`internal:${id}:2026-12`, true, 0],
      ],
    );
    // Une horloge en retard ne rouvre pas le mois précédent.
    assert.equal(await ensureInternalQuota(prisma, id, LIMIT, november), false);
    const project = await prisma.project.findUniqueOrThrow({ where: { id } });
    assert.equal(project.messageCount, 0);
    assert.equal(project.allMessagesCount, LIMIT);

    // Ni vérification Polar ni e-mail de facturation.
    await prisma.project.updateMany({ data: { billingNextCheckAt: new Date(0) } });
    assert.equal(
      await reconcileNextBillingProject(prisma, { from: "a@example.test", origin: "https://example.test" }, async () => {
        throw new Error("Polar ne doit pas être appelé");
      }),
      null,
    );
    await queueBillingEmails(prisma, id, { from: "a@example.test", origin: "https://example.test" });
    assert.equal(await prisma.billingEmail.count({ where: { projectId: id } }), 0);

    // Un abonnement qui désignerait le projet interne est ignoré.
    await applySubscriptionState(
      prisma,
      {
        id: "sub_forged",
        customerId: "cus_forged",
        providerStatus: "trialing",
        status: "trialing",
        plan: "starter",
        priceId: "price",
        metadataProjectId: id,
        startsAt: Math.floor(Date.now() / 1000),
        endsAt: Math.floor(Date.now() / 1000) + 86_400,
        cycle: { start: 0, end: 0 },
        paidCycle: false,
      },
      Math.floor(Date.now() / 1000),
    );
    const after = await prisma.project.findUniqueOrThrow({ where: { id } });
    assert.equal(after.stripeSubscriptionId, null);
    assert.equal(after.plan, "business");
    assert.equal(await prisma.quotaPeriod.count({ where: { projectId: id, key: { startsWith: "trial:" } } }), 0);

    // En cours de suppression : plus aucun quota ouvert.
    await prisma.project.update({ where: { id }, data: { deletionPending: true } });
    assert.deepEqual(await renewInternalQuotas(prisma, LIMIT, new Date("2027-01-02T00:00:00Z")), []);
  });
});

test("a customer can never register the support number", async () => {
  await withTestDatabase(async (prisma) => {
    await internalProject(prisma);
    const user = await prisma.user.create({
      data: { id: crypto.randomUUID(), name: "Client", email: "client@example.test" },
    });
    assert.match(
      (await ownProjectNumberConflict(prisma, user.id, "+24166000099")) ?? "",
      /appartient à ExtravertyAI/,
    );
    assert.equal(await ownProjectNumberConflict(prisma, user.id, "+24166000098"), null);
  });
});

test("verification texts are recognised and never stored", () => {
  assert.equal(isVerificationText(verificationMessage("012345")), true);
  for (const reply of Object.values(INBOUND_REPLIES)) assert.equal(isVerificationText(reply), true);
  assert.equal(isVerificationText("Bonjour, comment payer depuis le Gabon ?"), false);
  assert.equal(isVerificationText(`Re: ${verificationMessage("012345")}`), false);
});

test("support number: codes go to verification, everything else to the support project", async () => {
  await withTestDatabase(async (prisma) => {
    const jid = "24166000011@s.whatsapp.net";
    const message = (text: string, fromMe = false) => ({
      key: { id: crypto.randomUUID(), fromMe, remoteJid: jid },
      message: { conversation: text },
    });
    const question = message("Bonjour, comment ajouter un membre à mon équipe ?");
    const agentReply = message("Bonjour ! Ouvrez l’onglet Équipe.", true);
    const sentCode = message(verificationMessage("482913"), true);
    const unknownCode = message("Voici mon code de vérification : 111111");
    const image = { key: { id: "x", fromMe: false, remoteJid: jid }, message: { imageMessage: {} } };

    const sorted = await sortSupportNumberMessages(prisma, [
      question,
      agentReply,
      sentCode,
      unknownCode,
      image,
      { unexpected: true },
    ]);
    assert.deepEqual(sorted.support, [question, agentReply, image, { unexpected: true }]);
    assert.deepEqual(sorted.replies, [{ digits: "24166000011", reply: INBOUND_REPLIES.unknown }]);
  });
});
