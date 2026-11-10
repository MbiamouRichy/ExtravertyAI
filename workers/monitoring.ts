// Suivi des erreurs des workers (GlitchTip, par le SDK Sentry pour Node).
//
// Sans ERROR_TRACKING_DSN, seuls les journaux habituels sont écrits. Une boucle
// qui échoue toutes les deux secondes ne doit pas noyer GlitchTip : chaque
// cycle est signalé au plus une fois toutes les dix minutes, avec le nombre
// d’échecs survenus entre-temps.
import * as Sentry from "@sentry/node";
import {
  baseErrorTrackingOptions,
  errorTrackingEnvironment,
  errorTrackingRelease,
} from "../lib/error-tracking/options";
import { parseDsn } from "../lib/error-tracking/tunnel";

const REPORT_INTERVAL_MS = 10 * 60 * 1000;
const lastReport = new Map<string, { at: number; skipped: number }>();
let enabled = false;

export function initWorkerMonitoring(worker: string) {
  const dsn = parseDsn(process.env.ERROR_TRACKING_DSN);
  if (!dsn) return;
  Sentry.init({
    ...baseErrorTrackingOptions({
      dsn: dsn.dsn,
      environment: errorTrackingEnvironment(process.env),
      release: errorTrackingRelease(process.env),
    }),
    serverName: worker,
    initialScope: { tags: { worker } },
  });
  enabled = true;
}

/** Écrit le message habituel et signale l’erreur, au plus une fois par période. */
export function reportWorkerError(message: string, error: unknown) {
  console.error(message);
  if (!enabled) return;
  const now = Date.now();
  const previous = lastReport.get(message);
  if (previous && now - previous.at < REPORT_INTERVAL_MS) {
    previous.skipped += 1;
    return;
  }
  lastReport.set(message, { at: now, skipped: 0 });
  Sentry.withScope((scope) => {
    scope.setTag("cycle", message);
    if (previous?.skipped) scope.setExtra("échecs non signalés depuis le dernier envoi", previous.skipped);
    Sentry.captureException(error);
  });
}

/** À l’arrêt : laisse partir les derniers événements. */
export async function flushWorkerMonitoring() {
  if (enabled) await Sentry.flush(3000).catch(() => false);
}
