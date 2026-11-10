// Réglages communs du SDK Sentry, utilisé ici avec GlitchTip (compatible).
// Erreurs seulement : ni suivi des performances, ni sessions, ni données
// personnelles. Sans DSN, rien n’est initialisé et rien ne part.
import { scrubEvent, scrubValue } from "./scrub";

/** Environnement affiché dans GlitchTip : production, preview ou development. */
export function errorTrackingEnvironment(env: Record<string, string | undefined>) {
  return (
    env.ERROR_TRACKING_ENVIRONMENT ||
    env.NEXT_PUBLIC_VERCEL_ENV ||
    env.VERCEL_ENV ||
    (env.NODE_ENV === "production" ? "production" : "development")
  );
}

/** Version déployée : le commit, pour relier une erreur à un déploiement. */
export function errorTrackingRelease(env: Record<string, string | undefined>) {
  const sha =
    env.VERCEL_GIT_COMMIT_SHA || env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || env.GIT_COMMIT_SHA;
  return sha && /^[0-9a-f]{7,40}$/i.test(sha) ? sha.slice(0, 12) : undefined;
}

export function baseErrorTrackingOptions(options: {
  dsn: string;
  environment: string;
  release?: string;
}) {
  return {
    dsn: options.dsn,
    environment: options.environment,
    release: options.release,
    sendDefaultPii: false,
    // Erreurs uniquement : GlitchTip ne sert pas ici au suivi des performances.
    tracesSampleRate: 0,
    sendClientReports: false,
    maxBreadcrumbs: 30,
    beforeSend<E extends object>(event: E): E {
      return scrubEvent(event);
    },
    beforeBreadcrumb<B extends object>(breadcrumb: B): B {
      return scrubValue(breadcrumb);
    },
  };
}
