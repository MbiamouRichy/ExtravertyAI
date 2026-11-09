import { z } from "zod";

// Pure rules shared by the server and the client bundle.

export const FOLLOW_UP_LIMITS = {
  /** Délai le plus long proposé entre deux échanges, en jours. */
  maxDays: 14,
  /** Relances au plus tant que le client ne répond pas. */
  maxRelances: 3,
  templateMin: 10,
  templateMax: 500,
  /**
   * Une conversation n'est relancée que dans les jours qui suivent son délai :
   * activer la fonctionnalité ne réveille pas des échanges vieux de plusieurs mois.
   */
  graceDays: 3,
  /** Écart minimal entre deux relances d'un même projet. */
  projectSpacingMs: 20_000,
} as const;

/** Étapes du pipeline relancées : un prospect intéressé ou en attente de devis. */
export const FOLLOW_UP_STAGES = ["INTERESTED", "QUOTE_SENT"] as const;
export type FollowUpStage = (typeof FOLLOW_UP_STAGES)[number];

/** Source des messages de relance : les distingue des réponses de l'IA. */
export const FOLLOW_UP_SOURCE = "follow_up";

export const FOLLOW_UP_DELAY_OPTIONS = [0, 1, 2, 3, 5, 7, 14] as const;

export function followUpDelayLabel(days: number) {
  if (days === 0) return "Ne pas relancer";
  return `Après ${days} jour${days > 1 ? "s" : ""} sans réponse`;
}

const Days = z
  .number({ error: "Choisissez un délai." })
  .int()
  .min(0)
  .max(FOLLOW_UP_LIMITS.maxDays, `${FOLLOW_UP_LIMITS.maxDays} jours au plus.`);

export const FollowUpSettingsSchema = z
  .object({
    enabled: z.boolean(),
    interestedDays: Days,
    quoteDays: Days,
    max: z
      .number({ error: "Choisissez un nombre de relances." })
      .int()
      .min(1, "Au moins une relance.")
      .max(FOLLOW_UP_LIMITS.maxRelances, `${FOLLOW_UP_LIMITS.maxRelances} relances au plus.`),
    template: z
      .string()
      .trim()
      .max(FOLLOW_UP_LIMITS.templateMax, `${FOLLOW_UP_LIMITS.templateMax} caractères au maximum.`)
      .refine(
        (value) => value.length === 0 || value.length >= FOLLOW_UP_LIMITS.templateMin,
        `Au moins ${FOLLOW_UP_LIMITS.templateMin} caractères, ou laissez vide pour que l’IA rédige.`,
      ),
  })
  .refine((value) => !value.enabled || value.interestedDays > 0 || value.quoteDays > 0, {
    message: "Choisissez au moins une étape à relancer.",
    path: ["quoteDays"],
  });

export type FollowUpSettings = z.infer<typeof FollowUpSettingsSchema>;

export type FollowUpStats = {
  /** Relances envoyées sur la période. */
  sent: number;
  /** Relances suivies d'une réponse du client dans les 7 jours. */
  replied: number;
  /** Prospects passés à « Gagné » après au moins une relance. */
  won: number;
  /** Valeur de ces ventes, dans l'unité mineure de la devise du projet. */
  wonValue: number;
};
