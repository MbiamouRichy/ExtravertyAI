import type { PrismaClient } from "../src/generated/prisma/client";
import {
  applySubscriptionState,
  subscriptionStatus,
  type SubscriptionState,
} from "./billing-quota";
import { polarProductId, type PolarSubscription } from "./polar";
import { PRICING_PLANS } from "./pricing";

const seconds = (value: string | null) =>
  value ? Math.floor(new Date(value).getTime() / 1000) : 0;

export function planForPolarProduct(productId: string) {
  const plan = PRICING_PLANS.find(({ id }) => polarProductId(id) === productId);
  if (!plan) throw new Error("UNKNOWN_POLAR_PRODUCT");
  return plan.id;
}

// Polar passe en past_due dès l'échec du prélèvement : contrairement à Stripe,
// il n'expose pas de facture en cours d'encaissement à attendre.
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
    provider: "polar",
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
    renewalPending: false,
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
}
