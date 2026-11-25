import type { PrismaClient } from "../src/generated/prisma/client";
import { syncPolarSubscription } from "./billing-polar";
import {
  PolarApiError,
  endPolarTrialNow,
  getPolarSubscription,
  type PolarSubscription,
} from "./polar";

/**
 * Essai de TRIAL_DAYS jours ou TRIAL_MESSAGES messages : le premier des deux
 * atteint le termine. Quand un essai ouvert sous ces conditions
 * (`endsOnQuota`) a utilisé tout son quota, le worker de facturation demande
 * à Polar de le terminer : le premier mois est prélevé sur la carte donnée au
 * paiement initial, et le cycle payé s'ouvre (relecture ci-dessous, puis
 * webhook).
 *
 * Jamais deux prélèvements :
 * - une seule demande à la fois par essai (verrou SKIP LOCKED, puis bail) ;
 * - l'état est relu chez Polar avant chaque demande : un essai déjà terminé,
 *   ou une réponse perdue après un prélèvement réussi, n'est jamais redemandé ;
 * - un essai résilié par le client n'est jamais prélevé ;
 * - une carte refusée n'est pas représentée automatiquement : seul un
 *   gestionnaire de la facturation relance, depuis la page Facturation.
 */

export const TRIAL_END_STATUSES = [
  "PENDING",
  "REQUESTING",
  "DONE",
  "PAYMENT_FAILED",
  "CANCELLED",
  "FAILED",
] as const;
export type TrialEndStatus = (typeof TRIAL_END_STATUSES)[number];

/** Tentatives au plus après une erreur passagère (réseau, Polar indisponible). */
export const TRIAL_END_MAX_ATTEMPTS = 8;
/** Bail d'une demande en cours : un worker arrêté en plein appel est relayé ensuite. */
export const TRIAL_END_LEASE_SECONDS = 600;
/** Délai minimal entre deux relances demandées depuis la page Facturation. */
export const TRIAL_END_MANUAL_RETRY_SECONDS = 60;
/** Essai résilié : revérifié à ce rythme, au cas où le client le réactive. */
export const TRIAL_END_CANCELLED_RECHECK_SECONDS = 900;

export type TrialEndDeps = {
  retrieve: (id: string) => Promise<PolarSubscription>;
  endTrial: (id: string) => Promise<PolarSubscription>;
};

const POLAR: TrialEndDeps = { retrieve: getPolarSubscription, endTrial: endPolarTrialNow };

/** Attente avant la tentative suivante : 2, 4, 8… minutes, une heure au plus. */
export function trialEndRetryDelaySeconds(attempts: number) {
  return Math.min(3600, 60 * 2 ** Math.min(Math.max(attempts, 1), 6));
}

type Outcome =
  | { status: "DONE" | "PAYMENT_FAILED" | "FAILED" }
  | { status: "PENDING" | "CANCELLED"; retryInSeconds: number };

type Claim = { id: string; projectId: string; key: string; trialEndAttempts: number };

function retryLater(attempts: number): Outcome {
  return attempts >= TRIAL_END_MAX_ATTEMPTS
    ? { status: "FAILED" }
    : { status: "PENDING", retryInSeconds: trialEndRetryDelaySeconds(attempts) };
}

/**
 * Traite au plus un essai épuisé. Renvoie le projet concerné (pour notifier
 * l'interface) et l'issue, ou null s'il n'y avait rien à faire.
 */
export async function endNextExhaustedTrial(
  prisma: PrismaClient,
  deps: TrialEndDeps = POLAR,
): Promise<{ projectId: string; status: TrialEndStatus } | null> {
  const [claim] = await prisma.$queryRaw<Claim[]>`
    WITH candidate AS (
      SELECT q.id FROM quota_period q
      JOIN project p ON p.id = q."projectId"
      WHERE q."endsOnQuota" AND q."isCurrent" AND q.kind = 'trialing'
        AND q.used >= q."limit"
        AND (q."trialEndStatus" IS NULL
          OR (q."trialEndStatus" IN ('PENDING', 'REQUESTING', 'CANCELLED')
            AND q."trialEndDueAt" <= clock_timestamp()))
        AND NOT p."deletionPending" AND NOT p.internal
      ORDER BY q."trialEndDueAt" NULLS FIRST, q.id
      LIMIT 1 FOR UPDATE OF q SKIP LOCKED
    )
    UPDATE quota_period q SET "trialEndStatus" = 'REQUESTING',
      "trialEndDueAt" = clock_timestamp() + (${TRIAL_END_LEASE_SECONDS}::int * interval '1 second'),
      "trialEndAttempts" = q."trialEndAttempts" + 1,
      "updatedAt" = clock_timestamp()
    FROM candidate c WHERE q.id = c.id
    RETURNING q.id, q."projectId", q.key, q."trialEndAttempts"`;
  if (!claim) return null;
  let outcome: Outcome;
  try {
    outcome = await requestTrialEnd(prisma, claim, deps);
  } catch {
    // Réponse perdue, base ou Polar indisponible : la tentative suivante relit tout.
    console.error("[billing] Fin d'essai à réessayer.", { projectId: claim.projectId });
    outcome = retryLater(claim.trialEndAttempts);
  }
  const delay = "retryInSeconds" in outcome ? outcome.retryInSeconds : 0;
  // Un essai résilié ne compte pas de tentatives : s'il est réactivé, la
  // demande repart avec toutes ses tentatives.
  const attempts = outcome.status === "CANCELLED" ? 0 : claim.trialEndAttempts;
  await prisma.$executeRaw`UPDATE quota_period SET "trialEndStatus" = ${outcome.status},
    "trialEndDueAt" = CASE WHEN ${delay}::int > 0
      THEN clock_timestamp() + (${delay}::int * interval '1 second') ELSE NULL END,
    "trialEndAttempts" = ${attempts}::int,
    "updatedAt" = clock_timestamp()
    WHERE id = ${claim.id} AND "trialEndStatus" = 'REQUESTING'`;
  if (outcome.status === "PAYMENT_FAILED" || outcome.status === "FAILED")
    console.error("[billing] Essai épuisé non transformé en abonnement.", {
      projectId: claim.projectId,
      status: outcome.status,
    });
  return { projectId: claim.projectId, status: outcome.status };
}

