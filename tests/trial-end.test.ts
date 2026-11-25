import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { revokeDuplicateTrial, syncPolarSubscription } from "../lib/billing-polar";
import { reserveMessageQuota } from "../lib/message-quota";
import { PolarApiError, type PolarSubscription } from "../lib/polar";
import { PRICING_PLANS, TRIAL_MESSAGES } from "../lib/pricing";
import {
  readWebhookBody,
  verifyWebhookSignature,
  WEBHOOK_MAX_BODY_BYTES,
} from "../lib/standard-webhook";
import {
  TRIAL_END_CANCELLED_RECHECK_SECONDS,
  TRIAL_END_MAX_ATTEMPTS,
  endNextExhaustedTrial,
  requeueCancelledTrialEnd,
  trialEndRetryDelaySeconds,
  trialEndView,
  type TrialEndDeps,
} from "../lib/trial-end";
import { createProject, withTestDatabase } from "./helpers/database";

process.env.POLAR_STARTER_PRODUCT_ID = "prod-trial-test";
delete process.env.MESSAGE_LIMIT_STARTER;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (ms: number) => new Date(ms).toISOString();

function trialSub(projectId: string, over: Partial<PolarSubscription> = {}): PolarSubscription {
  const now = Date.now();
  return {
    id: `sub_${projectId}`,
    status: "trialing",
    customer_id: `cus_${projectId}`,
    product_id: "prod-trial-test",
    amount: 700,
    currency: "usd",
    recurring_interval: "month",
    current_period_start: iso(now - HOUR),
    current_period_end: iso(now + 7 * DAY),
    trial_start: iso(now - HOUR),
    trial_end: iso(now + 7 * DAY),
    cancel_at_period_end: false,
    metadata: { projectId },
    ...over,
  };
}

function paidSub(projectId: string): PolarSubscription {
  const now = Date.now();
  return trialSub(projectId, {
    status: "active",
    current_period_start: iso(now),
    current_period_end: iso(now + 30 * DAY),
    trial_start: null,
    trial_end: null,
  });
}

type Db = Parameters<Parameters<typeof withTestDatabase>[0]>[0];

/** Projet en essai ouvert par cette version, avec `used` messages déjà envoyés. */
async function trialProject(prisma: Db, used: number = TRIAL_MESSAGES) {
  const project = await createProject(prisma, { plan: "starter" });
  await syncPolarSubscription(prisma, trialSub(project.id), 10);
  const period = await prisma.quotaPeriod.findFirstOrThrow({
    where: { projectId: project.id, isCurrent: true },
  });
  await prisma.quotaPeriod.update({ where: { id: period.id }, data: { used } });
  return { project, period };
}

/** Faux Polar : compte les demandes de fin d'essai. */
function fakePolar(
  projectId: string,
  over: { retrieve?: TrialEndDeps["retrieve"]; endTrial?: TrialEndDeps["endTrial"] } = {},
) {
  const calls = { retrieve: 0, endTrial: 0 };
  const deps: TrialEndDeps = {
    retrieve: async (id) => {
      calls.retrieve++;
      return over.retrieve ? over.retrieve(id) : trialSub(projectId);
    },
    endTrial: async (id) => {
      calls.endTrial++;
      return over.endTrial ? over.endTrial(id) : paidSub(projectId);
    },
  };
  return { calls, deps };
}

async function current(prisma: Db, projectId: string) {
  return prisma.quotaPeriod.findFirstOrThrow({ where: { projectId, isCurrent: true } });
}

test("retry delays grow from 2 minutes to one hour", () => {
  assert.deepEqual(
    [0, 1, 2, 3, 6, 7, 20].map(trialEndRetryDelaySeconds),
    [120, 120, 240, 480, 3600, 3600, 3600],
  );
});

test("the billing page only flags exhausted trials opened under the quota rule", () => {
  const period = { kind: "trialing", endsOnQuota: true, used: 50, limit: 50, trialEndStatus: null };
  assert.equal(trialEndView(period), "processing");
  assert.equal(trialEndView({ ...period, trialEndStatus: "REQUESTING" }), "processing");
  assert.equal(trialEndView({ ...period, trialEndStatus: "PAYMENT_FAILED" }), "payment_failed");
  assert.equal(trialEndView({ ...period, trialEndStatus: "FAILED" }), "failed");
  assert.equal(trialEndView({ ...period, trialEndStatus: "CANCELLED" }), "cancelled");
  assert.equal(trialEndView({ ...period, used: 49 }), null);
  assert.equal(trialEndView({ ...period, endsOnQuota: false }), null);
  assert.equal(trialEndView({ ...period, kind: "active" }), null);
  assert.equal(trialEndView(null), null);
});

