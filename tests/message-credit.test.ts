import assert from "node:assert/strict";
import test from "node:test";
import { reserveMessageQuota } from "../lib/message-quota";
import {
  creditPackUnits,
  extraMessageCost,
  extraMessagesLeft,
  matchesPolarCreditProduct,
  messagesLeft,
  syncMessageCreditOrder,
} from "../lib/message-credit";
import type { PolarOrder } from "../lib/polar";
import { EXTRA_PACK_MESSAGES, PRICING_PLANS } from "../lib/pricing";
import { createProject, withTestDatabase } from "./helpers/database";

const HOUR = 3_600_000;

test("extra message prices are whole credit units, above the in-quota price", () => {
  assert.deepEqual(
    PRICING_PLANS.map((plan) => extraMessageCost(plan.id)),
    [80, 60, 50],
  );
  for (const plan of PRICING_PLANS) {
    assert.ok(Number.isSafeInteger(extraMessageCost(plan.id)), plan.id);
    assert.equal(creditPackUnits(plan.id), extraMessageCost(plan.id) * EXTRA_PACK_MESSAGES);
    // Un message en plus coûte au moins autant qu'un message du forfait.
    assert.ok(
      plan.extraPackCents / EXTRA_PACK_MESSAGES >= plan.priceCents / plan.messageLimit,
      plan.id,
    );
  }
  assert.deepEqual(
    PRICING_PLANS.map((plan) => plan.messageLimit),
    [2500, 8000, 25000],
  );
});

test("credit only extends a paid period, within the credit and the period cap", () => {
  const period = { kind: "active", limit: 10, used: 10, extraUsed: 0 };
  assert.equal(extraMessagesLeft(period, { plan: "starter", extraCredit: 400 }), 5);
  assert.equal(extraMessagesLeft(period, { plan: "business", extraCredit: 400 }), 8);
  assert.equal(extraMessagesLeft(period, { plan: "starter", extraCredit: 79 }), 0);
  // Plafond : au plus `limit` messages de plus par période.
  assert.equal(extraMessagesLeft(period, { plan: "starter", extraCredit: 10_000 }), 10);
  assert.equal(
    extraMessagesLeft({ ...period, extraUsed: 10 }, { plan: "starter", extraCredit: 10_000 }),
    0,
  );
  assert.equal(
    extraMessagesLeft({ ...period, kind: "trialing" }, { plan: "starter", extraCredit: 10_000 }),
    0,
  );
  assert.equal(
    messagesLeft({ ...period, used: 7 }, { plan: "starter", extraCredit: 160 }),
    5,
  );
  assert.equal(messagesLeft(null, { plan: "starter", extraCredit: 10_000 }), 0);
});

test("credit products must be one-time USD products at the plan price", () => {
  const product = {
    is_archived: false,
    is_recurring: false,
    recurring_interval: null,
    prices: [{ amount_type: "fixed", price_amount: 800, price_currency: "usd", is_archived: false }],
  };
  assert.equal(matchesPolarCreditProduct(product, "starter"), true);
  assert.equal(matchesPolarCreditProduct(product, "pro"), false);
  assert.equal(matchesPolarCreditProduct({ ...product, is_recurring: true }, "starter"), false);
  assert.equal(matchesPolarCreditProduct({ ...product, is_archived: true }, "starter"), false);
});

async function paidPeriod(
  prisma: Parameters<Parameters<typeof withTestDatabase>[0]>[0],
  projectId: string,
  data: { kind?: "active" | "trialing"; limit?: number; used?: number } = {},
) {
  const now = Date.now();
  return prisma.quotaPeriod.create({
    data: {
      projectId,
      key: `cycle:test:${now}`,
      kind: data.kind ?? "active",
      startsAt: new Date(now - HOUR),
      endsAt: new Date(now + HOUR),
      limit: data.limit ?? 2,
      used: data.used ?? 0,
    },
  });
}

test("reservation uses the quota first, then the prepaid credit, up to the cap", { timeout: 600000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const project = await createProject(prisma, { plan: "starter" });
    await prisma.project.update({ where: { id: project.id }, data: { extraCredit: 200 } });
    const period = await paidPeriod(prisma, project.id, { limit: 2 });
    const reserve = () => prisma.$transaction((tx) => reserveMessageQuota(tx, project.id));

    assert.equal((await reserve()).extra, false);
    assert.equal((await reserve()).extra, false);
    assert.equal(
      (await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).extraCredit,
      200,
      "le crédit n'est pas touché tant que le quota suffit",
    );
    assert.equal((await reserve()).extra, true);
    assert.equal((await reserve()).extra, true);
    // Plafond atteint (2 messages de plus pour un quota de 2), crédit restant : 40.
    await assert.rejects(reserve, { code: "QUOTA_EXCEEDED" });
    const after = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });
    const quota = await prisma.quotaPeriod.findUniqueOrThrow({ where: { id: period.id } });
    assert.equal(after.extraCredit, 40);
    assert.equal(after.messageCount, 4);
    assert.deepEqual([quota.used, quota.extraUsed], [2, 2]);
  });
});

