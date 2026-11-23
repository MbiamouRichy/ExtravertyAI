import { test } from "node:test";
import assert from "node:assert/strict";
import { withTestDatabase, createProject } from "./helpers/database";
import { getBillingAccess } from "../lib/billing-access";
import { applySubscriptionState, type SubscriptionState } from "../lib/billing-quota";
import {
  ManualBillingError,
  hasLivePolarSubscription,
  listManualPayments,
  listRenewals,
  manualBillingStats,
  projectManualPayments,
  recordManualPayment,
  searchBillingProjects,
} from "../lib/manual-billing";
import {
  MANUAL_PAYMENT_ACTION,
  ManualPaymentSchema,
  addMonthsUtc,
  planManualPeriod,
  type ManualPaymentInput,
} from "../lib/manual-billing-shared";

process.env.MESSAGE_LIMIT_STARTER = "2500";
process.env.MESSAGE_LIMIT_PRO = "8000";
process.env.MESSAGE_LIMIT_BUSINESS = "25000";

const ADMIN = { id: "admin-1", name: "Équipe", email: "equipe@example.test" };
const DAY = 86_400_000;

function payment(projectId: string, overrides: Partial<ManualPaymentInput> = {}): ManualPaymentInput {
  return {
    projectId,
    requestId: crypto.randomUUID(),
    plan: "starter",
    months: 1,
    amountXaf: 25_000,
    method: "airtel_money",
    reference: "MP251123.1042.A12345",
    note: "",
    ...overrides,
  };
}

/** Projet créé dont le paiement par carte n'a jamais abouti : le cas d'un client sans carte. */
async function unpaidProject(prisma: Parameters<Parameters<typeof withTestDatabase>[0]>[0]) {
  const project = await createProject(prisma);
  await prisma.project.update({ where: { id: project.id }, data: { status: "inactive" } });
  return project.id;
}

function polarState(overrides: Partial<SubscriptionState> = {}): SubscriptionState {
  const now = Math.floor(Date.now() / 1000);
  return {
    id: "sub-1",
    customerId: "cus-1",
    providerStatus: "canceled",
    status: "inactive",
    plan: "starter",
    priceId: "prod-starter",
    startsAt: now - 10 * 86_400,
    endsAt: now - 86_400,
    cycle: { start: now - 10 * 86_400, end: now - 86_400 },
    paidCycle: false,
    ...overrides,
  };
}

test("months are added on the calendar, without overflowing short months", () => {
  assert.equal(
    addMonthsUtc(new Date("2026-11-23T09:30:00Z"), 1).toISOString(),
    "2026-12-23T09:30:00.000Z",
  );
  assert.equal(
    addMonthsUtc(new Date("2026-12-15T00:00:00Z"), 1).toISOString(),
    "2027-01-15T00:00:00.000Z",
  );
  assert.equal(
    addMonthsUtc(new Date("2027-01-31T12:00:00Z"), 1).toISOString(),
    "2027-02-28T12:00:00.000Z",
  );
  assert.equal(
    addMonthsUtc(new Date("2028-01-31T12:00:00Z"), 1).toISOString(),
    "2028-02-29T12:00:00.000Z",
  );
  assert.equal(
    addMonthsUtc(new Date("2026-11-23T00:00:00Z"), 12).toISOString(),
    "2027-11-23T00:00:00.000Z",
  );
});

