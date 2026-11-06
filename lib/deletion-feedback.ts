import { z } from "zod";

// Shared by the goodbye survey (client) and its server action. Only `value`
// is stored; `label` and `followUp` are display copy and can change freely.
// Ordered so the chips pack two per row on a phone where they can.
export const DELETION_FEEDBACK_REASONS = [
  {
    value: "too_expensive",
    label: "Trop cher",
    followUp: "Quel prix vous aurait convenu\u00a0?",
  },
  {
    value: "too_complex",
    label: "Trop compliqué",
    followUp: "À quel moment avez-vous bloqué\u00a0?",
  },
  {
    value: "missing_features",
    label: "Fonctionnalités manquantes",
    followUp: "Quelle fonctionnalité vous a manqué\u00a0?",
  },
  {
    value: "answers_quality",
    label: "Réponses de l’IA décevantes",
    followUp: "Qu’est-ce qui n’allait pas dans les réponses\u00a0?",
  },
  {
    value: "not_needed",
    label: "Plus besoin",
    followUp: "Qu’est-ce qui a changé pour vous\u00a0?",
  },
  {
    value: "switched",
    label: "Autre outil",
    followUp: "Vers quel outil partez-vous, et pourquoi\u00a0?",
  },
  {
    value: "privacy",
    label: "Confidentialité",
    followUp: "Qu’est-ce qui vous a inquiété\u00a0?",
  },
  {
    value: "other",
    label: "Autre raison",
    followUp: "Dites-nous en un peu plus",
  },
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
