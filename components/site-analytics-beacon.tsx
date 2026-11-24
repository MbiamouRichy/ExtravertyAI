"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import posthog from "posthog-js";

import { readGoogleSignUp, rememberArrivalCampaign } from "@/lib/auth-analytics";
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

  // Avant l'effet suivant, qui retire la campagne de l'adresse au retour de Google.
  useEffect(() => {
    rememberArrivalCampaign(window.location.search);
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    // Retour de Google pour un nouveau compte (googleSignUpReturn) : marqueur
    // et campagne quittent l'adresse, un rechargement ne recompte donc pas.
    const signUp = readGoogleSignUp(window.location.href);
    if (signUp) window.history.replaceState(null, "", signUp.cleanUrl);
    // PostHog n'est pas démarré si le suivi est refusé ou non configuré.
    if (!posthog.__loaded) return;
    // L'identifiant du compte seul : ni e-mail ni nom chez PostHog. Il ne
    // change pas avec le profil, et le rappeler au chargement suffit à
    // retrouver la personne après un rafraîchissement.
    posthog.identify(userId);
    // Même événement que l'inscription par e-mail (EmailOtpStep).
    if (signUp)
      posthog.capture("account_created", { auth_method: "google", ...signUp.campaign });
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
