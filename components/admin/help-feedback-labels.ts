import type { HelpFeedbackStatusValue } from "@/lib/help-center/feedback-shared";

export const HELP_STATUS_LABEL: Record<
  HelpFeedbackStatusValue,
  { label: string; plural: string; variant: "default" | "secondary" | "outline" | "ghost" }
> = {
  NEW: { label: "À traiter", plural: "À traiter", variant: "default" },
  DONE: { label: "Traité", plural: "Traités", variant: "outline" },
  ARCHIVED: { label: "Archivé", plural: "Archivés", variant: "ghost" },
};

export function formatHelpScore(score: number | null) {
  return score === null ? "—" : `${Math.round(score * 100)} %`;
}
