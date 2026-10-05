import { createHash, randomUUID } from "node:crypto";
import type Stripe from "stripe";
import type {
  BillingEmail,
  PrismaClient,
} from "../src/generated/prisma/client";
import { getBillingAccess, formatBillingDate } from "./billing-access";
import { syncSubscription } from "./billing-quota";

export type BillingEmailConfig = { from: string; origin: string };
export type BillingSender = (email: BillingEmail) => Promise<string>;
type RetrieveSubscription = (id: string) => Promise<Stripe.Subscription>;
const DAY = 86400000;

export function billingEmailConfig(): BillingEmailConfig {
  const origin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? "");
  if (
    origin.username ||
    origin.password ||
    (origin.protocol !== "https:" &&
      !(
        origin.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(origin.hostname)
      ))
  )
    throw new Error("BILLING_ORIGIN_INVALID");
  const from =
    process.env.BILLING_EMAIL_FROM ||
    "ExtravertyAI <notification@extravertyai.com>";
  if (!from.includes("@") || /[\r\n]/.test(from))
    throw new Error("BILLING_SENDER_INVALID");
  return { from, origin: origin.origin };
}

// A separate outbox entry per owner and deadline. The payload is immutable so that
// every retry uses exactly the same Resend idempotency key AND request body.
export async function queueBillingEmails(
  prisma: PrismaClient,
  projectId: string,
  config: BillingEmailConfig,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
    const project = await tx.project.findUnique({
      where: { id: projectId },
      include: {
        quotaPeriods: {
          where: { isCurrent: true },
          orderBy: { startsAt: "desc" },
          take: 1,
        },
        members: {
          where: { role: "OWNER" },
          select: { userId: true, user: { select: { email: true } } },
        },
      },
    });
    if (!project || project.deletionPending) return;
    const period = project.quotaPeriods[0];
    if (!period) return; // Checkout has not yet granted any access.
    const access = await getBillingAccess(tx, projectId);
    const [{ now }] = await tx.$queryRaw<
      Array<{ now: Date }>
    >`SELECT clock_timestamp() AS now`;
    const reminder =
      access.reason === "trialing" &&
      period.endsAt.getTime() - now.getTime() <= 3 * DAY;
    const ended =
      !access.allowed &&
      (period.endsAt <= now ||
        [
          "past_due",
          "unpaid",
          "canceled",
          "paused",
          "incomplete_expired",
        ].includes(project.stripeStatus ?? ""));
    if (!reminder && !ended) return;
    const kind = reminder ? "trial_ending" : "access_ended";
    const title = reminder
      ? "Votre essai se termine bientôt"
      : access.reason === "payment_failed"
        ? "Votre paiement nécessite une intervention"
        : period.kind === "trialing"
          ? "Votre essai est terminé"
          : "Votre abonnement nécessite une intervention";
    const name = project.name.replace(/[\r\n]/g, " ").slice(0, 160);
    const text = [
      "Bonjour,",
      `Vous recevez cet email en tant que propriétaire du projet « ${name} ».`,
      reminder
        ? `Votre essai se termine le ${formatBillingDate(period.endsAt)}. Consultez votre abonnement pour vérifier le renouvellement, votre carte ou une éventuelle résiliation.`
        : `La période d’accès du projet se termine le ${formatBillingDate(period.endsAt)}. ${access.message}`,
      reminder
        ? "Sans paiement confirmé à cette échéance, les envois et les fonctions IA seront suspendus. Votre historique restera accessible."
        : "Si vous venez de régler votre facture, la reprise se fera après confirmation du paiement. Cet email décrit la situation au moment de sa préparation.",
      `Consulter la facturation : ${config.origin}/projects/${encodeURIComponent(project.id)}/billing`,
      "L’équipe ExtravertyAI",
    ].join("\n\n");
    for (const owner of project.members) {
      const recipientHash = createHash("sha256")
        .update(owner.user.email)
        .digest("hex")
        .slice(0, 24);
      // Include endsAt so extending a trial creates a new, legitimate reminder.
      const key = `${period.id}:${period.endsAt.getTime()}:${kind}:${owner.userId}:${recipientHash}`;
      await tx.billingEmail.upsert({
        where: { key },
        update: {},
        create: {
          key,
          projectId,
          kind,
          periodId: period.id,
          recipientId: owner.userId,
          recipient: owner.user.email,
          from: config.from,
          subject: `${title} — ${name}`,
          text,
        },
      });
    }
  });
}

