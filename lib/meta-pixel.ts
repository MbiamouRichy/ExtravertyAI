/**
 * Pixel Meta : mesure des visites venues des publicités Facebook et Instagram,
 * et signal « inscription » qui permet à Meta d’optimiser les campagnes sur
 * les inscriptions plutôt que sur les clics.
 *
 * Règles de confidentialité :
 * - aucune donnée de compte (e-mail, nom, téléphone) n’est envoyée à Meta,
 *   pas même hachée ; la collecte automatique des boutons est coupée ;
 * - rien n’est envoyé depuis l’espace connecté (projets, conversations,
 *   back-office), dont les adresses contiennent des identifiants internes ;
 * - le refus du suivi exprimé par le navigateur (GPC, Do Not Track) est
 *   respecté avant tout chargement.
 */

/** Identifiant de pixel Meta : uniquement des chiffres. */
export function parseMetaPixelId(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return /^\d{10,20}$/.test(id) ? id : null;
}

// Pages où l’adresse peut révéler un identifiant ou un contenu privé.
const PRIVATE_PATH = /^\/(admin|api|invite|reset-password|verify|goodbye|maquettes)(\/|$)|^\/projects\/./;

/**
 * Le pixel peut-il être chargé et notifié sur ce chemin ? `/projects` seul est
 * accepté : c’est l’arrivée après l’inscription, sans identifiant dans
 * l’adresse.
 */
export function isMetaTrackablePath(pathname: string | null | undefined): boolean {
  if (typeof pathname !== "string" || !pathname.startsWith("/")) return false;
  return !PRIVATE_PATH.test(pathname);
}

// Paramètres qui portent une destination interne, un jeton ou une adresse.
const PRIVATE_PARAMS = ["callbackurl", "redirect", "token", "code", "otp", "email", "invite"];

/**
 * Comme `isMetaTrackablePath`, en tenant compte des paramètres : Meta reçoit
 * l’adresse complète de la page. `/sign-in?callbackUrl=/projects/…` (arrivée
 * depuis un lien privé) n’est donc pas notifiée ; `/sign-up?utm_…` l’est.
 */
export function isMetaTrackableLocation(pathname: string | null | undefined, search: string): boolean {
  if (!isMetaTrackablePath(pathname)) return false;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search);
  } catch {
    return false;
  }
  for (const key of params.keys()) {
    if (PRIVATE_PARAMS.includes(key.toLowerCase())) return false;
  }
  return true;
}

/** Fenêtre après la création du compte pendant laquelle l’inscription est signalée. */
export const REGISTRATION_WINDOW_MS = 30 * 60 * 1000;

export const REGISTRATION_SENT_KEY = "extraverty:meta-registration";

/**
 * Le compte vient-il d’être créé ? Couvre l’e-mail comme Google, sans
 * dépendre du parcours d’inscription : seule la date de création compte.
 */
export function isFreshAccount(
  createdAt: Date | string | number | null | undefined,
  now: number = Date.now(),
): boolean {
  if (createdAt === null || createdAt === undefined) return false;
  const created = new Date(createdAt).getTime();
  if (!Number.isFinite(created)) return false;
  const age = now - created;
  // Une petite avance d’horloge du serveur reste acceptée.
  return age >= -60_000 && age <= REGISTRATION_WINDOW_MS;
}

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

/**
 * Réserve l’envoi de l’inscription pour ce compte : une seule fois par
 * appareil. Sans stockage utilisable, rien n’est envoyé (pas de doublon).
 */
export function claimRegistrationSignal(storage: KeyValueStore | null, userId: string): boolean {
  if (!storage || !userId) return false;
  try {
    if (storage.getItem(REGISTRATION_SENT_KEY) === userId) return false;
    storage.setItem(REGISTRATION_SENT_KEY, userId);
    return storage.getItem(REGISTRATION_SENT_KEY) === userId;
  } catch {
    return false;
  }
}
