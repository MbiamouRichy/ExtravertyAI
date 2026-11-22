"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";

import { useSession } from "@/lib/auth-client";
import { browserRefusesTracking } from "@/lib/tracking-consent";

/**
 * Une page vue par navigation, sans cookie. Le refus du suivi (GPC, Do Not
 * Track) est respecté avant tout envoi.
 */
export function SiteAnalyticsBeacon() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const first = useRef(true);
  const last = useRef<string | null>(null);

  useEffect(() => {
    const userId = session?.user?.id;
    // PostHog n'est pas démarré si le suivi est refusé ou non configuré.
    if (!userId || !posthog.__loaded) return;
    // L'identifiant du compte seul : ni e-mail ni nom chez PostHog. Il ne
    // change pas avec le profil, et le rappeler au chargement suffit à
    // retrouver la personne après un rafraîchissement.
    posthog.identify(userId);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!pathname || /^\/(admin|api)(\/|$)/.test(pathname)) return;
    // Un même chemin n'est compté qu'une fois d'affilée (double rendu, retour d'onglet).
    if (last.current === pathname) return;
    last.current = pathname;
    if (browserRefusesTracking()) return;
    const nav = navigator;
    // Le site d'origine n'a de sens qu'à l'arrivée, pas entre deux pages internes.
    const referrer = first.current ? document.referrer : "";
    first.current = false;
    const body = JSON.stringify({ path: pathname, referrer });
    try {
      if (!nav.sendBeacon?.("/api/pv", new Blob([body], { type: "text/plain" })))
        void fetch("/api/pv", { method: "POST", body, keepalive: true }).catch(() => {});
    } catch {
      // Mesure facultative : jamais d'erreur visible.
    }
  }, [pathname]);

  return null;
}
