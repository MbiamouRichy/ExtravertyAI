import { z } from "zod";

// Shared by the goodbye survey (client) and its server action.
export const DELETION_FEEDBACK_REASONS = [
  { value: "too_expensive", label: "Trop cher" },
  { value: "missing_features", label: "Il manque des fonctionnalités" },
  { value: "too_complex", label: "Trop compliqué à utiliser" },
  { value: "answers_quality", label: "Réponses de l’assistant insatisfaisantes" },
  { value: "not_needed", label: "Je n’en ai plus besoin" },
  { value: "switched", label: "Je passe à un autre outil" },
  { value: "privacy", label: "Confidentialité de mes données" },
  { value: "other", label: "Autre raison" },
] as const;

export const DeletionFeedbackSchema = z.object({
  reason: z.enum(
    DELETION_FEEDBACK_REASONS.map((reason) => reason.value) as [
      (typeof DELETION_FEEDBACK_REASONS)[number]["value"],
      ...(typeof DELETION_FEEDBACK_REASONS)[number]["value"][],
    ],
    { error: "Choisissez une raison." },
  ),
  comment: z
    .string()
    .trim()
    .max(500, "500 caractères maximum."),
});

export type DeletionFeedbackValues = z.infer<typeof DeletionFeedbackSchema>;
