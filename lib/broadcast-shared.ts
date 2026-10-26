import { z } from "zod";
import { PIPELINE_STAGES } from "./pipeline-shared";

/** Shared by the composer, the server actions and the sending worker. */
export const BROADCAST_LIMITS = {
  nameMax: 80,
  contentMax: 1000,
  fallbackMax: 40,
  tagsMax: 20,
  /** A broadcast can be scheduled at most this many days ahead. */
  scheduleMaxDays: 30,
} as const;

/** Personalisation variable: replaced by the contact's first name. */
export const NAME_VARIABLE = "{prénom}";
const NAME_PATTERN = /\{\s*pr[ée]nom\s*\}/giu;

/** Always appended: required to respect consent and to protect the number. */
export const OPT_OUT_FOOTER = "Répondez STOP pour ne plus recevoir ces messages.";

/**
 * Sending only happens during business hours in this time zone, at a random
 * pace between two messages: a regular, human rhythm keeps the WhatsApp
 * number safe from spam detection.
 */
export const BROADCAST_TIME_ZONE = "Africa/Libreville";
export const BROADCAST_WINDOW = { startHour: 8, endHour: 20 } as const;
export const BROADCAST_PACE_MS = { min: 8_000, max: 15_000 } as const;

export const ACTIVITY_WINDOWS = [
  { days: 0, label: "Peu importe" },
  { days: 7, label: "7 derniers jours" },
  { days: 30, label: "30 derniers jours" },
  { days: 90, label: "3 derniers mois" },
  { days: 180, label: "6 derniers mois" },
  { days: 365, label: "12 derniers mois" },
] as const;

const STAGE_IDS = PIPELINE_STAGES.map((stage) => stage.id) as [
  (typeof PIPELINE_STAGES)[number]["id"],
  ...(typeof PIPELINE_STAGES)[number]["id"][],
];

export const AudienceSchema = z.object({
  /** Contacts carrying at least one of these tags; empty: every contact. */
  tagIds: z.array(z.string().cuid()).max(BROADCAST_LIMITS.tagsMax).default([]),
  /** Pipeline stages; empty: every stage. */
  stages: z.array(z.enum(STAGE_IDS)).max(STAGE_IDS.length).default([]),
  /** Last message from the contact within this many days; 0: no limit. */
  activeWithinDays: z
    .number()
    .int()
    .refine((days) => ACTIVITY_WINDOWS.some((window) => window.days === days), "Période invalide.")
    .default(0),
});
export type Audience = z.infer<typeof AudienceSchema>;

export const BroadcastDraftSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Donnez un nom à la diffusion.")
    .max(BROADCAST_LIMITS.nameMax, `${BROADCAST_LIMITS.nameMax} caractères au maximum.`),
  content: z
    .string()
    .trim()
    .min(1, "Écrivez le message.")
    .max(BROADCAST_LIMITS.contentMax, `${BROADCAST_LIMITS.contentMax} caractères au maximum.`),
  nameFallback: z
    .string()
    .trim()
    .max(BROADCAST_LIMITS.fallbackMax, `${BROADCAST_LIMITS.fallbackMax} caractères au maximum.`)
    .default(""),
});

export const BROADCAST_STATUS_LABEL = {
  SCHEDULED: "Programmée",
  SENDING: "En cours",
  PAUSED: "En pause",
  COMPLETED: "Terminée",
  CANCELLED: "Annulée",
} as const;

/** Why a broadcast stopped (PAUSED) or waits (SENDING): safe to show as is. */
export const BROADCAST_REASON_LABEL: Record<string, string> = {
  MANUAL: "Mise en pause par un membre de l’équipe.",
  QUOTA_EXCEEDED: "Quota de messages du mois atteint. Elle reprendra quand vous la relancerez.",
  PERIOD_UNAVAILABLE: "Abonnement à régulariser avant de reprendre l’envoi.",
  PROJECT_INACTIVE: "Le projet n’est pas actif.",
  MONTHLY_LIMIT: "Limite mensuelle de diffusion de votre offre atteinte.",
  PLAN: "Votre offre actuelle n’inclut plus la diffusion.",
  PROJECT_PAUSED: "Le projet est en pause.",
  AUTHOR_LEFT: "La personne qui l’a créée a quitté le projet. Un administrateur peut la reprendre.",
  DISCONNECTED: "En attente de la reconnexion de WhatsApp.",
  OUTSIDE_WINDOW: "En attente des heures d’envoi (8 h – 20 h).",
  DAILY_LIMIT: "Limite quotidienne atteinte : l’envoi reprend demain à 8 h.",
};

export const BROADCAST_SKIP_LABEL: Record<string, string> = {
  OPTED_OUT: "Désinscrit (STOP)",
  CANCELLED: "Diffusion annulée",
};

