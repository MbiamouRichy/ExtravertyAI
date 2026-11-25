import type { PrismaClient } from "../src/generated/prisma/client";
import {
  applySubscriptionState,
  subscriptionStatus,
  type SubscriptionState,
} from "./billing-quota";
import { polarProductId, revokePolarSubscription, type PolarSubscription } from "./polar";
import { PRICING_PLANS } from "./pricing";

const seconds = (value: string | null) =>
  value ? Math.floor(new Date(value).getTime() / 1000) : 0;

export function planForPolarProduct(productId: string) {
  const plan = PRICING_PLANS.find(({ id }) => polarProductId(id) === productId);
  if (!plan) throw new Error("UNKNOWN_POLAR_PRODUCT");
  return plan.id;
}

// Polar passe en past_due dès l'échec du prélèvement : un cycle actif est payé.
export function polarSubscriptionState(
  sub: PolarSubscription,
): SubscriptionState {
  const status = subscriptionStatus(sub.status);
  const trial = status === "trialing";
  const cycle = {
    start: seconds(sub.current_period_start),
    end: seconds(sub.current_period_end),
  };
  const projectId = sub.metadata.projectId;
  return {
    id: sub.id,
    customerId: sub.customer_id,
    providerStatus: sub.status,
    status,
    plan: planForPolarProduct(sub.product_id),
    priceId: sub.product_id,
    metadataProjectId: typeof projectId === "string" ? projectId : undefined,
    startsAt: trial ? seconds(sub.trial_start) : cycle.start,
    endsAt: trial ? seconds(sub.trial_end) : cycle.end,
    cycle,
    paidCycle: status === "active",
  };
}

export async function syncPolarSubscription(
  prisma: PrismaClient,
  sub: PolarSubscription,
  eventCreated: number,
  fallbackProjectId?: string,
  expectedRevision?: number,
) {
  const metadataId = sub.metadata.projectId;
  const projectId =
    typeof metadataId === "string" ? metadataId : fallbackProjectId;
  // La suppression d'un projet révoque son abonnement : l'événement arrive après
  // la ligne. Réessayer un abonnement sans projet finirait par faire désactiver
  // le webhook par Polar après 10 échecs consécutifs.
  const project = await prisma.project.findFirst({
    where: {
      OR: [
        { stripeSubscriptionId: sub.id },
        ...(projectId ? [{ id: projectId }] : []),
      ],
    },
    select: { id: true },
  });
  if (!project) return;
  await applySubscriptionState(
    prisma,
    polarSubscriptionState(sub),
    eventCreated,
    fallbackProjectId,
    expectedRevision,
  );
  await revokeDuplicateTrial(prisma, sub);
}

const ENDED_STATUSES = ["canceled", "unpaid", "incomplete_expired"];

/**
 * Deux paiements initiaux ouverts en parallèle (deux onglets, retour arrière)
 * créent deux essais chez Polar pour le même projet. Le projet n'en garde
 * qu'un ; l'autre ne servirait à rien mais serait prélevé à la fin de son
 * essai. Il est donc révoqué tant qu'il est en essai, avant tout prélèvement.
 * Un abonnement déjà payé n'est jamais révoqué ici (remboursement : support).
 */
export async function revokeDuplicateTrial(
  prisma: Pick<PrismaClient, "project">,
  sub: PolarSubscription,
  revoke: (id: string) => Promise<void> = revokePolarSubscription,
) {
  const projectId = sub.metadata.projectId;
  if (typeof projectId !== "string") return false;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { stripeSubscriptionId: true, stripeStatus: true },
  });
  if (!project?.stripeSubscriptionId || project.stripeSubscriptionId === sub.id) return false;
  // L'abonnement rattaché est terminé : le nouveau le remplace (renouvellement).
  if (ENDED_STATUSES.includes(project.stripeStatus ?? "")) return false;
  if (sub.status !== "trialing") {
    if (sub.status === "active" || sub.status === "past_due")
      console.error("[billing] Second abonnement payé pour un même projet : à rembourser.", {
        projectId,
      });
    return false;
  }
  await revoke(sub.id);
  console.warn("[billing] Essai en double révoqué avant tout prélèvement.", { projectId });
  return true;
}
