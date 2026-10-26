import { Bug, Heart, Lightbulb, type LucideIcon } from "lucide-react";
import type { FeedbackKind, FeedbackStatus } from "@/lib/admin-feedback";

export const KIND_LABEL: Record<FeedbackKind, { label: string; plural: string; icon: LucideIcon }> = {
  BUG: { label: "Bug", plural: "Bugs", icon: Bug },
  IDEA: { label: "Idée", plural: "Idées", icon: Lightbulb },
  PRAISE: { label: "Compliment", plural: "Compliments", icon: Heart },
};

export const STATUS_LABEL: Record<
  FeedbackStatus,
  { label: string; plural: string; variant: "default" | "secondary" | "outline" | "ghost" }
> = {
  NEW: { label: "Nouveau", plural: "Nouveaux", variant: "default" },
  IN_PROGRESS: { label: "En cours", plural: "En cours", variant: "secondary" },
  DONE: { label: "Traité", plural: "Traités", variant: "outline" },
  ARCHIVED: { label: "Archivé", plural: "Archivés", variant: "ghost" },
};

export const PERIOD_LABEL = {
  "7": "7 derniers jours",
  "30": "30 derniers jours",
  "90": "3 derniers mois",
  "365": "12 derniers mois",
  all: "Toute la période",
} as const;

export function formatFeedbackDate(date: Date, timeZone: string, withTime = true) {
  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    ...(withTime && { timeStyle: "short" }),
    timeZone,
  }).format(date);
}
