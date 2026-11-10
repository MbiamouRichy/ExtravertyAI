// Suivi des erreurs côté serveur (pages, actions, routes, proxy), vers GlitchTip
// par le SDK Sentry. Sans ERROR_TRACKING_DSN, rien n’est initialisé.
import * as Sentry from "@sentry/nextjs";
import {
  baseErrorTrackingOptions,
  errorTrackingEnvironment,
  errorTrackingRelease,
} from "./lib/error-tracking/options";
import { parseDsn } from "./lib/error-tracking/tunnel";

export function register() {
  const dsn = parseDsn(process.env.ERROR_TRACKING_DSN);
  if (!dsn) return;
  Sentry.init(
    baseErrorTrackingOptions({
      dsn: dsn.dsn,
      environment: errorTrackingEnvironment(process.env),
      release: errorTrackingRelease(process.env),
    }),
  );
}

// Erreurs non rattrapées pendant le rendu, une action serveur ou une route.
export const onRequestError = Sentry.captureRequestError;