test("a payment extends a running mobile money period, otherwise starts now", () => {
  const now = new Date("2026-11-23T10:00:00Z");
  const running = {
    key: "manual:1",
    startsAt: new Date("2026-11-01T10:00:00Z"),
    endsAt: new Date("2026-12-01T10:00:00Z"),
    limit: 2500,
  };
  assert.deepEqual(planManualPeriod({ now, current: running, months: 2, monthlyLimit: 8000 }), {
    mode: "extend",
    startsAt: running.startsAt,
    endsAt: new Date("2027-02-01T10:00:00Z"),
    limit: 2500 + 16_000,
  });
  // Période terminée, essai ou mois payé par carte : on repart de la date du paiement.
  for (const current of [
    { ...running, endsAt: new Date("2026-11-20T10:00:00Z") },
    { ...running, key: "trial:sub-1" },
    { ...running, key: "cycle:sub-1:1" },
    null,
  ])
    assert.deepEqual(planManualPeriod({ now, current, months: 1, monthlyLimit: 2500 }), {
      mode: "start",
      startsAt: now,
      endsAt: new Date("2026-12-23T10:00:00Z"),
      limit: 2500,
    });
});

test("payment input is validated: mobile money needs its transaction id", () => {
  const base = payment("c" + "a".repeat(24));
  assert.equal(ManualPaymentSchema.safeParse(base).success, true);
  const missing = ManualPaymentSchema.safeParse({ ...base, reference: "  " });
  assert.equal(missing.success, false);
  assert.deepEqual(missing.error?.issues.map((issue) => issue.path), [["reference"]]);
  // En espèces, la référence est facultative.
  assert.equal(
    ManualPaymentSchema.safeParse({ ...base, method: "cash", reference: "" }).success,
    true,
  );
  for (const invalid of [
    { months: 4 },
    { amountXaf: 50 },
    { amountXaf: 25_000.5 },
    { amountXaf: 10_000_000 },
    { reference: "<script>" },
    { projectId: "'; DROP TABLE project; --" },
    { requestId: "pas-un-uuid" },
  ])
    assert.equal(ManualPaymentSchema.safeParse({ ...base, ...invalid }).success, false, JSON.stringify(invalid));
});

test("only an ended card subscription allows a mobile money payment", () => {
  assert.equal(hasLivePolarSubscription({ stripeSubscriptionId: null, stripeStatus: null }), false);
  for (const status of ["canceled", "unpaid", "incomplete_expired"])
    assert.equal(hasLivePolarSubscription({ stripeSubscriptionId: "sub", stripeStatus: status }), false);
  for (const status of ["trialing", "active", "past_due", "incomplete", null])
    assert.equal(hasLivePolarSubscription({ stripeSubscriptionId: "sub", stripeStatus: status }), true);
});

