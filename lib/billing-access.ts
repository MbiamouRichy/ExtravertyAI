import type { Prisma } from "../src/generated/prisma/client";
import { projectBillingStatus } from "./project-status";

export type BillingSnapshot = {
  status: string;
  automationPaused: boolean;
  statusBeforePause: string | null;
  deletionPending: boolean;
  stripeStatus: string | null;
  kind: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
};

export type BillingReason =
  | "active"
  | "trialing"
  | "trial_expired"
  | "payment_pending"
  | "payment_failed"
  | "inactive";

export function billingAccess(
  snapshot: BillingSnapshot | null,
  now: Date,
): {
  allowed: boolean;
  reason: BillingReason;
  message: string;
  endsAt: string | null;
  automationPaused: boolean;
} {
  const status = snapshot ? projectBillingStatus(snapshot) : "inactive";
  const valid =
    !!snapshot &&
    !snapshot.deletionPending &&
    ["active", "trialing"].includes(status) &&
    snapshot.kind === status &&
    !!snapshot.startsAt &&
    snapshot.startsAt <= now &&
    !!snapshot.endsAt &&
    snapshot.endsAt > now;
  const reason = valid
    ? status === "trialing"
      ? "trialing"
      : "active"
    : !snapshot || snapshot.deletionPending
      ? "inactive"
      : ["past_due", "unpaid"].includes(snapshot.stripeStatus ?? "")
        ? "payment_failed"
        : !["active", "trialing"].includes(status)
          ? "inactive"
          : snapshot.kind === "trialing" &&
              !!snapshot.endsAt &&
              snapshot.endsAt <= now
            ? "trial_expired"
            : "payment_pending";
  const messages = {
    active: "Votre abonnement est actif.",
    trialing:
      "Votre essai est en cours. Consultez la facturation pour vérifier la date de fin et le renouvellement.",
    trial_expired:
      "Votre essai est terminé. Les envois et les fonctions IA sont suspendus jusqu’à confirmation du paiement. Votre historique reste accessible.",
    payment_pending:
      "La période d’accès n’est pas confirmée. Les envois et les fonctions IA sont suspendus en attendant la confirmation du paiement. Consultez la facturation.",
    payment_failed:
      "Votre paiement est en retard ou a échoué. Les envois et les fonctions IA sont suspendus. Le propriétaire peut mettre à jour le moyen de paiement dans la facturation.",
    inactive:
      "L’abonnement ne permet plus les envois ni les fonctions IA. Votre historique reste accessible. Le propriétaire peut consulter la facturation.",
  };
  return {
    allowed: valid,
    reason,
    message: messages[reason],
    endsAt: snapshot?.endsAt?.toISOString() ?? null,
    automationPaused: snapshot?.automationPaused ?? false,
  };
}

// Same database clock as message admission. Callers authorize project membership.
export async function getBillingAccess(
  db: Prisma.TransactionClient,
  projectId: string,
) {
  const [snapshot] = await db.$queryRaw<Array<BillingSnapshot & { now: Date }>>`
    SELECT p.status::text, p."automationPaused", p."statusBeforePause"::text,
      p."deletionPending", p."stripeStatus", q.kind::text,
      q."startsAt", q."endsAt", clock_timestamp() AS now
    FROM project p LEFT JOIN LATERAL (
      SELECT kind, "startsAt", "endsAt" FROM quota_period
      WHERE "projectId" = p.id AND "isCurrent"
      ORDER BY "startsAt" DESC LIMIT 1
    ) q ON true WHERE p.id = ${projectId}`;
  return billingAccess(snapshot ?? null, snapshot?.now ?? new Date());
}

export function formatBillingDate(value: Date | string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value));
}

export function billingAccessLabel(access: ReturnType<typeof billingAccess>) {
  if (access.allowed && access.automationPaused)
    return "Automatisation en pause";
  return {
    active: "Actif",
    trialing: "En essai",
    trial_expired: "Essai terminé",
    payment_pending: "Paiement à confirmer",
    payment_failed: "Paiement à régulariser",
    inactive: "Abonnement suspendu ou terminé",
  }[access.reason];
}
