"use client";
import { useEffect } from "react";
export function ActivityTracker() {
  useEffect(() => {
    const tabId = crypto.randomUUID();
    let lastInput = Date.now(),
      lastSent = 0;
    let pending = false,
      stopped = false;
    async function ping() {
      if (
        stopped ||
        pending ||
        document.visibilityState !== "visible" ||
        !navigator.onLine ||
        Date.now() - lastSent < 15000
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
            active: document.hasFocus() && Date.now() - lastInput < 20000,
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
    const interaction = () => {
      lastInput = Date.now();
      void ping();
    };
    const visible = () => {
      if (document.visibilityState === "visible") interaction();
    };
    const events = ["pointerdown", "keydown", "scroll"] as const;
    events.forEach((event) =>
      window.addEventListener(event, interaction, { passive: true }),
    );
    window.addEventListener("focus", interaction);
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    void ping();
    const timer = setInterval(() => void ping(), 20000);
    return () => {
      stopped = true;
      clearInterval(timer);
      events.forEach((event) => window.removeEventListener(event, interaction));
      window.removeEventListener("focus", interaction);
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  return null;
}