test("a mobile money payment opens access, once, and a renewal extends it", async () => {
  await withTestDatabase(async (prisma) => {
    const id = await unpaidProject(prisma);
    const before = await prisma.$transaction((tx) => getBillingAccess(tx, id));
    assert.equal(before.allowed, false);

    const first = payment(id, { plan: "pro" });
    const opened = await recordManualPayment(prisma, ADMIN, first);
    assert.equal(opened.duplicate, false);
    assert.equal(opened.mode, "start");
    assert.equal(opened.plan, "pro");

    const access = await prisma.$transaction((tx) => getBillingAccess(tx, id));
    assert.equal(access.allowed, true);
    assert.equal(access.reason, "active");
    const project = await prisma.project.findUniqueOrThrow({ where: { id } });
    assert.equal(project.status, "active");
    assert.equal(project.plan, "pro");
    assert.equal(project.allMessagesCount, 8000);
    const period = await prisma.quotaPeriod.findFirstOrThrow({ where: { projectId: id, isCurrent: true } });
    assert.match(period.key, /^manual:\d+$/);
    assert.equal(period.kind, "active");
    assert.equal(period.limit, 8000);
    const span = period.endsAt.getTime() - period.startsAt.getTime();
    assert.ok(span >= 28 * DAY && span <= 31 * DAY);

    // Double envoi (réseau instable) : rien n'est compté deux fois.
    const again = await recordManualPayment(prisma, ADMIN, first);
    assert.equal(again.duplicate, true);
    assert.equal(again.endsAt.getTime(), period.endsAt.getTime());
    assert.equal(await prisma.quotaPeriod.count({ where: { projectId: id } }), 1);
    assert.equal(await prisma.adminAuditLog.count({ where: { action: MANUAL_PAYMENT_ACTION } }), 1);

    // Renouvellement avant l'échéance : même période, prolongée, messages restants gardés.
    await prisma.quotaPeriod.update({ where: { id: period.id }, data: { used: 300 } });
    const renewed = await recordManualPayment(
      prisma,
      ADMIN,
      payment(id, { plan: "pro", months: 3, amountXaf: 60_000, method: "moov_money" }),
    );
    assert.equal(renewed.mode, "extend");
    const extended = await prisma.quotaPeriod.findUniqueOrThrow({ where: { id: period.id } });
    assert.equal(extended.isCurrent, true);
    assert.equal(extended.used, 300);
    assert.equal(extended.limit, 8000 * 4);
    assert.equal(
      extended.endsAt.toISOString(),
      addMonthsUtc(period.endsAt, 3).toISOString(),
    );

    const log = await prisma.adminAuditLog.findFirstOrThrow({
      where: { action: MANUAL_PAYMENT_ACTION },
      orderBy: { createdAt: "desc" },
    });
    assert.equal(log.actorEmail, ADMIN.email);
    assert.equal(log.targetId, id);
    assert.equal((log.metadata as { amountXaf: number }).amountXaf, 60_000);

    // Historique et facturation du client : la référence et la note n'y figurent pas.
    const history = await listManualPayments(prisma);
    assert.deepEqual(history.map((row) => row.amountXaf), [60_000, 25_000]);
    assert.equal(history[0].projectName, "Test");
    const own = await projectManualPayments(prisma, id);
    assert.equal(own.length, 2);
    assert.equal("reference" in own[0], false);
    assert.equal("note" in own[0], false);

    const stats = await manualBillingStats(prisma);
    assert.equal(stats.collected, 85_000);
    assert.equal(stats.paymentCount, 2);
    assert.equal(stats.running, 1);
  });
});

test("an automation paused by the customer stays paused after a payment", async () => {
  await withTestDatabase(async (prisma) => {
    const id = await unpaidProject(prisma);
    await prisma.project.update({
      where: { id },
      data: { automationPaused: true, status: "paused", statusBeforePause: "inactive" },
    });
    await recordManualPayment(prisma, ADMIN, payment(id));
    const project = await prisma.project.findUniqueOrThrow({ where: { id } });
    assert.equal(project.status, "paused");
    assert.equal(project.statusBeforePause, "active");
    const access = await prisma.$transaction((tx) => getBillingAccess(tx, id));
    assert.equal(access.allowed, true);
    assert.equal(access.automationPaused, true);
  });
});

test("an expired mobile money period restarts from the payment date", async () => {
  await withTestDatabase(async (prisma) => {
    const id = await unpaidProject(prisma);
    await recordManualPayment(prisma, ADMIN, payment(id));
    const old = await prisma.quotaPeriod.findFirstOrThrow({ where: { projectId: id } });
    await prisma.quotaPeriod.update({
      where: { id: old.id },
      data: {
        startsAt: new Date(Date.now() - 40 * DAY),
        endsAt: new Date(Date.now() - 10 * DAY),
        used: 2500,
      },
    });
    assert.equal((await prisma.$transaction((tx) => getBillingAccess(tx, id))).allowed, false);
    assert.deepEqual(
      (await listRenewals(prisma)).map((row) => row.id),
      [id],
    );

    const result = await recordManualPayment(prisma, ADMIN, payment(id));
    assert.equal(result.mode, "start");
    const periods = await prisma.quotaPeriod.findMany({
      where: { projectId: id },
      orderBy: { startsAt: "asc" },
    });
    assert.deepEqual(
      periods.map((period) => [period.isCurrent, period.used]),
      [
        [false, 2500],
        [true, 0],
      ],
    );
    assert.equal((await prisma.$transaction((tx) => getBillingAccess(tx, id))).allowed, true);
    assert.deepEqual(await listRenewals(prisma), []);
  });
});

