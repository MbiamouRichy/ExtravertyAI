"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import { isReturnAnchor } from "@/lib/return-anchor";

/** Délai maximal d'attente du bloc (chargement en streaming, squelettes). */
const WAIT_MS = 10_000;
const HIGHLIGHT_MS = 2_500;
const USER_INPUT = ["pointerdown", "keydown", "wheel", "touchmove"] as const;

/**
 * Après une reconnexion, ramène au bloc d'origine (#ancre) : attend qu'il soit
 * rendu, le centre à l'écran, lui donne le focus pour les lecteurs d'écran et
 * le met brièvement en évidence. Seuls les blocs marqués data-return-anchor
 * (voir lib/return-anchor.ts) sont concernés ; l'attente cesse dès que
 * l'utilisateur agit lui-même sur la page.
 */
export function ReturnToAnchor() {
  const pathname = usePathname();

  useEffect(() => {
    let anchor = "";
    try {
      anchor = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return;
    }
    if (!isReturnAnchor(anchor)) return;

    let observer: MutationObserver | undefined;
    let timeout: number | undefined;
    const stopWaiting = () => {
      observer?.disconnect();
      window.clearTimeout(timeout);
      for (const type of USER_INPUT) window.removeEventListener(type, stopWaiting);
    };

    const find = () => {
      const element = document.getElementById(anchor);
      return element?.hasAttribute("data-return-anchor") ? element : null;
    };

    const reveal = (element: HTMLElement) => {
      stopWaiting();
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      element.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
      element.focus({ preventScroll: true });
      element.setAttribute("data-returned", "");
      // Minuterie laissée au nettoyage : retirer l’attribut d’un bloc démonté est sans effet.
      window.setTimeout(() => element.removeAttribute("data-returned"), HIGHLIGHT_MS);
      // L'ancre a servi : un rechargement ne ramène plus la page sur ce bloc.
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    };

    const existing = find();
    if (existing) {
      reveal(existing);
    } else {
      observer = new MutationObserver(() => {
        const element = find();
        if (element) reveal(element);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      timeout = window.setTimeout(stopWaiting, WAIT_MS);
      for (const type of USER_INPUT)
        window.addEventListener(type, stopWaiting, { passive: true });
    }

    return stopWaiting;
  }, [pathname]);

  return null;
}
