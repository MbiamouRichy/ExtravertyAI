import type { PrismaClient } from "../src/generated/prisma/client";

/**
 * Message à montrer quand ce compte a déjà un projet sur ce numéro, sinon null.
 * Vérifié avant d’envoyer le code, puis de nouveau à l’enregistrement.
 */
export async function ownProjectNumberConflict(
  db: Pick<PrismaClient, "project">,
  userId: string,
  numero: string,
) {
  const existing = await db.project.findFirst({
    where: { numero, members: { some: { userId } } },
    select: { name: true, stripeSubscriptionId: true },
  });
  if (!existing) return null;
  return existing.stripeSubscriptionId
    ? "Ce numéro WhatsApp est déjà configuré sur l'un de vos projets."
    : `Ce numéro est déjà associé au projet « ${existing.name} », dont le paiement n’est pas terminé. Ouvrez sa facturation pour reprendre le paiement.`;
}
