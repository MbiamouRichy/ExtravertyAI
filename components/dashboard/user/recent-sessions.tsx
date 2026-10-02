"use client";

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
  ip: string;
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
      <p className="text-sm text-muted-foreground">Aucune connexion récente.</p>
    );
  }

  return (
    <div className="space-y-4" aria-busy={isPending}>
      <div className="flex flex-col items-start gap-2">
        <Button
          className="h-auto w-full whitespace-normal sm:w-auto"
          variant="outline"
          disabled={isPending}
          onClick={() => disconnect()}
        >
          {isPending && pendingTarget === "all" ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <LogOut aria-hidden="true" />
          )}
          Déconnecter toutes les sessions
        </Button>
        <p className="text-xs text-muted-foreground">
          {sessions.length} session{sessions.length > 1 ? "s" : ""} active
          {sessions.length > 1 ? "s" : ""}. La déconnexion globale inclut cet
          appareil.
        </p>
      </div>
      <div className={styles.container}>
        <div
          ref={viewportRef}
          role="region"
          aria-label="Connexions récentes"
          tabIndex={sessions.length > 2 ? 0 : -1}
          className="max-h-64 overflow-y-auto overscroll-y-contain rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ul ref={listRef} className="flex flex-col gap-4">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="flex items-start gap-3 rounded-lg border bg-card p-4 sm:items-center"
              >
                <div
                  className="shrink-0 rounded-full bg-primary/10 p-2 text-primary"
                  aria-hidden="true"
                >
                  {session.device === "Mobile" ? (
                    <Smartphone className="size-5" />
                  ) : (
                    <Monitor className="size-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="break-words text-sm font-medium">
                      {session.device} • {session.os} - {session.browser}
                    </p>
                    {session.isCurrent && (
                      <Badge variant="default">Actuelle</Badge>
                    )}
                  </div>
                  <p className="mt-0.5 break-words text-xs text-muted-foreground">
                    {session.ip} • Connecté le {session.date}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    disabled={isPending}
                    onClick={() => disconnect(session.id)}
                    aria-label={`Déconnecter ${session.device}, ${session.os}, ${session.browser}, ${session.ip}, connecté le ${session.date}${session.isCurrent ? ", session actuelle" : ""}`}
                  >
                    {isPending && pendingTarget === session.id ? (
                      <Loader2 className="animate-spin" aria-hidden="true" />
                    ) : (
                      <LogOut aria-hidden="true" />
                    )}
                    {session.isCurrent ? "Se déconnecter" : "Déconnecter"}
                  </Button>
                </div>
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
