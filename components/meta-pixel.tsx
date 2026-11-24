"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { useSession } from "@/lib/auth-client";
import {
  claimRegistrationSignal,
  isFreshAccount,
  isMetaTrackableLocation,
  isMetaTrackablePath,
  parseMetaPixelId,
} from "@/lib/meta-pixel";
import { browserRefusesTracking } from "@/lib/tracking-consent";

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  push: Fbq;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
  allowDuplicatePageViews?: boolean;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

const PIXEL_ID = parseMetaPixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID);
const SCRIPT_SRC = "https://connect.facebook.net/en_US/fbevents.js";

/** Installe la file d’attente `fbq` et le script de Meta, une seule fois. */
function installPixel(pixelId: string): Fbq {
  if (window.fbq) return window.fbq;
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  // Le script compte sinon de lui-même chaque changement d’adresse, y compris
  // vers l’espace connecté : les pages vues sont envoyées ci-dessous, filtrées.
  fbq.disablePushState = true;
  // Sans suivi automatique, Meta ignore sinon toute page vue après la première.
  fbq.allowDuplicatePageViews = true;
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = SCRIPT_SRC;
  document.head.appendChild(script);

  // Pas de collecte automatique des clics ni des libellés de boutons, et
  // aucune donnée de compte transmise : seulement les événements ci-dessous.
  fbq("set", "autoConfig", false, pixelId);
  fbq("init", pixelId);
  return fbq;
}

/**
 * Pixel prêt à l’emploi, chargé au premier appel depuis une page publique :
 * l’espace connecté ouvert directement ne contacte jamais Meta. `null` sans
 * identifiant configuré ou si le navigateur refuse le suivi.
 */
function pixelFor(): Fbq | null {
  if (!PIXEL_ID || browserRefusesTracking()) return null;
  return installPixel(PIXEL_ID);
}

/** Adresse affichée, paramètres compris : c’est elle que Meta reçoit. */
function currentLocationTrackable(): boolean {
  return isMetaTrackableLocation(window.location.pathname, window.location.search);
}

/**
 * Pixel Meta des pages publiques : une page vue par navigation et le signal
 * d’inscription à l’arrivée d’un compte tout juste créé (e-mail ou Google).
 * Inactif sans `NEXT_PUBLIC_META_PIXEL_ID` ou si le navigateur refuse le suivi.
 */
export function MetaPixel() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const lastPath = useRef<string | null>(null);

  const trackable = isMetaTrackablePath(pathname);

  useEffect(() => {
    if (!trackable || !pathname || lastPath.current === pathname) return;
    if (!currentLocationTrackable()) return;
    const fbq = pixelFor();
    if (!fbq) return;
    lastPath.current = pathname;
    fbq("track", "PageView");
  }, [trackable, pathname]);

  const userId = session?.user?.id;
  const createdAt = session?.user?.createdAt;
  useEffect(() => {
    if (!trackable || !userId || !isFreshAccount(createdAt)) return;
    if (!currentLocationTrackable()) return;
    const fbq = pixelFor();
    if (!fbq) return;
    let storage: Storage | null = null;
    try {
      storage = window.localStorage;
    } catch {
      storage = null;
    }
    if (!claimRegistrationSignal(storage, userId)) return;
    fbq("track", "CompleteRegistration");
  }, [trackable, userId, createdAt]);

  return null;
}
