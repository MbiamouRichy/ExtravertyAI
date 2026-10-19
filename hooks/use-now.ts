"use client";

import { useSyncExternalStore } from "react";

// One shared ticker for every relative time on screen.
const TICK_MS = 30_000;
let current = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      listeners.forEach((notify) => notify());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

function getSnapshot() {
  if (!current) current = Date.now();
  return current;
}

/**
 * Current time refreshed every 30 s, or `null` during server rendering and
 * hydration so relative labels never cause a hydration mismatch.
 */
export function useNow(): number | null {
  const now = useSyncExternalStore(subscribe, getSnapshot, () => 0);
  return now || null;
}

/** « 4 min », « 2 h », « 3 j » : compact duration for list badges. */
export function formatWaiting(since: string, now: number): string {
  const minutes = Math.max(0, Math.floor((now - new Date(since).getTime()) / 60_000));
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  return `${Math.floor(hours / 24)} j`;
}
