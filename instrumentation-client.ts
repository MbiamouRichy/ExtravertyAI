// Suivi des erreurs du navigateur, vers GlitchTip par le SDK Sentry.
// Les envois passent par /api/monitoring (même origine) : ni bloqueur de
// publicité, ni domaine tiers. Sans NEXT_PUBLIC_ERROR_TRACKING_DSN, rien
// n’est initialisé et le SDK reste inactif.
import * as Sentry from "@sentry/nextjs";
import {
  baseErrorTrackingOptions,
  errorTrackingEnvironment,
  errorTrackingRelease,
} from "./lib/error-tracking/options";
import { parseDsn } from "./lib/error-tracking/tunnel";

const dsn = parseDsn(process.env.NEXT_PUBLIC_ERROR_TRACKING_DSN);

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
