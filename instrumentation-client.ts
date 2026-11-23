// Suivi des erreurs du navigateur, vers GlitchTip par le SDK Sentry.
// Les envois passent par /api/monitoring (même origine) : ni bloqueur de
// publicité, ni domaine tiers. Sans NEXT_PUBLIC_ERROR_TRACKING_DSN, rien
// n’est initialisé et le SDK reste inactif.
import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import {
  baseErrorTrackingOptions,
  errorTrackingEnvironment,
  errorTrackingRelease,
} from "./lib/error-tracking/options";
import { parseDsn } from "./lib/error-tracking/tunnel";
import { browserRefusesTracking } from "./lib/tracking-consent";
import { reloadOnceAfterChunkError } from "./lib/chunk-reload";

const dsn = parseDsn(process.env.NEXT_PUBLIC_ERROR_TRACKING_DSN);
const posthogToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

// PostHog suit les mêmes règles que la mesure d’audience : rien si le
// navigateur refuse le suivi, aucun cookie ni stockage local, et aucun texte
// de l’interface (messages, coordonnées) dans les clics ou les enregistrements.
if (browserRefusesTracking()) {
  // Refus du suivi : PostHog ne démarre pas, ses appels restent sans effet.
} else if (posthogToken && posthogHost) {
  posthog.init(posthogToken, {
    api_host: posthogHost,
    defaults: "2026-08-30",
    persistence: "memory",
    mask_all_text: true,
    mask_all_element_attributes: true,
    session_recording: { maskAllInputs: true, maskTextSelector: "*" },
    capture_exceptions: true,
    debug: process.env.NODE_ENV === "development",
  });
} else if (process.env.NODE_ENV === "development") {
  console.error(
    posthogToken
      ? "NEXT_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_HOST is configured"
      : "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
  );
}

// Fichier JavaScript disparu après un déploiement (ChunkLoadError) : la page
// est rechargée une fois pour récupérer la nouvelle version. Les erreurs
// rattrapées par une page error.tsx passent par useReportError.
window.addEventListener("unhandledrejection", (event) => {
  reloadOnceAfterChunkError(event.reason);
});
window.addEventListener("error", (event) => {
  reloadOnceAfterChunkError(event.error);
});

if (dsn) {
  try {
    Sentry.init({
      ...baseErrorTrackingOptions({
        dsn: dsn.dsn,
        environment: errorTrackingEnvironment({
          NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
          NODE_ENV: process.env.NODE_ENV,
        }),
        release: errorTrackingRelease({
          NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
        }),
      }),
      tunnel: "/api/monitoring",
      // GlitchTip ne lit pas les sessions : inutile de les envoyer depuis un
      // téléphone au forfait limité.
      integrations: (defaults) =>
        defaults.filter((integration) => integration.name !== "BrowserSession"),
    });
  } catch {
    // Le suivi des erreurs ne doit jamais empêcher l’app de démarrer.
  }
}
