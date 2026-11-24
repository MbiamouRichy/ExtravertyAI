/**
 * Navigateurs intégrés aux applications (Facebook, Instagram, Messenger…).
 *
 * Google refuse la connexion OAuth dans ces vues web (erreur 403
 * « disallowed_useragent ») : le bouton « Continuer avec Google » y échoue
 * sans recours. La détection se fait sur l’en-tête User-Agent, lu côté
 * serveur, pour que la page arrive déjà adaptée, sans écart d’hydratation.
 *
 * Les onglets personnalisés (Chrome Custom Tabs, SFSafariViewController),
 * qu’ouvrent par exemple WhatsApp ou Gmail, sont de vrais navigateurs : Google
 * les accepte, ils ne sont donc pas visés ici.
 */

export type InAppBrowserApp =
  | "facebook"
  | "instagram"
  | "messenger"
  | "tiktok"
  | "linkedin"
  | "whatsapp"
  | "webview";

export type InAppBrowserOs = "android" | "ios" | "other";

export type InAppBrowser = { app: InAppBrowserApp; os: InAppBrowserOs };

// Au-delà, l’en-tête n’est pas celui d’un vrai navigateur : rien n’est lu.
const MAX_USER_AGENT_LENGTH = 1024;

// Ordre significatif : Messenger et Instagram portent aussi des jetons Facebook.
const APP_PATTERNS: ReadonlyArray<[Exclude<InAppBrowserApp, "webview">, RegExp]> = [
  ["messenger", /\bFBAN\/Messenger|\bFB_IAB\/MESSENGER|\bMessengerForiOS|\bMessengerLite/i],
  ["instagram", /\bInstagram\b/i],
  ["facebook", /\bFBAN\/|\bFBAV\/|\bFB_IAB\/|\bFBIOS\b|\bFB4A\b|\[FB[A-Z_]+\//],
  ["tiktok", /\bmusical_ly|\bBytedanceWebview\b|\bTikTok\b|\btrill_\d/i],
  ["linkedin", /\bLinkedInApp\b/i],
];

// Vue web Android générique : Chrome y ajoute « ; wv) ».
const ANDROID_WEBVIEW = /;\s*wv\)/;
const IOS = /\b(iPhone|iPad|iPod)\b|\bFBIOS\b|\biOS\b|\bFBSN\/iPadOS\b/;
const ANDROID = /\bAndroid\b/i;

function osOf(userAgent: string): InAppBrowserOs {
  if (ANDROID.test(userAgent)) return "android";
  if (IOS.test(userAgent)) return "ios";
  return "other";
}

/** Vue web intégrée, quelle que soit l’application qui l’affiche. */
function isEmbeddedWebView(userAgent: string, os: InAppBrowserOs): boolean {
  if (os === "android") return ANDROID_WEBVIEW.test(userAgent);
  // WKWebView n’annonce pas « Safari/… », contrairement à Safari, Chrome,
  // Firefox et SFSafariViewController.
  if (os === "ios") return /AppleWebKit\//.test(userAgent) && !/\bSafari\//.test(userAgent);
  return false;
}

/**
 * Navigateur intégré détecté dans l’en-tête User-Agent, ou `null` pour un
 * navigateur ordinaire (ou un en-tête absent ou invalide).
 */
export function detectInAppBrowser(userAgent: string | null | undefined): InAppBrowser | null {
  if (typeof userAgent !== "string") return null;
  const ua = userAgent.trim();
  if (!ua || ua.length > MAX_USER_AGENT_LENGTH) return null;

  const os = osOf(ua);
  for (const [app, pattern] of APP_PATTERNS) {
    if (pattern.test(ua)) return { app, os };
  }
  // WhatsApp ouvre en général un onglet personnalisé : seule une vraie vue
  // web intégrée compte (son robot d’aperçu des liens porte aussi ce nom).
  if (/\bWhatsApp\b/i.test(ua)) return isEmbeddedWebView(ua, os) ? { app: "whatsapp", os } : null;
  // Autre application Android inconnue : Google la refuse tout autant. Sur
  // iOS, une application web installée sur l’écran d’accueil ressemble à une
  // vue intégrée : elle n’est pas visée.
  if (os === "android" && ANDROID_WEBVIEW.test(ua)) return { app: "webview", os };
  return null;
}

/** Nom affiché de l’application, pour « le navigateur intégré de … ». */
export function inAppBrowserLabel(app: InAppBrowserApp): string | null {
  switch (app) {
    case "facebook":
      return "Facebook";
    case "instagram":
      return "Instagram";
    case "messenger":
      return "Messenger";
    case "tiktok":
      return "TikTok";
    case "linkedin":
      return "LinkedIn";
    case "whatsapp":
      return "WhatsApp";
    default:
      return null;
  }
}

/**
 * Lien `intent://` qui rouvre la même adresse dans Chrome sur Android. Seules
 * les adresses http(s) sont acceptées ; le fragment est retiré, il couperait
 * la syntaxe de l’intent.
 */
export function androidChromeIntentUrl(pageUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  const scheme = url.protocol.slice(0, -1);
  return `intent://${url.host}${url.pathname}${url.search}#Intent;scheme=${scheme};package=com.android.chrome;end`;
}
