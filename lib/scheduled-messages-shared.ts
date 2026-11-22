import { MessageContentSchema } from "./message-schema";
import { utcOffsetLabel } from "./user-time-zone";

// Règles des messages programmés, partagées par le serveur et le navigateur.
// Le navigateur s'en sert pour guider ; le serveur les revérifie toujours.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const SCHEDULED_MESSAGE_LIMITS = {
  /** Au moins une minute d'avance : une heure déjà passée est refusée. */
  minLeadMs: MINUTE,
  /** Programmation au plus 30 jours à l'avance. */
  maxDays: 30,
  /** Messages programmés en attente, au plus, par conversation et par projet. */
  perContact: 10,
  perProject: 500,
  /**
   * Un message en retard (WhatsApp déconnecté, service arrêté) ne part plus
   * au-delà : « à demain 9 h » envoyé le soir n'aurait plus de sens.
   */
  maxLateMs: 6 * HOUR,
  /** Fenêtre de service client de WhatsApp après le dernier message du client. */
  windowMs: DAY,
  /** Nouvel essai quand WhatsApp est déconnecté à l'heure prévue. */
  retryMs: MINUTE,
  /** Un échec reste affiché dans la conversation pendant 7 jours, sauf s'il est retiré. */
  failureVisibleMs: 7 * DAY,
} as const;

/** Source des messages partis d'une programmation (graphique des origines, exports). */
export const SCHEDULED_SOURCE = "scheduled";

/** Même règle que l'envoi immédiat : texte non vide, 10 000 mots au plus. */
export const ScheduledContentSchema = MessageContentSchema;

export const SCHEDULED_FAILURE_REASONS = [
  "WINDOW_CLOSED",
  "AUTHOR_UNAUTHORIZED",
  "PROJECT_INACTIVE",
  "PROJECT_DELETED",
  "QUOTA",
  "EXPIRED",
] as const;
export type ScheduledFailureReason = (typeof SCHEDULED_FAILURE_REASONS)[number];

const FAILURE_LABELS: Record<ScheduledFailureReason, string> = {
  WINDOW_CLOSED:
    "fenêtre de 24 h de WhatsApp fermée : le client n’avait pas écrit dans les 24 h précédant l’envoi",
  AUTHOR_UNAUTHORIZED: "son auteur n’a plus accès aux conversations du projet",
  PROJECT_INACTIVE: "projet inactif : offre expirée, suspendue ou en attente de paiement",
  PROJECT_DELETED: "projet en cours de suppression",
  QUOTA: "quota de messages épuisé",
  EXPIRED: "il n’a pas pu partir dans les 6 h suivant l’heure prévue (WhatsApp déconnecté)",
};

/** Raison lisible d'un échec, sûre à afficher (le code vient de la base). */
export function scheduledFailureLabel(reason: string | null | undefined): string {
  return FAILURE_LABELS[reason as ScheduledFailureReason] ?? "envoi impossible";
}

/** Message programmé tel que l'affiche la conversation. */
export type ScheduledChatMessage = {
  id: string;
  content: string;
  scheduledAt: string;
  status: "scheduled" | "failed";
  /** Code de l'échec, ou DISCONNECTED pour un message en attente de WhatsApp. */
  reason: string | null;
  version: number;
  author: { id: string; name: string | null; image: string | null } | null;
  /** Droits du membre connecté, revérifiés par chaque action serveur. */
  canEdit: boolean;
  canCancel: boolean;
};

/** Refus d'une date d'envoi, ou null si elle convient. */
export function scheduleTimeError(at: Date, now: Date): string | null {
  if (Number.isNaN(at.getTime())) return "Choisissez une date et une heure.";
  if (at.getTime() < now.getTime() + SCHEDULED_MESSAGE_LIMITS.minLeadMs)
    return "Cette heure est déjà passée : choisissez un moment à venir.";
  if (at.getTime() > now.getTime() + SCHEDULED_MESSAGE_LIMITS.maxDays * DAY)
    return `Programmez l’envoi dans les ${SCHEDULED_MESSAGE_LIMITS.maxDays} prochains jours.`;
  return null;
}

/** Fin de la fenêtre de 24 h ouverte par le dernier message du client. */
export function windowClosesAt(lastClientMessageAt: Date | string | null | undefined): Date | null {
  if (!lastClientMessageAt) return null;
  return new Date(new Date(lastClientMessageAt).getTime() + SCHEDULED_MESSAGE_LIMITS.windowMs);
}

/* -------------------------------------------------------------------------- */
/* Heures murales dans le fuseau de l'activité                                 */
/* -------------------------------------------------------------------------- */

const partFormatters = new Map<string, Intl.DateTimeFormat>();
function partFormatter(timeZone: string) {
  let formatter = partFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    if (partFormatters.size >= 32) partFormatters.clear();
    partFormatters.set(timeZone, formatter);
  }
  return formatter;
}

