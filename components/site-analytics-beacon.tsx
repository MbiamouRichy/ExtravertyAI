"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Une page vue par navigation, sans cookie. Le refus du suivi (GPC, Do Not
 * Track) est respecté avant tout envoi.
 */
export function SiteAnalyticsBeacon() {
  const pathname = usePathname();
  const first = useRef(true);
  const last = useRef<string | null>(null);

  useEffect(() => {
    if (!pathname || /^\/(admin|api)(\/|$)/.test(pathname)) return;
    // Un même chemin n'est compté qu'une fois d'affilée (double rendu, retour d'onglet).
    if (last.current === pathname) return;
    last.current = pathname;
    const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
    if (nav.globalPrivacyControl || nav.doNotTrack === "1") return;
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
