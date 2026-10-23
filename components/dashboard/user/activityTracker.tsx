"use client";
import { useEffect } from "react";

/**
 * Geste récent qui rend un battement « actif ». Le serveur garde ce statut
 * 5 minutes : sans geste, le membre passe « Inactif » après 6 minutes environ.
 */
const IDLE_AFTER_MS = 60_000;

export function ActivityTracker() {
  useEffect(() => {
    const tabId = crypto.randomUUID();
    let lastInput = Date.now(),
      lastSent = 0;
    let pending = false,
      stopped = false;
    async function ping(force = false) {
      if (
        stopped ||
        pending ||
        !navigator.onLine ||
        (!force && Date.now() - lastSent < 15000)
      )
        return;
      pending = true;
      lastSent = Date.now();
      try {
        const result = await fetch("/api/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tabId,
            // Onglet affiché et utilisé récemment : lire une page compte aussi,
            // même si le focus est dans une autre fenêtre.
            active:
              document.visibilityState === "visible" &&
              Date.now() - lastInput < IDLE_AFTER_MS,
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (result.status === 401) stopped = true;
      } catch {
        /* Stale tabs expire server-side; retry at the next heartbeat. */
      } finally {
        pending = false;
      }
    }
    let wasIdle = false;
    const interaction = () => {
      lastInput = Date.now();
      // Retour après une pause : le statut « En ligne » revient tout de suite.
      if (wasIdle) {
        wasIdle = false;
        void ping(true);
      } else void ping();
    };
    const visible = () => {
      if (document.visibilityState === "visible") interaction();
      else void ping(true);
    };
    // Les défilements dans les panneaux internes ne remontent pas à la fenêtre :
    // écoute en capture.
    const events = [
      "pointerdown",
      "pointermove",
      "keydown",
      "wheel",
      "touchstart",
      "scroll",
    ] as const;
    events.forEach((event) =>
      window.addEventListener(event, interaction, {
        passive: true,
        capture: true,
      }),
    );
    window.addEventListener("focus", interaction);
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    void ping(true);
    // Battement même onglet masqué : le membre reste « Inactif » plutôt que hors ligne.
    const timer = setInterval(() => {
      if (Date.now() - lastInput >= IDLE_AFTER_MS) wasIdle = true;
      void ping();
    }, 20000);
    return () => {
      stopped = true;
      clearInterval(timer);
      events.forEach((event) =>
        window.removeEventListener(event, interaction, { capture: true }),
      );
      window.removeEventListener("focus", interaction);
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  return null;
}
