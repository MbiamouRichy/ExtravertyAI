"use client";
import { LocalDate } from "@/components/local-date";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { Loader2, LogOut, Monitor, Smartphone } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { disconnectSessions } from "@/app/actions/sessions";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import styles from "./recent-sessions.module.css";

type RecentSession = {
  id: string;
  browser: string;
  os: string;
  device: string;
  country: string;
  date: string;
  isCurrent: boolean;
};

export function RecentSessions({ sessions }: { sessions: RecentSession[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  function disconnect(sessionId?: string) {
    setPendingTarget(sessionId ?? "all");
    startTransition(async () => {
      try {
        const result = await disconnectSessions(
          sessionId ? { scope: "one", sessionId } : { scope: "all" },
        );
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        if (result.signedOut) {
          // Revocation has already succeeded; clear the browser cookie as well.
          try {
            await authClient.signOut();
          } catch {
            /* The session is already revoked. */
          }
          window.location.replace("/sign-in");
          return;
        }
        toast.success("Session déconnectée.");
        viewportRef.current?.focus({ preventScroll: true });
        router.refresh();
      } catch {
        toast.error("Impossible de déconnecter les sessions. Réessayez.");
      }
    });
  }

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const list = listRef.current;
    if (!viewport || !list) return;

    const updateEdges = () => {
      viewport.dataset.fadeTop = String(viewport.scrollTop > 1);
      viewport.dataset.fadeBottom = String(
        viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop > 1,
      );
    };
    const measure = () => {
      const lastVisible = list.children[Math.min(2, list.children.length) - 1];
      if (lastVisible) {
        // Keep exactly two complete rows visible, including wrapped mobile text.
        viewport.style.maxHeight = `${lastVisible.getBoundingClientRect().bottom - list.getBoundingClientRect().top}px`;
      }
      updateEdges();
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    for (const item of Array.from(list.children).slice(0, 2))
      observer.observe(item);
    viewport.addEventListener("scroll", updateEdges, { passive: true });
    return () => {
      observer.disconnect();
      viewport.removeEventListener("scroll", updateEdges);
    };
  }, [sessions]);

  if (sessions.length === 0) {
    return (
      <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground sm:p-5">
        Aucune connexion récente.
      </p>
    );
  }

  // Une seule carte : la déconnexion globale en tête, puis une ligne par
  // session (plus de cartes imbriquées qui réduisaient le texte sur mobile).
  return (
    <div className="overflow-hidden rounded-2xl border bg-card" aria-busy={isPending}>
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-5">
        <p className="text-xs text-muted-foreground">
          {sessions.length} session{sessions.length > 1 ? "s" : ""} active
          {sessions.length > 1 ? "s" : ""}. La déconnexion globale inclut cet
          appareil.
        </p>
        <Button
          className="h-auto min-h-10 w-full shrink-0 whitespace-normal sm:min-h-9 sm:w-auto"
          variant="outline"
          disabled={isPending}
          onClick={() => disconnect()}
        >
          {isPending && pendingTarget === "all" ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <LogOut aria-hidden="true" />
          )}
          <span className="sm:hidden">Tout déconnecter</span>
          <span className="max-sm:hidden">Déconnecter toutes les sessions</span>
        </Button>
      </div>
      <div className={styles.container}>
        <div
          ref={viewportRef}
          role="region"
          aria-label="Connexions récentes"
          tabIndex={sessions.length > 2 ? 0 : -1}
          className="max-h-64 overflow-y-auto overscroll-y-contain focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          <ul ref={listRef} className="divide-y">
            {sessions.map((session) => (
              // Mobile : icône et appareil en tête, puis lieu, date et bouton
              // sur toute la largeur. Dès sm : bouton à droite.
              <li
                key={session.id}
                className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-4 sm:px-5"
              >
                <div
                  className="shrink-0 rounded-full bg-primary/10 p-2 text-primary sm:row-span-2"
                  aria-hidden="true"
                >
                  {session.device === "Mobile" ? (
                    <Smartphone className="size-5" />
                  ) : (
                    <Monitor className="size-5" />
                  )}
                </div>
                <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium sm:self-end">
                  <span className="min-w-0 break-words">
                    {session.device} · {session.os} · {session.browser}
                  </span>
                  {session.isCurrent && (
                    <Badge variant="default">Actuelle</Badge>
                  )}
                </p>
                <p className="col-span-2 mt-2 break-words text-xs text-muted-foreground sm:col-span-1 sm:col-start-2 sm:mt-0.5 sm:self-start">
                  {session.country} · Connecté le{" "}
                  <LocalDate value={session.date} />
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="col-span-2 mt-3 min-h-10 sm:col-span-1 sm:col-start-3 sm:row-span-2 sm:row-start-1 sm:mt-0 sm:min-h-8"
                  disabled={isPending}
                  onClick={() => disconnect(session.id)}
                  aria-label={`Déconnecter ${session.device}, ${session.os}, ${session.browser}, ${session.country}${session.isCurrent ? ", session actuelle" : ""}`}
                >
                  {isPending && pendingTarget === session.id ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    <LogOut aria-hidden="true" />
                  )}
                  {session.isCurrent ? "Se déconnecter" : "Déconnecter"}
                </Button>
              </li>
            ))}
          </ul>
        </div>
        <div aria-hidden="true" className={styles.fadeTop} />
        <div aria-hidden="true" className={styles.fadeBottom} />
      </div>
    </div>
  );
}
