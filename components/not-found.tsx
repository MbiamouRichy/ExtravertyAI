import type { ReactNode } from "react";

import { NotFoundBackButton } from "./not-found-back-button";

/**
 * Page introuvable, commune au site et à l’espace projets. Pas de largeur
 * d’écran forcée : elle se loge aussi bien seule qu’à côté de la barre latérale.
 * Téléphone : actions empilées en pleine largeur ; dès sm, côte à côte.
 */
export function NotFoundPage({
  action,
  fallbackHref,
}: {
  /** Lien principal (accueil ou projets), rendu par la page appelante. */
  action: ReactNode;
  /** Destination de « Retour » quand l’onglet n’a pas d’historique. */
  fallbackHref: string;
}) {
  return (
    <div className="flex min-h-[70svh] w-full min-w-0 items-center justify-center px-4 py-12 sm:py-20">
      <div className="flex w-full max-w-md flex-col items-center text-center">
        <p
          aria-hidden="true"
          className="mask-b-from-30% mask-b-to-95% font-mono text-8xl leading-none font-bold tracking-tighter tabular-nums select-none sm:text-9xl"
        >
          404
        </p>
        <h1 className="mt-4 font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          <span className="sr-only">Erreur 404 : </span>
          Page introuvable
        </h1>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-pretty text-muted-foreground sm:text-base">
          Le lien est peut-être incorrect, ou la page a été déplacée ou
          supprimée.
        </p>
        <div className="mt-8 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:justify-center [&>*]:w-full sm:[&>*]:w-auto">
          {action}
          <NotFoundBackButton fallbackHref={fallbackHref} />
        </div>
      </div>
    </div>
  );
}
