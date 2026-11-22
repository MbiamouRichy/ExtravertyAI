import { z } from "zod";

/**
 * Votes « Cet article vous a-t-il aidé ? » : règles communes au formulaire
 * public et au serveur. Le serveur revalide tout (lib/help-feedback.ts).
 */

export const HELP_FEEDBACK_REASONS = ["UNCLEAR", "MISSING_STEP", "SCREEN_MISMATCH", "OTHER"] as const;
export type HelpFeedbackReasonValue = (typeof HELP_FEEDBACK_REASONS)[number];

export const HELP_FEEDBACK_REASON_LABEL: Record<HelpFeedbackReasonValue, string> = {
  UNCLEAR: "Ce n’est pas clair",
  MISSING_STEP: "Une étape manque",
  SCREEN_MISMATCH: "L’écran ne correspond pas",
  OTHER: "Autre chose",
};

/** Même limite que la contrainte de la table help_feedback. */
export const HELP_FEEDBACK_COMMENT_MAX = 500;
/** Note interne de l’équipe sur un avis, dans le back-office. */
export const HELP_INTERNAL_NOTE_MAX = 2000;
export const HELP_SLUG_PATTERN = /^[a-z0-9-]{1,60}$/;

export const HelpFeedbackInputSchema = z
  .object({
    articleSlug: z.string().regex(HELP_SLUG_PATTERN, "Article introuvable."),
    helpful: z.boolean(),
    reason: z.enum(HELP_FEEDBACK_REASONS).nullish(),
    comment: z
      .string()
      .trim()
      .max(HELP_FEEDBACK_COMMENT_MAX, `${HELP_FEEDBACK_COMMENT_MAX} caractères au maximum.`)
      .nullish(),
  })
  // Un avis positif n’a ni motif ni commentaire : on ne garde que le vote.
  .transform(({ articleSlug, helpful, reason, comment }) => ({
    articleSlug,
    helpful,
    reason: helpful ? null : (reason ?? null),
    comment: helpful ? null : comment || null,
  }));
export type HelpFeedbackInput = z.input<typeof HelpFeedbackInputSchema>;
export type HelpFeedbackValues = z.output<typeof HelpFeedbackInputSchema>;

/* Back-office : filtres gardés dans l’URL, partagés par la page et son formulaire. */

export const HELP_FEEDBACK_STATUSES = ["NEW", "DONE", "ARCHIVED"] as const;
export type HelpFeedbackStatusValue = (typeof HELP_FEEDBACK_STATUSES)[number];
export const HELP_FEEDBACK_PERIODS = ["7", "30", "90", "365", "all"] as const;

export type HelpFeedbackFilters = {
  vote: "ALL" | "DOWN" | "UP";
  /** « OPEN » : tout sauf les archives, la vue de travail. */
  status: "OPEN" | "ALL" | HelpFeedbackStatusValue;
  article: string;
  period: (typeof HELP_FEEDBACK_PERIODS)[number];
  comments: "all" | "with";
  page: number;
};

export const DEFAULT_HELP_FEEDBACK_FILTERS: HelpFeedbackFilters = {
  vote: "ALL",
  status: "OPEN",
  article: "ALL",
  period: "30",
  comments: "all",
  page: 1,
};

/** Paramètres d’URL sans les valeurs par défaut, pour des liens courts. */
export function helpFeedbackFiltersToSearch(filters: Partial<HelpFeedbackFilters> & { id?: string }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === "") continue;
    if (key in DEFAULT_HELP_FEEDBACK_FILTERS && DEFAULT_HELP_FEEDBACK_FILTERS[key as keyof HelpFeedbackFilters] === value)
      continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}
