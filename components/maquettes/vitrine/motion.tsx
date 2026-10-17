"use client";

import { useRef, useSyncExternalStore, type ReactNode } from "react";
import {
  LazyMotion,
  MotionConfig,
  domMax,
  m,
  useInView,
  type Transition,
} from "motion/react";

export const EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const SPRING: Transition = { type: "spring", stiffness: 380, damping: 32, mass: 0.8 };

/** Loads motion features once and honours the visitor's reduced-motion setting. */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}

interface RevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/** Fades content up the first time it scrolls into view. */
export function Reveal({ children, className, delay = 0 }: RevealProps) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.8, ease: EASE_OUT, delay }}
    >
      {children}
    </m.div>
  );
}

function subscribeToVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function useDocumentVisible() {
  return useSyncExternalStore(
    subscribeToVisibility,
    () => document.visibilityState === "visible",
    () => true,
  );
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeToReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Unlike motion's `useReducedMotion`, this renders `false` during hydration and
 * only then switches, so the server and first client render always match.
 */
export function usePrefersReducedMotion() {
  return useSyncExternalStore(
    subscribeToReducedMotion,
    () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
    () => false,
  );
}

/**
 * Drives self-playing demos: they only run while on screen, while the tab is
 * visible and when the visitor has not asked for reduced motion.
 */
export function useAutoplay<T extends Element>(amount = 0.3) {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { amount });
  const visible = useDocumentVisible();
  const reduce = usePrefersReducedMotion();
  return { ref, inView, reduce, canPlay: inView && visible && !reduce };
}
