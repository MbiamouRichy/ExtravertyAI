import type Stripe from "stripe";
import type { PrismaClient } from "../src/generated/prisma/client";

export function subscriptionStatus(status: Stripe.Subscription.Status) {
  if (status === "trialing") return "trialing" as const;
  if (status === "active") return "active" as const;
  if (["past_due", "unpaid", "paused"].includes(status))
    return "paused" as const;
  return "inactive" as const;
}

export function planForPrice(priceId: string) {
  const plans = ["starter", "pro", "business"] as const;
  const plan = plans.find(
    (p) => process.env[`STRIPE_${p.toUpperCase()}_PLAN_ID`] === priceId,
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

// The caller retrieves the current subscription with latest_invoice expanded.
// Stable period keys preserve consumption on duplicate/reordered Stripe events.
export async function syncSubscription(
  prisma: PrismaClient,
  sub: Stripe.Subscription,
  eventCreated: number,
  fallbackProjectId?: string,
) {
  const project = await prisma.project.findUnique({
    where: { stripeSubscriptionId: sub.id },
    select: { id: true },
  });
  const projectId = project?.id || sub.metadata.projectId || fallbackProjectId;
  if (!projectId) return;
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
  const startsAt = new Date(
    (trial ? sub.trial_start || 0 : item.current_period_start) * 1000,
  );
  const endsAt = new Date(
    (trial ? sub.trial_end || 0 : item.current_period_end) * 1000,
  );
  const paidCycle =
    status === "active" &&
    invoice?.status === "paid" &&
    invoice.lines.data.some(
      (line) =>
        line.period.start === item.current_period_start &&
        line.period.end === item.current_period_end &&
        line.pricing?.price_details?.price === item.price.id,
    );
  const mayOpen = trial || paidCycle;
  if (mayOpen && (!startsAt.getTime() || endsAt <= startsAt))
    throw new Error("INVALID_BILLING_PERIOD");
  const limit = trial ? 150 : mayOpen ? paidMessageLimit(plan) : undefined;
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
    const current = await tx.project.findUnique({ where: { id: projectId } });
    if (!current) throw new Error("BILLING_PROJECT_MISSING");
    if (current.stripeSubscriptionId && current.stripeSubscriptionId !== sub.id)
      return;
    if (eventCreated < current.billingEventCreated) return;
    await tx.project.update({
      where: { id: projectId },
      data: {
        status,
        plan,
        stripeSubscriptionId: sub.id,
        stripeCustomerId:
          typeof sub.customer === "string" ? sub.customer : sub.customer.id,
        stripePriceId: item.price.id,
        stripeCurrentPeriodEnd: endsAt,
        expiredAt: trial ? endsAt : null,
        billingEventCreated: eventCreated,
      },
    });
    if (!mayOpen || limit === undefined) return;
    const key = trial
      ? `trial:${sub.id}`
      : `cycle:${sub.id}:${item.current_period_start}`;
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
          data: { isCurrent: true },
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