/** First name shown in « Bonjour {prénom} » : first word of the saved or WhatsApp name. */
export function contactFirstName(contact: { name?: string | null; pushName?: string | null }) {
  const raw = (contact.name?.trim() || contact.pushName?.trim() || "").split(/\s+/u)[0] ?? "";
  // Names are public WhatsApp data: keep letters, accents, apostrophes and hyphens only.
  const clean = raw.replace(/[^\p{L}\p{M}'’-]/gu, "").slice(0, BROADCAST_LIMITS.fallbackMax);
  return clean ? clean.charAt(0).toLocaleUpperCase("fr-FR") + clean.slice(1) : "";
}

/** The message with the contact's first name, before the STOP mention. */
export function personalise(
  content: string,
  contact: { name?: string | null; pushName?: string | null },
  fallback = "",
) {
  const value = contactFirstName(contact) || fallback.trim();
  // « Bonjour {prénom}, » without any name becomes « Bonjour, ».
  const text = value
    ? content.replace(NAME_PATTERN, value)
    : content.replace(/[ \t]*\{\s*pr[ée]nom\s*\}/giu, "");
  return text.trim();
}

/** Text actually sent to one contact: personalised, with the STOP mention. */
export function renderBroadcast(
  content: string,
  contact: { name?: string | null; pushName?: string | null },
  fallback = "",
) {
  return `${personalise(content, contact, fallback)}\n\n_${OPT_OUT_FOOTER}_`;
}

export function usesNameVariable(content: string) {
  NAME_PATTERN.lastIndex = 0;
  return NAME_PATTERN.test(content);
}

function normalizeKeyword(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const OPT_OUT_WORDS = new Set([
  "stop", "stop pub", "stop promo", "stop svp", "arret", "arreter", "unsubscribe",
  "desabonner", "se desabonner", "me desabonner", "desinscrire", "me desinscrire",
  "desinscription",
]);
const OPT_IN_WORDS = new Set([
  "start", "reprendre", "abonner", "m abonner", "me reabonner", "reabonner", "je m abonne",
]);

/** A whole message that unsubscribes from (or back to) broadcasts. */
export function broadcastKeyword(text: string): "OPT_OUT" | "OPT_IN" | null {
  if (!text || text.length > 40) return null;
  const word = normalizeKeyword(text);
  if (OPT_OUT_WORDS.has(word)) return "OPT_OUT";
  if (OPT_IN_WORDS.has(word)) return "OPT_IN";
  return null;
}

function zonedParts(date: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: BROADCAST_TIME_ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, Number(part.value)]),
  ) as Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return { ...parts, offset: asUtc - Math.floor(date.getTime() / 1000) * 1000 };
}

/** Instant of a local wall-clock time, `dayShift` days after the local date of `date`. */
function localTime(date: Date, hour: number, dayShift = 0) {
  const { year, month, day, offset } = zonedParts(date);
  return new Date(Date.UTC(year, month - 1, day + dayShift, hour) - offset);
}

export function localDayStart(date: Date) {
  return localTime(date, 0);
}

/** Now when inside business hours, otherwise the next opening. */
export function nextSendingWindow(date: Date) {
  const { hour } = zonedParts(date);
  if (hour < BROADCAST_WINDOW.startHour) return localTime(date, BROADCAST_WINDOW.startHour);
  if (hour >= BROADCAST_WINDOW.endHour) return localTime(date, BROADCAST_WINDOW.startHour, 1);
  return date;
}

export function tomorrowWindow(date: Date) {
  return localTime(date, BROADCAST_WINDOW.startHour, 1);
}

export function nextPace(now: Date, random: () => number = Math.random) {
  const { min, max } = BROADCAST_PACE_MS;
  return new Date(now.getTime() + min + Math.round(random() * (max - min)));
}

/** Recipient filters of the broadcast page, mutually exclusive except « replied ». */
export const RECIPIENT_FILTERS = [
  { id: "all", label: "Tous" },
  { id: "pending", label: "En attente" },
  { id: "sent", label: "Envoyés" },
  { id: "delivered", label: "Distribués" },
  { id: "read", label: "Lus" },
  { id: "replied", label: "Ont répondu" },
  { id: "failed", label: "Échecs" },
  { id: "skipped", label: "Ignorés" },
] as const;
export type RecipientFilter = (typeof RECIPIENT_FILTERS)[number]["id"];
export const RECIPIENT_FILTER_IDS = RECIPIENT_FILTERS.map((filter) => filter.id) as [
  RecipientFilter,
  ...RecipientFilter[],
];

export const BROADCAST_EVENT_LABEL: Record<string, string> = {
  CREATED: "Diffusion créée",
  STARTED: "Premier message envoyé",
  PAUSED: "Mise en pause",
  RESUMED: "Reprise",
  CANCELLED: "Annulée",
  COMPLETED: "Terminée",
};
