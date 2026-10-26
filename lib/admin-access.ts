import { isRecentSession } from "./recent-session";

/**
 * Back-office : l'accès est réservé aux adresses de ADMIN_EMAILS (séparées par
 * des virgules). Sans variable, personne n'y a accès : jamais d'ouverture par défaut.
 */
export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((address) => address.trim().toLowerCase())
      .filter((address) => address.includes("@")),
  );
}

export type AdminIdentity = { id: string; name: string; email: string };

type SessionLike = {
  user?: {
    id?: string | null;
    name?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  } | null;
  session?: { createdAt?: unknown } | null;
} | null;

export type AdminCheck =
  | { ok: true; admin: AdminIdentity }
  | { ok: false; reason: "DENIED" | "REAUTH_REQUIRED" };

/**
 * Seule une adresse vérifiée compte : sinon, s'inscrire avec l'e-mail d'un
 * membre de l'équipe suffirait à entrer. `recent` exige une connexion de
 * moins de 10 minutes, pour les actions sensibles.
 */
export function checkAdminSession(
  session: SessionLike,
  options: { allowList?: string; recent?: boolean; now?: number } = {},
): AdminCheck {
  const user = session?.user;
  const email = user?.email?.trim().toLowerCase();
  if (!user?.id || !email || user.emailVerified !== true)
    return { ok: false, reason: "DENIED" };
  if (!parseAdminEmails(options.allowList ?? process.env.ADMIN_EMAILS).has(email))
    return { ok: false, reason: "DENIED" };
  if (options.recent && !isRecentSession(session?.session?.createdAt, options.now))
    return { ok: false, reason: "REAUTH_REQUIRED" };
  return {
    ok: true,
    admin: { id: user.id, name: user.name?.trim() || email, email },
  };
}