// Claims are durable, bounded and fair, even with multiple billing workers.
export async function reconcileNextBillingProject(
  prisma: PrismaClient,
  retrieve: RetrieveSubscription,
  config: BillingEmailConfig,
) {
  const [candidate] = await prisma.$queryRaw<Array<{ id: string }>>`
    WITH candidate AS (
      SELECT id FROM project WHERE NOT "deletionPending"
        AND "billingNextCheckAt" <= clock_timestamp()
        AND ("stripeSubscriptionId" IS NOT NULL OR EXISTS (
          SELECT 1 FROM quota_period q WHERE q."projectId" = project.id AND q."isCurrent"))
      ORDER BY "billingNextCheckAt", id LIMIT 1 FOR UPDATE SKIP LOCKED
    )
    UPDATE project p SET "billingNextCheckAt" = clock_timestamp() + interval '5 minutes'
      FROM candidate c WHERE p.id = c.id RETURNING p.id`;
  if (!candidate) return null;
  const project = await prisma.project.findUnique({
    where: { id: candidate.id },
  });
  if (!project || project.deletionPending) return candidate.id;
  if (project.stripeSubscriptionId) {
    try {
      const sub = await retrieve(project.stripeSubscriptionId);
      // Never invent a newer Stripe event timestamp: preserve the webhook watermark.
      await syncSubscription(
        prisma,
        sub,
        project.billingEventCreated,
        project.id,
        project.billingRevision,
      );
    } catch {
      // Local expiry remains enforceable during a Stripe outage.
      console.error("[billing-worker] Synchronisation à réessayer.", {
        projectId: project.id,
      });
    }
  }
  await queueBillingEmails(prisma, project.id, config);
  return project.id;
}

export async function deliverNextBillingEmail(
  prisma: PrismaClient,
  send: BillingSender,
) {
  const token = randomUUID();
  const email = await prisma.$transaction(async (tx) => {
    // Resend deduplicates for 24h. Never retry an uncertain send beyond 23h.
    const review = await tx.$executeRaw`UPDATE billing_email
      SET state = 'REVIEW_REQUIRED', "leaseToken" = NULL, "leaseUntil" = NULL
      WHERE state IN ('PENDING', 'SENDING')
        AND "firstAttemptAt" < clock_timestamp() - interval '23 hours'
        AND ("leaseUntil" IS NULL OR "leaseUntil" <= clock_timestamp())`;
    if (review)
      console.error("[billing-worker] Emails à vérifier manuellement.", {
        count: review,
      });
    const [candidate] = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM billing_email
      WHERE (state = 'PENDING' AND "availableAt" <= clock_timestamp())
        OR (state = 'SENDING' AND "leaseUntil" <= clock_timestamp())
      ORDER BY "availableAt", id LIMIT 1 FOR UPDATE SKIP LOCKED`;
    if (!candidate) return null;
    const record = await tx.billingEmail.findUniqueOrThrow({
      where: { id: candidate.id },
    });
    const owner = await tx.projectMembership.findUnique({
      where: {
        userId_projectId: {
          userId: record.recipientId,
          projectId: record.projectId,
        },
      },
      select: {
        role: true,
        user: { select: { email: true } },
        project: { select: { deletionPending: true } },
      },
    });
    const access = await getBillingAccess(tx, record.projectId);
    const period = await tx.quotaPeriod.findFirst({
      where: { projectId: record.projectId, isCurrent: true },
      orderBy: { startsAt: "desc" },
    });
    const [{ now }] = await tx.$queryRaw<
      Array<{ now: Date }>
    >`SELECT clock_timestamp() AS now`;
    const relevant =
      owner?.role === "OWNER" &&
      !owner.project.deletionPending &&
      owner.user.email === record.recipient &&
      period?.id === record.periodId &&
      record.key.startsWith(`${period.id}:${period.endsAt.getTime()}:`) &&
      (record.kind === "trial_ending"
        ? access.reason === "trialing" &&
          period.endsAt.getTime() - now.getTime() <= 3 * DAY
        : !access.allowed);
    if (!relevant) {
      await tx.billingEmail.update({
        where: { id: record.id },
        data: {
          state: "CANCELLED",
          leaseToken: null,
          leaseUntil: null,
        },
      });
      return { cancelled: true as const };
    }
    return tx.billingEmail.update({
      where: { id: record.id },
      data: {
        state: "SENDING",
        leaseToken: token,
        leaseUntil: new Date(now.getTime() + 120000),
        firstAttemptAt: record.firstAttemptAt ?? now,
        attempts: { increment: 1 },
      },
    });
  });
  if (!email) return false;
  if ("cancelled" in email) return true;
  try {
    const providerId = await send(email);
    await prisma.billingEmail.updateMany({
      where: { id: email.id, state: "SENDING", leaseToken: token },
      data: {
        state: "SENT",
        providerId,
        sentAt: new Date(),
        leaseToken: null,
        leaseUntil: null,
      },
    });
  } catch {
    // Identical payload and key on retry cover a lost provider response or DB ack.
    await prisma.$executeRaw`UPDATE billing_email
      SET state = 'PENDING', "leaseToken" = NULL, "leaseUntil" = NULL,
        "availableAt" = clock_timestamp() + (${Math.min(3600, 30 * 2 ** Math.min(email.attempts, 7))} * interval '1 second')
      WHERE id = ${email.id} AND state = 'SENDING' AND "leaseToken" = ${token}`;
    console.error("[billing-worker] Email à réessayer.", { emailId: email.id });
  }
  return true;
}