test("the last trial message ends the trial at Polar once, then opens the paid month", { timeout: 600000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const { project, period } = await trialProject(prisma, TRIAL_MESSAGES - 1);
    assert.equal(period.kind, "trialing");
    assert.equal(period.endsOnQuota, true, "un nouvel essai s'arrête à son quota");
    assert.equal(period.limit, TRIAL_MESSAGES);

    const polar = fakePolar(project.id);
    assert.equal(await endNextExhaustedTrial(prisma, polar.deps), null, "quota pas encore atteint");
    await prisma.$transaction((tx) => reserveMessageQuota(tx, project.id));
    await assert.rejects(
      prisma.$transaction((tx) => reserveMessageQuota(tx, project.id)),
      (error: Error & { code?: string }) =>
        error.code === "QUOTA_EXCEEDED" && /prélèvement/.test(error.message),
    );

    assert.deepEqual(await endNextExhaustedTrial(prisma, polar.deps), {
      projectId: project.id,
      status: "DONE",
    });
    assert.equal(polar.calls.endTrial, 1);
    const trial = await prisma.quotaPeriod.findUniqueOrThrow({ where: { id: period.id } });
    assert.deepEqual([trial.isCurrent, trial.trialEndStatus], [false, "DONE"]);
    const paid = await current(prisma, project.id);
    assert.equal(paid.kind, "active");
    assert.equal(paid.limit, PRICING_PLANS[0].messageLimit);
    const after = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    assert.equal(after.status, "active");

    // Rien d'autre à faire : jamais un second prélèvement.
    assert.equal(await endNextExhaustedTrial(prisma, polar.deps), null);
    assert.equal(polar.calls.endTrial, 1);
    await prisma.$transaction((tx) => reserveMessageQuota(tx, project.id));
  });
});

test("a declined card pauses the trial without automatic retries; a manual retry charges once", { timeout: 600000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const { project, period } = await trialProject(prisma);
    let decline = true;
    const polar = fakePolar(project.id, {
      endTrial: async () => {
        if (decline) throw new PolarApiError(402);
        return paidSub(project.id);
      },
    });
    assert.equal((await endNextExhaustedTrial(prisma, polar.deps))?.status, "PAYMENT_FAILED");
    assert.equal(await endNextExhaustedTrial(prisma, polar.deps), null, "pas de relance automatique");
    assert.equal(polar.calls.endTrial, 1);
    const failed = await current(prisma, project.id);
    assert.deepEqual([failed.id, failed.trialEndStatus], [period.id, "PAYMENT_FAILED"]);
    assert.equal(trialEndView(failed), "payment_failed");

    // Relance demandée depuis la page Facturation (même mise à jour que l'action).
    decline = false;
    await prisma.quotaPeriod.update({
      where: { id: period.id },
      data: { trialEndStatus: "PENDING", trialEndDueAt: new Date(), trialEndAttempts: 0 },
    });
    assert.equal((await endNextExhaustedTrial(prisma, polar.deps))?.status, "DONE");
    assert.equal(polar.calls.endTrial, 2);
    assert.equal((await current(prisma, project.id)).kind, "active");
  });
});

test("a cancelled trial is never charged, until the subscription is resumed", { timeout: 600000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const { project, period } = await trialProject(prisma);
    let cancelled = true;
    const polar = fakePolar(project.id, {
      retrieve: async () => trialSub(project.id, { cancel_at_period_end: cancelled }),
    });
    const before = Date.now();
    assert.equal((await endNextExhaustedTrial(prisma, polar.deps))?.status, "CANCELLED");
    assert.equal(polar.calls.endTrial, 0);
    const waiting = await prisma.quotaPeriod.findUniqueOrThrow({ where: { id: period.id } });
    assert.equal(waiting.trialEndAttempts, 0);
    assert.ok(
      waiting.trialEndDueAt!.getTime() >= before + (TRIAL_END_CANCELLED_RECHECK_SECONDS - 5) * 1000,
      "revérifié plus tard seulement",
    );
    assert.equal(await endNextExhaustedTrial(prisma, polar.deps), null);

    cancelled = false;
    await requeueCancelledTrialEnd(prisma, project.id);
    assert.equal((await endNextExhaustedTrial(prisma, polar.deps))?.status, "DONE");
    assert.equal(polar.calls.endTrial, 1);
  });
});

test("a trial already ended at Polar is synced without a second request", { timeout: 600000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const { project } = await trialProject(prisma);
    // Réponse perdue après un prélèvement réussi : Polar dit déjà « active ».
    const polar = fakePolar(project.id, { retrieve: async () => paidSub(project.id) });
    assert.equal((await endNextExhaustedTrial(prisma, polar.deps))?.status, "DONE");
    assert.equal(polar.calls.endTrial, 0);
    assert.equal((await current(prisma, project.id)).kind, "active");
  });
});

