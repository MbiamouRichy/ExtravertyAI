"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Signale à GlitchTip une erreur rattrapée par une page `error.tsx` : React
 * l’a interceptée, le navigateur ne la voit donc jamais passer. Sans suivi
 * configuré, l’appel ne fait rien.
 */
export function useReportError(error: Error & { digest?: string }) {
  useEffect(() => {
    Sentry.captureException(error, error.digest ? { tags: { digest: error.digest } } : undefined);
  }, [error]);
}
