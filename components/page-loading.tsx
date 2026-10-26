import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Cadre commun des pages de chargement : barre qui coulisse en haut de la
 * zone, reflet sur les squelettes et annonce accessible du chargement.
 */
export function PageLoading({
  label,
  className,
  children,
}: {
  /** Texte lu par les lecteurs d’écran, ex. « Chargement des rapports… ». */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div aria-busy="true" className={cn("relative min-w-0", className)}>
      <p role="status" className="sr-only">
        {label}
      </p>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-muted"
      >
        <div className="loading-bar h-full w-1/3 rounded-full bg-foreground/50" />
      </div>
      <div aria-hidden="true" className="skeleton-shimmer contents">
        {children}
      </div>
    </div>
  );
}
