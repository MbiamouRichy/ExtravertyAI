// Mesure des inscriptions dans PostHog, par méthode et par campagne (pub Meta :
// utm_campaign=video-awa).
//
// PostHog ne garde rien d'un chargement à l'autre (ni cookie ni stockage local,
// voir instrumentation-client.ts) : l'aller-retour chez Google recharge la page
// et efface la campagne d'arrivée. Elle voyage donc dans l'adresse de retour
// d'un nouveau compte (newUserCallbackURL de Better Auth), avec un marqueur.
// Au retour, le compte est compté une fois et l'adresse est nettoyée.

export const CAMPAIGN_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;
export type CampaignKey = (typeof CAMPAIGN_KEYS)[number];
export type Campaign = Partial<Record<CampaignKey, string>>;

/** Marqueur de l'adresse de retour d'une inscription Google. */
export const GOOGLE_SIGN_UP_PARAM = "inscription";
export const GOOGLE_SIGN_UP_VALUE = "google";

const CAMPAIGN_MAX = 100;
// Noms de campagne usuels seulement : une valeur inattendue ne part pas chez PostHog.
const CAMPAIGN_VALUE = /^[\p{L}\p{N} ._~+:|/-]+$/u;
// Base fictive : seules des adresses relatives de l'application sont produites.
const BASE = "https://app.invalid";

/** Paramètres utm_* lisibles de l'adresse, les autres sont ignorés. */
export function campaignFrom(search: string | URLSearchParams): Campaign {
  const params = typeof search === "string" ? new URLSearchParams(search) : search;
  const campaign: Campaign = {};
  for (const key of CAMPAIGN_KEYS) {
    const value = params.get(key)?.trim();
    if (value && value.length <= CAMPAIGN_MAX && CAMPAIGN_VALUE.test(value)) campaign[key] = value;
  }
  return campaign;
}

// Campagne de la première page chargée. En mémoire seulement : elle suit la
// visite d'une page à l'autre de l'application (pub vers l'accueil, puis
// /sign-up) et disparaît avec l'onglet.
let arrival: Campaign = {};

/** À appeler une fois, au premier chargement (SiteAnalyticsBeacon). */
export function rememberArrivalCampaign(search: string): void {
  arrival = campaignFrom(search);
}

/** Campagne de la page actuelle si elle en porte une, sinon celle d'arrivée. */
export function visitCampaign(search: string): Campaign {
  const current = campaignFrom(search);
  return Object.keys(current).length > 0 ? current : { ...arrival };
}

/**
 * Adresse de retour d'un nouveau compte Google : la destination prévue, plus
 * le marqueur et la campagne. `callback` est déjà une adresse relative sûre
 * (safeAuthCallback).
 */
export function googleSignUpReturn(callback: string, campaign: Campaign): string {
  const url = new URL(callback, BASE);
  if (url.origin !== BASE) return callback;
  url.searchParams.set(GOOGLE_SIGN_UP_PARAM, GOOGLE_SIGN_UP_VALUE);
  for (const key of CAMPAIGN_KEYS) {
    const value = campaign[key];
    if (value && !url.searchParams.has(key)) url.searchParams.set(key, value);
  }
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Inscription Google à compter sur cette page, avec l'adresse à afficher une
 * fois le marqueur et la campagne retirés. Null sans marqueur.
 */
export function readGoogleSignUp(href: string): { campaign: Campaign; cleanUrl: string } | null {
  let url: URL;
  try {
    url = new URL(href, BASE);
  } catch {
    return null;
  }
  if (url.searchParams.get(GOOGLE_SIGN_UP_PARAM) !== GOOGLE_SIGN_UP_VALUE) return null;
  const campaign = campaignFrom(url.searchParams);
  url.searchParams.delete(GOOGLE_SIGN_UP_PARAM);
  for (const key of CAMPAIGN_KEYS) url.searchParams.delete(key);
  return { campaign, cleanUrl: `${url.pathname}${url.search}${url.hash}` };
}
