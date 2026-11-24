"use client";

import * as Sentry from "@sentry/nextjs";
import posthog from "posthog-js";
import { useEffect } from "react";
import { reloadOnceAfterChunkError } from "@/lib/chunk-reload";

/**
 * Signale une erreur rattrapée par une page `error.tsx` : React l’a
 * interceptée, le navigateur ne la voit donc jamais passer. Sans suivi
 * configuré, les appels ne font rien. Un fichier JavaScript disparu après un
 * déploiement (ChunkLoadError) recharge la page une fois, au lieu d’afficher
 * l’erreur.
 */
export function useReportError(error: Error & { digest?: string }) {
  useEffect(() => {
    Sentry.captureException(error, error.digest ? { tags: { digest: error.digest } } : undefined);
    posthog.captureException(error);
    reloadOnceAfterChunkError(error);
  }, [error]);
}