test("reservation refuses when the credit is short or during a trial", { timeout: 600000 }, async () => {
  await withTestDatabase(async (prisma) => {
    const short = await createProject(prisma, { plan: "starter" });
    await prisma.project.update({ where: { id: short.id }, data: { extraCredit: 79 } });
    await paidPeriod(prisma, short.id, { limit: 1, used: 1 });
    await assert.rejects(
      prisma.$transaction((tx) => reserveMessageQuota(tx, short.id)),
      { code: "QUOTA_EXCEEDED" },
    );

    const trial = await createProject(prisma, { plan: "starter" });
    await prisma.project.update({
      where: { id: trial.id },
      data: { status: "trialing", extraCredit: 10_000 },
    });
    await paidPeriod(prisma, trial.id, { kind: "trialing", limit: 1, used: 1 });
    await assert.rejects(
      prisma.$transaction((tx) => reserveMessageQuota(tx, trial.id)),
      { code: "QUOTA_EXCEEDED" },
    );
    assert.equal(
      (await prisma.project.findUniqueOrThrow({ where: { id: trial.id } })).extraCredit,
      10_000,
    );
  });
});

test("a paid credit order is credited once and a refund takes back the rest", { timeout: 600000 }, async () => {
  const previous = process.env.POLAR_STARTER_CREDIT_PRODUCT_ID;
  process.env.POLAR_STARTER_CREDIT_PRODUCT_ID = "prod-credit-starter";
  try {
    await withTestDatabase(async (prisma) => {
      const project = await createProject(prisma, { plan: "starter" });
      const order = (over: Partial<PolarOrder> = {}): PolarOrder => ({
        id: "0b7e2a52-6a5e-4b8a-9d55-2f4f1d1b6c01",
        status: "paid",
        total_amount: 960,
        net_amount: 800,
        refunded_amount: 0,
        currency: "usd",
        subscription_id: null,
        created_at: new Date().toISOString(),
        invoice_number: null,
        product_id: "prod-credit-starter",
        metadata: { projectId: project.id, kind: "message_credit", plan: "starter" },
        ...over,
      });
      const credit = async () =>
        (await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).extraCredit;

      assert.equal(await syncMessageCreditOrder(prisma, order({ status: "pending" })), "pending");
      assert.equal(await credit(), 0);
      assert.equal(await syncMessageCreditOrder(prisma, order()), "applied");
      assert.equal(await syncMessageCreditOrder(prisma, order()), "applied");
      assert.equal(await credit(), 80_000, "8 $ hors taxes, crédités une seule fois");

      // Produit inconnu, commande d'abonnement ou projet absent : rien n'est crédité.
      for (const ignored of [
        order({ id: "0b7e2a52-6a5e-4b8a-9d55-2f4f1d1b6c02", product_id: "other" }),
        order({ id: "0b7e2a52-6a5e-4b8a-9d55-2f4f1d1b6c03", subscription_id: "sub" }),
        order({ id: "0b7e2a52-6a5e-4b8a-9d55-2f4f1d1b6c04", metadata: {} }),
      ])
        assert.equal(await syncMessageCreditOrder(prisma, ignored), "ignored");
      assert.equal(await credit(), 80_000);

      // 500 messages consommés, puis remboursement partiel puis total.
      await prisma.project.update({ where: { id: project.id }, data: { extraCredit: 40_000 } });
      await syncMessageCreditOrder(
        prisma,
        order({ status: "partially_refunded", refunded_amount: 200 }),
      );
      assert.equal(await credit(), 20_000);
      await syncMessageCreditOrder(prisma, order({ status: "refunded", refunded_amount: 800 }));
      assert.equal(await credit(), 0, "le crédit ne descend jamais sous zéro");
      const purchase = await prisma.messageCreditPurchase.findUniqueOrThrow({
        where: { orderId: order().id },
      });
      assert.deepEqual([purchase.credit, purchase.refunded], [80_000, 80_000]);
    });
  } finally {
    if (previous === undefined) delete process.env.POLAR_STARTER_CREDIT_PRODUCT_ID;
    else process.env.POLAR_STARTER_CREDIT_PRODUCT_ID = previous;
  }
});