type WallParts = Record<"year" | "month" | "day" | "hour" | "minute" | "second", number>;

function wallParts(date: Date, timeZone: string): WallParts {
  return Object.fromEntries(
    partFormatter(timeZone)
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  ) as WallParts;
}

/** Décalage du fuseau à cet instant, en millisecondes. */
function offsetAt(date: Date, timeZone: string) {
  const parts = wallParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** Instant d'une heure murale ; le jour peut déborder (32 novembre → 2 décembre). */
function wallClock(year: number, month: number, day: number, hour: number, minute: number, timeZone: string) {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  // Deux passes : le décalage peut changer autour de l'heure visée (heure d'été).
  const first = wall - offsetAt(new Date(wall), timeZone);
  return new Date(wall - offsetAt(new Date(first), timeZone));
}

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * Instant de « 2026-11-23 » à « 09:00 » dans `timeZone`. Null pour une saisie
 * invalide ou une heure qui n'existe pas ce jour-là (passage à l'heure d'été).
 */
export function zonedDateTime(date: string, time: string, timeZone: string): Date | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const clock = /^(\d{2}):(\d{2})$/.exec(time);
  if (!day || !clock) return null;
  const [year, month, dayOfMonth, hour, minute] = [day[1], day[2], day[3], clock[1], clock[2]].map(Number);
  if (month < 1 || month > 12 || hour > 23 || minute > 59) return null;
  const calendar = new Date(Date.UTC(year, month - 1, dayOfMonth));
  if (calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== dayOfMonth) return null;
  const instant = wallClock(year, month, dayOfMonth, hour, minute, timeZone);
  const back = wallParts(instant, timeZone);
  if (back.day !== dayOfMonth || back.hour !== hour || back.minute !== minute) return null;
  return instant;
}

/** Valeurs des champs date et heure pour cet instant, dans `timeZone`. */
export function zonedInputs(date: Date, timeZone: string) {
  const parts = wallParts(date, timeZone);
  return {
    date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hour)}:${pad(parts.minute)}`,
  };
}

export type SchedulePreset = { id: string; label: string; at: Date };

/**
 * Raccourcis proposés à côté du bouton d'envoi, en heure de l'activité :
 * dans 1 h, ce soir, demain matin, demain après-midi, lundi matin.
 */
export function schedulePresets(now: Date, timeZone: string): SchedulePreset[] {
  const today = wallParts(now, timeZone);
  const at = (dayShift: number, hour: number) =>
    wallClock(today.year, today.month, today.day + dayShift, hour, 0, timeZone);
  // 0 : dimanche. Lundi suivant, jamais aujourd'hui.
  const weekday = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay();
  const toMonday = (8 - weekday) % 7 || 7;
  const presets: SchedulePreset[] = [
    // Arrondi aux cinq minutes suivantes : une heure lisible.
    { id: "hour", label: "Dans 1 heure", at: new Date(Math.ceil((now.getTime() + HOUR) / (5 * MINUTE)) * 5 * MINUTE) },
    ...(today.hour < 17 ? [{ id: "evening", label: "Ce soir", at: at(0, 18) }] : []),
    { id: "tomorrow-morning", label: "Demain matin", at: at(1, 9) },
    { id: "tomorrow-afternoon", label: "Demain après-midi", at: at(1, 14) },
    // Demain lundi : déjà couvert par « Demain matin ».
    ...(toMonday > 1 ? [{ id: "monday", label: "Lundi matin", at: at(toMonday, 9) }] : []),
  ];
  return presets.filter((preset) => !scheduleTimeError(preset.at, now));
}

/** « Libreville » pour « Africa/Libreville ». */
export function timeZoneCity(timeZone: string) {
  return timeZone.split("/").at(-1)?.replaceAll("_", " ") || timeZone;
}

/** « heure de Libreville (UTC+1) » : le fuseau dans lequel l'heure est choisie. */
export function timeZoneLabel(timeZone: string, date = new Date()) {
  return `heure de ${timeZoneCity(timeZone)} (${utcOffsetLabel(timeZone, date)})`;
}

const dateFormatters = new Map<string, { day: Intl.DateTimeFormat; time: Intl.DateTimeFormat }>();

/** « mar. 24 nov. à 09:00 » dans `timeZone`. */
export function formatScheduleDate(date: Date | string, timeZone: string) {
  let formatter = dateFormatters.get(timeZone);
  if (!formatter) {
    formatter = {
      day: new Intl.DateTimeFormat("fr-FR", { timeZone, weekday: "short", day: "numeric", month: "short" }),
      time: new Intl.DateTimeFormat("fr-FR", { timeZone, hour: "2-digit", minute: "2-digit" }),
    };
    if (dateFormatters.size >= 16) dateFormatters.clear();
    dateFormatters.set(timeZone, formatter);
  }
  const value = new Date(date);
  return `${formatter.day.format(value)} à ${formatter.time.format(value)}`;
}