test("payments are refused on a live card subscription, the internal project or a deletion", async () => {
  await withTestDatabase(async (prisma) => {
    const live = await unpaidProject(prisma);
    await prisma.project.update({
      where: { id: live },
      data: { stripeSubscriptionId: "sub-live", stripeStatus: "trialing" },
    });
    await assert.rejects(recordManualPayment(prisma, ADMIN, payment(live)), ManualBillingError);

    const internal = await unpaidProject(prisma);
    await prisma.project.update({ where: { id: internal }, data: { internal: true } });
    await assert.rejects(recordManualPayment(prisma, ADMIN, payment(internal)), ManualBillingError);

    const deleting = await unpaidProject(prisma);
    await prisma.project.update({ where: { id: deleting }, data: { deletionPending: true } });
    await assert.rejects(recordManualPayment(prisma, ADMIN, payment(deleting)), ManualBillingError);

    await assert.rejects(
      recordManualPayment(prisma, ADMIN, payment("c" + "z".repeat(24))),
      ManualBillingError,
    );
    assert.equal(await prisma.quotaPeriod.count(), 0);
    assert.equal(await prisma.adminAuditLog.count(), 0);

    // Le projet interne n'apparaît jamais dans la recherche du back-office.
    const found = await searchBillingProjects(prisma, "");
    assert.equal(found.some((row) => row.id === internal), false);
    assert.equal(found.find((row) => row.id === live)?.cardSubscription, true);
  });
});

test("Polar never cuts a running mobile money access, but a paid card month replaces it", async () => {
  await withTestDatabase(async (prisma) => {
    const id = await unpaidProject(prisma);
    // Ancien essai par carte, résilié : le client paie ensuite par mobile money.
    await prisma.project.update({
      where: { id },
      data: { stripeSubscriptionId: "sub-1", stripeCustomerId: "cus-1", stripeStatus: "canceled" },
    });
    await recordManualPayment(prisma, ADMIN, payment(id, { plan: "pro" }));
    const revision = (await prisma.project.findUniqueOrThrow({ where: { id } })).billingRevision;

    // La synchronisation de l'abonnement résilié (worker toutes les 5 minutes).
    await applySubscriptionState(prisma, polarState({ providerStatus: "unpaid" }), 0, undefined, revision);
    let project = await prisma.project.findUniqueOrThrow({ where: { id } });
    assert.equal(project.status, "active");
    assert.equal(project.plan, "pro");
    assert.equal(project.stripeStatus, "unpaid");
    assert.equal((await prisma.$transaction((tx) => getBillingAccess(tx, id))).allowed, true);

    // Un essai ne remplace pas non plus un accès déjà payé.
    const now = Math.floor(Date.now() / 1000);
    await applySubscriptionState(
      prisma,
      polarState({
        providerStatus: "trialing",
        status: "trialing",
        startsAt: now,
        endsAt: now + 5 * 86_400,
      }),
      1,
    );
    project = await prisma.project.findUniqueOrThrow({ where: { id } });
    assert.equal(project.status, "active");
    const current = await prisma.quotaPeriod.findFirstOrThrow({ where: { projectId: id, isCurrent: true } });
    assert.match(current.key, /^manual:/);

    // Un mois payé par carte, lui, prend le relais.
    await applySubscriptionState(
      prisma,
      polarState({
        providerStatus: "active",
        status: "active",
        paidCycle: true,
        plan: "business",
        startsAt: now + 60,
        endsAt: now + 30 * 86_400,
        cycle: { start: now + 60, end: now + 30 * 86_400 },
      }),
      2,
    );
    project = await prisma.project.findUniqueOrThrow({ where: { id } });
    assert.equal(project.plan, "business");
    assert.equal(project.stripeStatus, "active");
    const card = await prisma.quotaPeriod.findFirstOrThrow({ where: { projectId: id, isCurrent: true } });
    assert.match(card.key, /^cycle:sub-1:/);
  });
});
