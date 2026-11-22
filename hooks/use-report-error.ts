"use client";

import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { useEffect } from "react";

/**
 * Signale une erreur rattrapée par une page `error.tsx` : React l’a
 * interceptée, le navigateur ne la voit donc jamais passer. Sans suivi
 * configuré, les appels ne font rien.
 */
export function useReportError(error: Error & { digest?: string }) {
  useEffect(() => {
    Sentry.captureException(error, error.digest ? { tags: { digest: error.digest } } : undefined);
    posthog.captureException(error);
  }, [error]);
}
