import type { Prisma } from "../src/generated/prisma/client";
import { can } from "./project-permissions";
import { planRank, type PlanId } from "./pricing";
import type { PolarProrationBehavior } from "./polar";

export type PlanChange = {
  kind: "trial" | "upgrade" | "downgrade";
  proration: PolarProrationBehavior;
};

/**
 * Facturation d'un changement d'offre :
 * - pendant l'essai, rien n'est prélevé : la nouvelle offre s'applique à la fin
 *   de l'essai, le quota d'essai ne change pas ;
 * - offre supérieure : effet immédiat, différence au prorata prélevée tout de
 *   suite (sinon : monter, consommer le quota, redescendre avant l'échéance) ;
 * - offre inférieure : au prochain renouvellement, la période payée reste acquise.
 */
export function planChange(
  status: string,
  from: PlanId,
  to: PlanId,
): PlanChange | null {
  if (from === to) return null;
  if (status === "trialing") return { kind: "trial", proration: "prorate" };
  return planRank(to) > planRank(from)
    ? { kind: "upgrade", proration: "invoice" }
    : { kind: "downgrade", proration: "next_period" };
}

const normalizeEmail = (value: unknown) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";

/** Le compte connecté est-il le titulaire du moyen de paiement (client Polar) ? */
export function isPaymentHolder(userEmail: unknown, customerEmail: unknown) {
  const user = normalizeEmail(userEmail);
  return !!user && user === normalizeEmail(customerEmail);
}

/** « r•••@gmail.com » : désigne le titulaire sans exposer son adresse. */
export function maskEmail(email: string) {
  const [local = "", domain = ""] = email.trim().split("@");
  if (!local || !domain) return "un autre compte";
  return `${local[0]}•••@${domain}`;
}

/**
 * Le titulaire du moyen de paiement a-t-il encore les droits de facturation
 * sur ce projet ? Après un transfert de propriété, l'abonnement reste payé par
 * l'ancien propriétaire : on ne modifie pas ce qu'il paie sans lui.
 */
export async function holderManagesBilling(
  tx: Prisma.TransactionClient,
  projectId: string,
  customerEmail: string,
) {
  const email = normalizeEmail(customerEmail);
  if (!email) return false;
  const membership = await tx.projectMembership.findFirst({
    where: {
      projectId,
      user: { email: { equals: email, mode: "insensitive" } },
    },
    select: { role: true },
  });
  return !!membership && can(membership.role, "billing.manage");
}
