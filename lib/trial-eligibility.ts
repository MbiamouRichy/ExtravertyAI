import { createHmac } from "node:crypto";
import type { Prisma, PrismaClient } from "../src/generated/prisma/client";

/**
 * Un seul essai gratuit par numéro WhatsApp professionnel.
 *
 * - Le numéro n'est jamais conservé en clair : empreinte HMAC (secret serveur),
 *   qui survit à la suppression du projet et du compte.
 * - Ouvrir un paiement avec essai réserve le numéro pour ce projet, le temps
 *   du checkout : deux comptes ne peuvent pas lancer deux essais en parallèle.
 * - L'essai est consommé quand l'abonnement passe réellement en essai.
 */
export const TRIAL_RESERVATION_MS = 60 * 60 * 1000;

type Db = PrismaClient | Prisma.TransactionClient;

function secret() {
  const value = process.env.BETTER_AUTH_SECRET;
  if (!value) throw new Error("BETTER_AUTH_SECRET_MISSING");
  return value;
}

/** Chiffres E.164 seuls : « +241 66 00 00 01 » et « 24166000001 » se valent. */
export function trialNumberDigits(numero: string) {
  const digits = numero.replace(/\D/g, "");
  if (!/^[1-9]\d{7,14}$/.test(digits)) throw new Error("TRIAL_NUMBER_INVALID");
  return digits;
}

export function hashTrialNumber(numero: string) {
  return createHmac("sha256", secret())
    .update(`trial-number:${trialNumberDigits(numero)}`)
    .digest("hex");
}

/** Lecture seule : l'essai est-il encore possible pour ce numéro ? */
export async function isTrialAvailable(
  db: Db,
  numero: string,
  projectId?: string,
) {
  const claim = await db.trialClaim.findUnique({
    where: { numberHash: hashTrialNumber(numero) },
    select: { projectId: true, reservedUntil: true, consumedAt: true },
  });
  if (!claim) return true;
  if (claim.consumedAt) return false;
  if (projectId && claim.projectId === projectId) return true;
  return !claim.reservedUntil || claim.reservedUntil.getTime() <= Date.now();
}

/**
 * Réserve l'essai pour ce projet, de façon atomique. Renvoie false si le numéro
 * a déjà eu un essai, ou si un autre projet a un paiement avec essai en cours.
 */
export async function reserveTrial(db: Db, numero: string, projectId: string) {
  const numberHash = hashTrialNumber(numero);
  // Horloge passée en paramètre : les colonnes sont sans fuseau (UTC via Prisma).
  const now = new Date();
  const until = new Date(now.getTime() + TRIAL_RESERVATION_MS);
  const rows = await db.$queryRaw<Array<{ numberHash: string }>>`
    INSERT INTO "trial_claim" ("numberHash", "projectId", "reservedUntil", "createdAt", "updatedAt")
    VALUES (${numberHash}, ${projectId}, ${until}, ${now}, ${now})
    ON CONFLICT ("numberHash") DO UPDATE
      SET "projectId" = EXCLUDED."projectId",
          "reservedUntil" = EXCLUDED."reservedUntil",
          "updatedAt" = ${now}
      WHERE "trial_claim"."consumedAt" IS NULL
        AND (
          "trial_claim"."projectId" = EXCLUDED."projectId"
          OR "trial_claim"."reservedUntil" IS NULL
          OR "trial_claim"."reservedUntil" <= ${now}
        )
    RETURNING "numberHash"
  `;
  return rows.length > 0;
}

/**
 * Marque l'essai comme consommé. Idempotent pour un même abonnement. Un second
 * essai sur le même numéro (checkout payé après l'expiration de sa réservation)
 * est signalé : le fournisseur l'a déjà accordé, il ne peut pas être annulé ici.
 */
export async function consumeTrial(
  db: Db,
  input: { numero: string; projectId: string; subscriptionId: string },
) {
  // Numéro hérité illisible : ne jamais bloquer la synchronisation du paiement.
  if (!/^[1-9]\d{7,14}$/.test(input.numero.replace(/\D/g, ""))) {
    console.warn("TRIAL_NUMBER_UNREADABLE", { projectId: input.projectId });
    return;
  }
  // Même règle si le secret manque sur un worker : la facturation passe d'abord.
  // La réservation faite au paiement garde déjà le numéro pendant une heure.
  if (!process.env.BETTER_AUTH_SECRET) {
    console.error("TRIAL_CLAIM_SKIPPED_SECRET_MISSING", {
      projectId: input.projectId,
    });
    return;
  }
  const numberHash = hashTrialNumber(input.numero);
  const now = new Date();
  const rows = await db.$queryRaw<Array<{ subscriptionId: string | null }>>`
    INSERT INTO "trial_claim" ("numberHash", "projectId", "subscriptionId", "consumedAt", "createdAt", "updatedAt")
    VALUES (${numberHash}, ${input.projectId}, ${input.subscriptionId}, ${now}, ${now}, ${now})
    ON CONFLICT ("numberHash") DO UPDATE
      SET "projectId" = EXCLUDED."projectId",
          "subscriptionId" = EXCLUDED."subscriptionId",
          "consumedAt" = ${now},
          "reservedUntil" = NULL,
          "updatedAt" = ${now}
      WHERE "trial_claim"."consumedAt" IS NULL
    RETURNING "subscriptionId"
  `;
  if (rows.length > 0) return;
  const claim = await db.trialClaim.findUnique({
    where: { numberHash },
    select: { subscriptionId: true },
  });
  if (claim?.subscriptionId !== input.subscriptionId)
    console.warn("TRIAL_NUMBER_REUSED", { projectId: input.projectId });
}
