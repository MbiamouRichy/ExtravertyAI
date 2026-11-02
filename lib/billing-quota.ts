import type Stripe from "stripe";
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import type { BillingProvider } from "./billing-provider";

export function subscriptionStatus(status: string) {
  if (status === "trialing") return "trialing" as const;
  if (status === "active") return "active" as const;
  if (["past_due", "unpaid", "paused"].includes(status))
    return "paused" as const;
  return "inactive" as const;
}

export function planForPrice(priceId: string) {
  const plans = ["starter", "pro", "business"] as const;
  const plan = plans.find(
    (p) =>
      process.env[`STRIPE_${p.toUpperCase()}_PLAN_ID`] === priceId ||
      (process.env[`STRIPE_${p.toUpperCase()}_LEGACY_PRICE_IDS`] || "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
        .includes(priceId),
  );
  if (!plan) throw new Error("UNKNOWN_STRIPE_PRICE");
  return plan;
}

export function paidMessageLimit(plan: string) {
  const value = Number(process.env[`MESSAGE_LIMIT_${plan.toUpperCase()}`]);
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error("PAID_MESSAGE_LIMIT_NOT_CONFIGURED");
  return value;
}

/** Délai maximal accordé à Stripe pour encaisser la facture de renouvellement. */
export const RENEWAL_GRACE_MS = 3 * 86400000;

// Prolonge uniquement la période payée qui précède immédiatement le nouveau
// cycle. Un essai, une période plus ancienne ou un paiement échoué (past_due,
// donc statut « paused ») ne bénéficient jamais de ce délai.
async function extendPaidPeriodDuringRenewal(
  tx: Prisma.TransactionClient,
  projectId: string,
  subscriptionId: string,
  cycle: { start: number; end: number },
) {
  const cycleStart = cycle.start * 1000;
  const previous = await tx.quotaPeriod.findFirst({
    where: { projectId, isCurrent: true },
  });
  if (
    !previous ||
    previous.kind !== "active" ||
    !previous.key.startsWith(`cycle:${subscriptionId}:`) ||
    previous.startsAt.getTime() >= cycleStart ||
    // Doit s’achever au début du nouveau cycle (tolérance d’une heure) :
    // une période plus ancienne ne se rouvre pas.
    previous.endsAt.getTime() < cycleStart - 3600000
  )
    return;
  const graceEnd = new Date(
    Math.min(cycleStart + RENEWAL_GRACE_MS, cycle.end * 1000),
  );
  if (previous.endsAt >= graceEnd) return;
  await tx.quotaPeriod.update({
    where: { id: previous.id },
    data: { endsAt: graceEnd },
  });
}

/** État d'un abonnement, commun à tous les fournisseurs. Dates en secondes Unix. */
export type SubscriptionState = {
  provider: BillingProvider;
  id: string;
  customerId: string;
  /** Statut brut du fournisseur, conservé pour l'affichage et les e-mails. */
  providerStatus: string;
  status: ReturnType<typeof subscriptionStatus>;
  plan: ReturnType<typeof planForPrice>;
  priceId: string;
  metadataProjectId?: string;
  startsAt: number;
  endsAt: number;
  cycle: { start: number; end: number };
  paidCycle: boolean;
  renewalPending: boolean;
};

// The caller retrieves the current subscription with latest_invoice expanded.
export async function syncSubscription(
  prisma: PrismaClient,
  sub: Stripe.Subscription,
  eventCreated: number,
  fallbackProjectId?: string,
  expectedRevision?: number,
) {
  const item = sub.items.data[0];
  if (!item || sub.items.data.length !== 1)
    throw new Error("UNSUPPORTED_SUBSCRIPTION_ITEMS");
  const status = subscriptionStatus(sub.status);
  const plan = planForPrice(item.price.id);
  const invoice =
    sub.latest_invoice && typeof sub.latest_invoice !== "string"
      ? sub.latest_invoice
      : null;
  const trial = status === "trialing";
  const invoiceCoversCycle =
    !!invoice &&
    invoice.lines.data.some(
      (line) =>
        line.period.start === item.current_period_start &&
        line.period.end === item.current_period_end &&
        line.pricing?.price_details?.price === item.price.id,
    );
  const paidCycle =
    status === "active" && invoice?.status === "paid" && invoiceCoversCycle;
  // Renouvellement : Stripe avance la période avant d’encaisser la facture
  // (brouillon ~1 h, puis paiement). Tant qu’elle est en cours d’encaissement,
  // l’accès payé précédent est prolongé brièvement, sans réinitialiser le quota.
  const renewalPending =
    sub.status === "active" &&
    !paidCycle &&
    invoiceCoversCycle &&
    (invoice?.status === "draft" || invoice?.status === "open");
  await applySubscriptionState(
    prisma,
    {
      provider: "stripe",
      id: sub.id,
      customerId:
        typeof sub.customer === "string" ? sub.customer : sub.customer.id,
      providerStatus: sub.status,
      status,
      plan,
      priceId: item.price.id,
      metadataProjectId: sub.metadata.projectId,
      startsAt: trial ? sub.trial_start || 0 : item.current_period_start,
      endsAt: trial ? sub.trial_end || 0 : item.current_period_end,
      cycle: { start: item.current_period_start, end: item.current_period_end },
      paidCycle,
      renewalPending,
    },
    eventCreated,
    fallbackProjectId,
    expectedRevision,
  );
}

// Stable period keys preserve consumption on duplicate/reordered provider events.
export async function applySubscriptionState(
  prisma: PrismaClient,
  sub: SubscriptionState,
  eventCreated: number,
  fallbackProjectId?: string,
  expectedRevision?: number,
) {
  const { status, plan, paidCycle, renewalPending } = sub;
  const project = await prisma.project.findUnique({
    where: { stripeSubscriptionId: sub.id },
    select: { id: true },
  });
  const projectId = project?.id || sub.metadataProjectId || fallbackProjectId;
  if (!projectId) return;
  const trial = status === "trialing";
  const startsAt = new Date(sub.startsAt * 1000);
  const endsAt = new Date(sub.endsAt * 1000);
  const mayOpen = trial || paidCycle;
  if (mayOpen && (!startsAt.getTime() || endsAt <= startsAt))
    throw new Error("INVALID_BILLING_PERIOD");
  const limit = trial ? 150 : mayOpen ? paidMessageLimit(plan) : undefined;
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
    const current = await tx.project.findUnique({ where: { id: projectId } });
    if (!current) throw new Error("BILLING_PROJECT_MISSING");
    // A background retrieval must not overwrite a webhook applied meanwhile.
    if (
      expectedRevision !== undefined &&
      current.billingRevision !== expectedRevision
    )
      return;
    // Un nouvel abonnement Polar ne remplace qu'un abonnement déjà terminé.
    const replacesEnded =
      sub.provider === "polar" &&
      status !== "inactive" &&
      ["canceled", "unpaid", "incomplete_expired"].includes(
        current.stripeStatus ?? "",
      );
    if (
      current.stripeSubscriptionId &&
      current.stripeSubscriptionId !== sub.id &&
      !replacesEnded
    )
      return;
    if (eventCreated < current.billingEventCreated) return;
    await tx.project.update({
      where: { id: projectId },
      data: {
        status: current.automationPaused ? "paused" : status,
        statusBeforePause: current.automationPaused ? status : null,
        plan,
        billingProvider: sub.provider,
        stripeSubscriptionId: sub.id,
        stripeCustomerId: sub.customerId,
        stripePriceId: sub.priceId,
        // Polar peut ne plus donner de fin de période sur un abonnement terminé.
        ...(sub.endsAt ? { stripeCurrentPeriodEnd: endsAt } : {}),
        expiredAt: trial ? endsAt : null,
        billingEventCreated: eventCreated,
        billingRevision: { increment: 1 },
        stripeStatus: sub.providerStatus,
      },
    });
    if (renewalPending) {
      await extendPaidPeriodDuringRenewal(tx, projectId, sub.id, sub.cycle);
      return;
    }
    if (!mayOpen || limit === undefined) return;
    const key = trial
      ? `trial:${sub.id}`
      : `cycle:${sub.id}:${sub.cycle.start}`;
    const period = await tx.quotaPeriod.findUnique({
      where: { projectId_key: { projectId, key } },
    });
    const active = await tx.quotaPeriod.findFirst({
      where: { projectId, isCurrent: true },
    });
    if (active && active.startsAt > startsAt) return;
    // A legacy period must be explicitly reconciled; never reset it implicitly.
    if (
      !period &&
      active?.key.startsWith("bootstrap:") &&
      active.startsAt <= startsAt &&
      active.endsAt > startsAt
    ) {
      throw new Error("BOOTSTRAP_PERIOD_REQUIRES_RECONCILIATION");
    }
    await tx.quotaPeriod.updateMany({
      where: { projectId, isCurrent: true },
      data: { isCurrent: false },
    });
    const quota = period
      ? await tx.quotaPeriod.update({
          where: { id: period.id },
          data: { isCurrent: true, startsAt, endsAt, limit },
        })
      : await tx.quotaPeriod.create({
          data: {
            projectId,
            key,
            kind: trial ? "trialing" : "active",
            startsAt,
            endsAt,
            limit,
          },
        });
    await tx.project.update({
      where: { id: projectId },
      data: { messageCount: quota.used, allMessagesCount: quota.limit },
    });
  });
}
