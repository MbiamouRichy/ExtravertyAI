import type { PrismaClient } from "../src/generated/prisma/client";
import type { PlanId } from "./pricing";
import { consumeTrial } from "./trial-eligibility";

export function subscriptionStatus(status: string) {
  if (status === "trialing") return "trialing" as const;
  if (status === "active") return "active" as const;
  if (["past_due", "unpaid", "paused"].includes(status))
    return "paused" as const;
  return "inactive" as const;
}

export function paidMessageLimit(plan: string) {
  const value = Number(process.env[`MESSAGE_LIMIT_${plan.toUpperCase()}`]);
  if (!Number.isSafeInteger(value) || value <= 0)
    throw new Error("PAID_MESSAGE_LIMIT_NOT_CONFIGURED");
  return value;
}

/** État d'un abonnement Polar, prêt à appliquer. Dates en secondes Unix. */
export type SubscriptionState = {
  id: string;
  customerId: string;
  /** Statut brut du fournisseur, conservé pour l'affichage et les e-mails. */
  providerStatus: string;
  status: ReturnType<typeof subscriptionStatus>;
  plan: PlanId;
  priceId: string;
  metadataProjectId?: string;
  startsAt: number;
  endsAt: number;
  cycle: { start: number; end: number };
  paidCycle: boolean;
};

// Stable period keys preserve consumption on duplicate/reordered provider events.
export async function applySubscriptionState(
  prisma: PrismaClient,
  sub: SubscriptionState,
  eventCreated: number,
  fallbackProjectId?: string,
  expectedRevision?: number,
) {
  const { status, plan, paidCycle } = sub;
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
    // Un nouvel abonnement ne remplace qu'un abonnement déjà terminé.
    const replacesEnded =
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
        // Colonne héritée, encore lue par les versions déjà déployées.
        billingProvider: "polar",
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
    // Un seul essai par numéro WhatsApp : consommé dès l’entrée en essai.
    if (trial)
      await consumeTrial(tx, {
        numero: current.numero,
        projectId,
        subscriptionId: sub.id,
      });
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