async function requestTrialEnd(
  prisma: PrismaClient,
  claim: Claim,
  deps: TrialEndDeps,
): Promise<Outcome> {
  const project = await prisma.project.findUnique({
    where: { id: claim.projectId },
    select: {
      id: true,
      stripeSubscriptionId: true,
      billingEventCreated: true,
      billingRevision: true,
      deletionPending: true,
      internal: true,
    },
  });
  // La période d'essai porte l'abonnement qui l'a ouverte (« trial:<id> ») :
  // jamais de demande pour un autre abonnement que celui du projet.
  const subscriptionId = claim.key.startsWith("trial:") ? claim.key.slice("trial:".length) : "";
  if (
    !project ||
    project.deletionPending ||
    project.internal ||
    !subscriptionId ||
    project.stripeSubscriptionId !== subscriptionId
  )
    return { status: "FAILED" };
  // Même filigrane que la relecture du worker : jamais d'événement inventé.
  const apply = (sub: PolarSubscription) =>
    syncPolarSubscription(
      prisma,
      sub,
      project.billingEventCreated,
      project.id,
      project.billingRevision,
    );

  const current = await deps.retrieve(subscriptionId);
  if (current.id !== subscriptionId) return { status: "FAILED" };
  if (current.status !== "trialing") {
    // Déjà prélevé (réponse perdue, fin d'essai normale) ou terminé : rien à demander.
    await apply(current);
    return { status: "DONE" };
  }
  // Le client a résilié pendant l'essai : il ne paiera rien.
  if (current.cancel_at_period_end)
    return { status: "CANCELLED", retryInSeconds: TRIAL_END_CANCELLED_RECHECK_SECONDS };

  let ended: PolarSubscription;
  try {
    ended = await deps.endTrial(subscriptionId);
  } catch (error) {
    if (error instanceof PolarApiError) {
      // Carte refusée ou authentification demandée : l'essai continue chez Polar.
      if (error.status === 402) return { status: "PAYMENT_FAILED" };
      // Refus définitif (abonnement introuvable, demande invalide) : support.
      if (error.status < 500 && ![403, 409, 429].includes(error.status))
        return { status: "FAILED" };
    }
    return retryLater(claim.trialEndAttempts);
  }
  // Toujours en essai sans erreur : état incertain, relu à la tentative suivante.
  if (ended.status === "trialing") return retryLater(claim.trialEndAttempts);
  await apply(ended);
  await prisma.project.update({
    where: { id: project.id },
    data: { billingNextCheckAt: new Date() },
  });
  return { status: "DONE" };
}

/**
 * Essai résilié puis réactivé : la demande repart tout de suite, sans attendre
 * la revérification suivante. Ne prélève rien lui-même (le worker relit Polar).
 */
export async function requeueCancelledTrialEnd(
  prisma: Pick<PrismaClient, "$executeRaw">,
  projectId: string,
) {
  await prisma.$executeRaw`UPDATE quota_period SET "trialEndStatus" = 'PENDING',
    "trialEndDueAt" = clock_timestamp(), "trialEndAttempts" = 0, "updatedAt" = clock_timestamp()
    WHERE "projectId" = ${projectId} AND "isCurrent" AND kind = 'trialing'
      AND "endsOnQuota" AND "trialEndStatus" = 'CANCELLED'`;
}

/** Ce que la page Facturation montre d'un essai épuisé, ou null. */
export type TrialEndView = "processing" | "payment_failed" | "failed" | "cancelled";

export function trialEndView(
  period:
    | {
        kind: string;
        endsOnQuota: boolean;
        used: number;
        limit: number;
        trialEndStatus: string | null;
      }
    | null
    | undefined,
): TrialEndView | null {
  if (!period || period.kind !== "trialing" || !period.endsOnQuota || period.used < period.limit)
    return null;
  switch (period.trialEndStatus) {
    case "PAYMENT_FAILED":
      return "payment_failed";
    case "FAILED":
      return "failed";
    case "CANCELLED":
      return "cancelled";
    default:
      return "processing";
  }
}