test("transient failures back off, give up after the maximum, and never run twice at once", { timeout: 600000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const { project, period } = await trialProject(prisma);
    const down = fakePolar(project.id, {
      endTrial: async () => {
        throw new PolarApiError(503);
      },
    });
    assert.equal((await endNextExhaustedTrial(prisma, down.deps))?.status, "PENDING");
    const pending = await prisma.quotaPeriod.findUniqueOrThrow({ where: { id: period.id } });
    assert.ok(pending.trialEndDueAt! > new Date(), "attente avant la tentative suivante");
    assert.equal(await endNextExhaustedTrial(prisma, down.deps), null);

    // Dernière tentative permise : l'échec devient définitif (support).
    await prisma.quotaPeriod.update({
      where: { id: period.id },
      data: { trialEndDueAt: new Date(0), trialEndAttempts: TRIAL_END_MAX_ATTEMPTS - 1 },
    });
    assert.equal((await endNextExhaustedTrial(prisma, down.deps))?.status, "FAILED");
    assert.equal(await endNextExhaustedTrial(prisma, down.deps), null);

    // Deux workers en même temps : une seule demande chez Polar.
    await prisma.quotaPeriod.update({
      where: { id: period.id },
      data: { trialEndStatus: null, trialEndDueAt: null, trialEndAttempts: 0 },
    });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow = fakePolar(project.id, {
      endTrial: async () => {
        await gate;
        return paidSub(project.id);
      },
    });
    const first = endNextExhaustedTrial(prisma, slow.deps);
    while (slow.calls.endTrial === 0) await new Promise((resolve) => setTimeout(resolve, 10));
    assert.equal(await endNextExhaustedTrial(prisma, slow.deps), null, "demande déjà en cours");
    release();
    assert.equal((await first)?.status, "DONE");
    assert.equal(slow.calls.endTrial, 1);
  });
});

test("trials opened before this version keep their terms", { timeout: 600000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const { project, period } = await trialProject(prisma);
    await prisma.quotaPeriod.update({ where: { id: period.id }, data: { endsOnQuota: false } });
    const polar = fakePolar(project.id);
    assert.equal(await endNextExhaustedTrial(prisma, polar.deps), null);
    assert.equal(polar.calls.retrieve + polar.calls.endTrial, 0);
    await assert.rejects(
      prisma.$transaction((tx) => reserveMessageQuota(tx, project.id)),
      (error: Error) => error.message === "Le quota de messages est atteint.",
    );
  });
});

test("a duplicate trial for the same project is revoked before any charge", { timeout: 600000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const { project } = await trialProject(prisma, 0);
    const revoked: string[] = [];
    const revoke = async (id: string) => {
      revoked.push(id);
    };
    const attached = trialSub(project.id);
    const duplicate = trialSub(project.id, { id: "sub_second_checkout" });
    assert.equal(await revokeDuplicateTrial(prisma, attached, revoke), false);
    assert.equal(await revokeDuplicateTrial(prisma, duplicate, revoke), true);
    assert.deepEqual(revoked, ["sub_second_checkout"]);
    // Déjà payé : jamais révoqué ici (remboursement par le support).
    assert.equal(
      await revokeDuplicateTrial(prisma, { ...paidSub(project.id), id: "sub_paid" }, revoke),
      false,
    );
    // L'abonnement rattaché est terminé : le nouveau le remplace.
    await prisma.project.update({ where: { id: project.id }, data: { stripeStatus: "canceled" } });
    assert.equal(await revokeDuplicateTrial(prisma, duplicate, revoke), false);
    assert.deepEqual(revoked, ["sub_second_checkout"]);
  });
});

test("webhook signatures accept both Polar secret formats and nothing else", () => {
  const key = crypto.randomBytes(32);
  const secret = `whsec_${key.toString("base64")}`;
  const NOW = 1_800_000_000_000;
  const timestamp = String(NOW / 1000);
  const body = '{"type":"subscription.updated"}';
  const sign = (with_: Buffer, at = timestamp) =>
    `v1,${crypto.createHmac("sha256", with_).update(`msg_1.${at}.${body}`).digest("base64")}`;
  const check = (signature: string, over: { secret?: string; timestamp?: string } = {}) =>
    verifyWebhookSignature({
      secret: over.secret ?? secret,
      body,
      id: "msg_1",
      timestamp: over.timestamp ?? timestamp,
      signature,
      nowMs: NOW,
    });
  assert.equal(check(sign(key)), true, "secret décodé (norme)");
  assert.equal(check(sign(Buffer.from(secret, "utf8"))), true, "ancien secret Polar");
  assert.equal(check(sign(crypto.randomBytes(32))), false);
  assert.equal(check(sign(key), { secret: `whsec_${crypto.randomBytes(32).toString("base64")}` }), false);
  assert.equal(check(sign(key), { secret: "" }), false);
  assert.equal(check(sign(key, `${timestamp}.5`), { timestamp: `${timestamp}.5` }), false);
  assert.equal(check(sign(key, "1e9"), { timestamp: "1e9" }), false);
  assert.equal(check(`v2,${sign(key).slice(3)}`), false);
});

test("webhook bodies are read up to the size limit only", async () => {
  const request = (body: string, headers: Record<string, string> = {}) =>
    new Request("https://example.test/webhook", { method: "POST", body, headers });
  assert.equal(await readWebhookBody(request('{"ok":true}')), '{"ok":true}');
  assert.equal(await readWebhookBody(request("é".repeat(10))), "é".repeat(10));
  assert.equal(await readWebhookBody(request("x".repeat(WEBHOOK_MAX_BODY_BYTES + 1))), null);
  assert.equal(await readWebhookBody(request("x".repeat(64)), 64), "x".repeat(64));
  assert.equal(await readWebhookBody(request("x".repeat(65)), 64), null);
});
