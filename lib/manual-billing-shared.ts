import { z } from "zod";
import { PRICING_PLANS, type PlanId } from "./pricing";

/**
 * Paiements hors carte (Airtel Money, Moov Money, espèces, virement),
 * enregistrés par l'équipe dans le back-office. Module sans dépendance
 * serveur : le formulaire du back-office et le serveur partagent ces règles.
 *
 * Un paiement ouvre (ou prolonge) une période de quota « manual: » de type
 * « active » : l'accès suit alors exactement les mêmes règles qu'un mois payé
 * chez Polar (lib/billing-access.ts).
 */
export const MANUAL_PERIOD_PREFIX = "manual:";
/** Action du journal admin : la trace de chaque paiement (montant, moyen, référence). */
export const MANUAL_PAYMENT_ACTION = "billing.manual_payment";

export const MANUAL_PAYMENT_METHODS = [
  "airtel_money",
  "moov_money",
  "cash",
  "bank_transfer",
] as const;
export type ManualPaymentMethod = (typeof MANUAL_PAYMENT_METHODS)[number];

export const MANUAL_PAYMENT_METHOD_LABEL: Record<ManualPaymentMethod, string> = {
  airtel_money: "Airtel Money",
  moov_money: "Moov Money",
  cash: "Espèces",
  bank_transfer: "Virement bancaire",
};

/** Mobile money : l'identifiant de la transaction est exigé, pour rapprocher le relevé. */
export function requiresReference(method: ManualPaymentMethod) {
  return method === "airtel_money" || method === "moov_money";
}

export const MANUAL_PAYMENT_MONTHS = [1, 2, 3, 6, 12] as const;
export const MANUAL_AMOUNT_MIN = 100;
export const MANUAL_AMOUNT_MAX = 5_000_000;
export const MANUAL_REFERENCE_MAX = 64;
export const MANUAL_NOTE_MAX = 300;

const PLAN_IDS = PRICING_PLANS.map((plan) => plan.id) as [PlanId, ...PlanId[]];
const REFERENCE_PATTERN = /^[\p{L}\p{N} ._\-#/]*$/u;

export const ManualPaymentSchema = z
  .object({
    projectId: z.string().regex(/^c[a-z0-9]{20,40}$/, "Projet introuvable."),
    // Fourni par le navigateur : un double envoi (réseau instable) n'encaisse qu'une fois.
    requestId: z.uuid("Demande invalide."),
    plan: z.enum(PLAN_IDS, "Choisissez une offre."),
    months: z
      .number()
      .int()
      .refine(
        (value) => (MANUAL_PAYMENT_MONTHS as readonly number[]).includes(value),
        "Choisissez une durée.",
      ),
    amountXaf: z
      .number("Indiquez le montant reçu.")
      .int("Montant en francs CFA, sans décimales.")
      .min(MANUAL_AMOUNT_MIN, `${MANUAL_AMOUNT_MIN} FCFA au minimum.`)
      .max(MANUAL_AMOUNT_MAX, "Montant trop élevé : vérifiez la saisie."),
    method: z.enum(MANUAL_PAYMENT_METHODS, "Choisissez un moyen de paiement."),
    reference: z
      .string()
      .trim()
      .max(MANUAL_REFERENCE_MAX, `${MANUAL_REFERENCE_MAX} caractères au maximum.`)
      .regex(REFERENCE_PATTERN, "Lettres, chiffres, espaces et . _ - # / seulement."),
    note: z
      .string()
      .trim()
      .max(MANUAL_NOTE_MAX, `${MANUAL_NOTE_MAX} caractères au maximum.`),
  })
  .superRefine((value, ctx) => {
    if (requiresReference(value.method) && value.reference.length < 4)
      ctx.addIssue({
        code: "custom",
        path: ["reference"],
        message: "Indiquez l’identifiant de la transaction (4 caractères au moins).",
      });
  });
export type ManualPaymentInput = z.infer<typeof ManualPaymentSchema>;

/** Ce qui est gardé dans le journal admin, relu pour l'historique et la facturation. */
export const ManualPaymentRecordSchema = z.object({
  requestId: z.string(),
  plan: z.enum(PLAN_IDS),
  months: z.number().int(),
  amountXaf: z.number().int(),
  method: z.enum(MANUAL_PAYMENT_METHODS),
  reference: z.string(),
  note: z.string(),
  mode: z.enum(["start", "extend"]),
  periodId: z.string(),
  endsAt: z.iso.datetime(),
});
export type ManualPaymentRecord = z.infer<typeof ManualPaymentRecordSchema>;

/** Ajoute des mois civils (UTC), sans déborder : 31 janvier + 1 mois = 28 ou 29 février. */
export function addMonthsUtc(date: Date, months: number) {
  const target = new Date(date.getTime());
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target;
}

export type CurrentPeriod = {
  key: string;
  startsAt: Date;
  endsAt: Date;
  limit: number;
} | null;

/** Période mobile money en cours : un nouveau paiement la prolonge au lieu de repartir de zéro. */
export function isRunningManualPeriod(period: CurrentPeriod, now: Date) {
  return (
    !!period &&
    period.key.startsWith(MANUAL_PERIOD_PREFIX) &&
    period.startsAt <= now &&
    period.endsAt > now
  );
}

/**
 * Période après un paiement de `months` mois :
 * - pendant une période mobile money, elle est prolongée d'autant, et son
 *   quota augmente de `months` mois de messages (les messages restants sont gardés) ;
 * - sinon (premier paiement, retard, ancien essai), une période démarre maintenant.
 */
export function planManualPeriod({
  now,
  current,
  months,
  monthlyLimit,
}: {
  now: Date;
  current: CurrentPeriod;
  months: number;
  monthlyLimit: number;
}) {
  if (current && isRunningManualPeriod(current, now))
    return {
      mode: "extend" as const,
      startsAt: current.startsAt,
      endsAt: addMonthsUtc(current.endsAt, months),
      limit: current.limit + monthlyLimit * months,
    };
  return {
    mode: "start" as const,
    startsAt: now,
    endsAt: addMonthsUtc(now, months),
    limit: monthlyLimit * months,
  };
}

export function formatXaf(amount: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XAF",
    maximumFractionDigits: 0,
  }).format(amount);
}
