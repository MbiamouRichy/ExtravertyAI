"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";
import {
  PROJECT_DELETION_SESSION_MAX_AGE_MS,
  isRecentSession,
} from "@/lib/recent-session";

/**
 * Connexion de moins de 10 minutes (heure de connexion fournie par le serveur).
 * Repasse à false à l’échéance, sans recharger la page. Indicatif seulement :
 * chaque suppression revérifie la connexion côté serveur.
 */
export function useRecentSession(sessionCreatedAt: string) {
  return useSyncExternalStore(
    (notify) => {
      const remaining =
        new Date(sessionCreatedAt).getTime() +
        PROJECT_DELETION_SESSION_MAX_AGE_MS -
        Date.now();
      if (!(remaining > 0)) return () => undefined;
      const timer = window.setTimeout(notify, remaining + 500);
      return () => window.clearTimeout(timer);
    },
    () => isRecentSession(sessionCreatedAt),
    () => isRecentSession(sessionCreatedAt),
  );
}

/** Affiche l’action sensible après une connexion récente, sinon la reconnexion. */
export function RecentSessionGate({
  sessionCreatedAt,
  callbackUrl,
  children,
}: {
  sessionCreatedAt: string;
  callbackUrl: string;
  children: ReactNode;
}) {
  const recentLogin = useRecentSession(sessionCreatedAt);
  if (recentLogin) return children;
  return (
    <ReauthButton
      callbackUrl={callbackUrl}
      label="Se reconnecter pour modifier"
      size="sm"
    />
  );
}

/** Déconnecte puis renvoie vers la connexion, avec retour sur la page voulue. */
export function ReauthButton({
  callbackUrl,
  label = "Se reconnecter",
  variant = "outline",
  size = "default",
  className,
}: {
  callbackUrl: string;
  label?: string;
  variant?: "outline" | "destructive" | "default";
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function reconnect() {
    setBusy(true);
    try {
      const result = await signOut();
      if (result.error) throw new Error("SIGN_OUT_FAILED");
      router.replace("/sign-in?callbackUrl=" + encodeURIComponent(callbackUrl));
      router.refresh();
    } catch {
      toast.error("Impossible de vous déconnecter. Réessayez.");
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={busy}
      aria-busy={busy}
      onClick={() => void reconnect()}
      className={className}
    >
      {busy ? (
        <Loader2
          data-icon="inline-start"
          className="animate-spin motion-reduce:animate-none"
        />
      ) : (
        <LogIn data-icon="inline-start" />
      )}
      {busy ? "Reconnexion…" : label}
    </Button>
  );
}
