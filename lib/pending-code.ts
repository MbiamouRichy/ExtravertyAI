import * as z from "zod";

/**
 * Code à usage unique en attente, gardé sur l’appareil le temps de sa
 * validité. Pour lire le code, le visiteur passe dans son application mail :
 * au retour, un navigateur intégré (Facebook, Instagram…) ou un onglet mis en
 * veille peut avoir rechargé la page et perdu l’étape du code. Ce brouillon la
 * rétablit, sans relancer d’envoi (un nouveau code annulerait le premier).
 *
 * Jamais le code lui-même, ni un mot de passe : seulement l’adresse, le nom
 * saisi à l’inscription et l’heure d’envoi. Rien ne passe par l’URL.
 */

export const PENDING_CODE_KEY = "extraverty:pending-code";
// Durée de validité du code envoyé (VERIFICATION_CODE_MINUTES côté serveur).
export const PENDING_CODE_TTL_MS = 10 * 60 * 1000;

const pendingCodeSchema = z.object({
  flow: z.enum(["sign-up", "sign-in"]),
  purpose: z.enum(["email-verification", "sign-in", "sign-up"]),
  email: z.string().trim().toLowerCase().email().max(320),
  name: z.string().trim().min(1).max(120).optional(),
  sentAt: z.number().int().nonnegative(),
});

export type PendingCode = z.infer<typeof pendingCodeSchema>;
export type PendingCodeFlow = PendingCode["flow"];

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

/** Stockage local, ou `null` s’il est refusé (navigation privée, réglages). */
export function deviceStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function savePendingCode(storage: Storage | null, value: PendingCode): void {
  const parsed = pendingCodeSchema.safeParse(value);
  if (!storage || !parsed.success) return;
  try {
    storage.setItem(PENDING_CODE_KEY, JSON.stringify(parsed.data));
  } catch {
    // Stockage plein ou refusé : l’étape reste utilisable sans brouillon.
  }
}

/** Garde le code qui vient d’être envoyé, daté de maintenant. */
export function rememberPendingCode(
  storage: Storage | null,
  value: Omit<PendingCode, "sentAt">,
  now: number = Date.now(),
): PendingCode {
  const draft = { ...value, sentAt: now };
  savePendingCode(storage, draft);
  return draft;
}

export function clearPendingCode(storage: Storage | null): void {
  try {
    storage?.removeItem(PENDING_CODE_KEY);
  } catch {
    // Rien à faire : le brouillon expire de lui-même.
  }
}

/**
 * Brouillon encore valable pour ce parcours, ou `null`. Un brouillon expiré,
 * illisible ou daté du futur est effacé.
 */
export function readPendingCode(
  storage: Storage | null,
  flow: PendingCodeFlow,
  now: number = Date.now(),
): PendingCode | null {
  if (!storage) return null;
  let raw: string | null;
  try {
    raw = storage.getItem(PENDING_CODE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  let parsed: ReturnType<typeof pendingCodeSchema.safeParse>;
  try {
    parsed = pendingCodeSchema.safeParse(JSON.parse(raw));
  } catch {
    clearPendingCode(storage);
    return null;
  }
  if (!parsed.success) {
    clearPendingCode(storage);
    return null;
  }
  const age = now - parsed.data.sentAt;
  if (age < 0 || age >= PENDING_CODE_TTL_MS) {
    clearPendingCode(storage);
    return null;
  }
  // L’autre parcours garde son brouillon : la page de connexion ne reprend
  // pas une inscription, et inversement.
  return parsed.data.flow === flow ? parsed.data : null;
}

/** Secondes restantes avant de pouvoir redemander un code. */
export function resendDelayLeft(sentAt: number, delaySeconds: number, now: number = Date.now()): number {
  const elapsed = Math.floor((now - sentAt) / 1000);
  return Math.min(delaySeconds, Math.max(0, delaySeconds - elapsed));
}
