"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogIn } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";
import { reauthHref } from "@/lib/auth-redirects";
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

/**
 * Déconnecte puis ouvre la connexion. Une fois reconnecté, l’utilisateur
 * revient sur `callbackUrl` et, avec `anchor`, sur le bloc d’où il est parti
 * (voir ReturnToAnchor). Seule voie de reconnexion de l’espace connecté.
 */
export function useReauthenticate() {
  const router = useRouter();
  const [reconnecting, setReconnecting] = useState(false);

  async function reconnect(callbackUrl: string, anchor?: string) {
    setReconnecting(true);
    try {
      const result = await signOut();
      if (result.error) throw new Error("SIGN_OUT_FAILED");
      router.replace(reauthHref(callbackUrl, anchor));
      router.refresh();
    } catch {
      toast.error("Impossible de vous déconnecter. Réessayez.");
      setReconnecting(false);
    }
  }

  return { reconnecting, reconnect };
}

/** Affiche l’action sensible après une connexion récente, sinon la reconnexion. */
export function RecentSessionGate({
  sessionCreatedAt,
  callbackUrl,
  anchor,
  className,
  children,
}: {
  sessionCreatedAt: string;
  callbackUrl: string;
  /** Bloc où revenir après la reconnexion (id posé avec returnAnchor). */
  anchor?: string;
  /** Classes du bouton de reconnexion (largeur, retour à la ligne). */
  className?: string;
  children: ReactNode;
}) {
  const recentLogin = useRecentSession(sessionCreatedAt);
  if (recentLogin) return children;
  return (
    <ReauthButton
      callbackUrl={callbackUrl}
      anchor={anchor}
      label="Se reconnecter pour modifier"
      size="sm"
      className={className}
    />
  );
}

const COMPACT_LABEL = "Se reconnecter";

/**
 * Déconnecte puis renvoie vers la connexion, avec retour sur la page et le bloc voulus.
 *
 * Dans un bloc étroit (moins de 19rem dans le conteneur `@container` le plus
 * proche, téléphone compris), le libellé se réduit à « Se reconnecter » pour
 * tenir sur une ligne ; le libellé complet reste lu par les lecteurs d'écran.
 * Sans conteneur, le libellé complet s'affiche toujours.
 */
export function ReauthButton({
  callbackUrl,
  anchor,
  label = "Se reconnecter",
  variant = "outline",
  size = "default",
  className,
}: {
  callbackUrl: string;
  /** Bloc où revenir après la reconnexion (id posé avec returnAnchor). */
  anchor?: string;
  label?: string;
  variant?: "outline" | "destructive" | "default";
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const { reconnecting, reconnect } = useReauthenticate();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={reconnecting}
      aria-busy={reconnecting}
      onClick={() => void reconnect(callbackUrl, anchor)}
      className={className}
    >
      {reconnecting ? (
        <Loader2
          data-icon="inline-start"
          className="animate-spin motion-reduce:animate-none"
        />
      ) : (
        <LogIn data-icon="inline-start" />
      )}
      {reconnecting ? (
        "Reconnexion…"
      ) : label === COMPACT_LABEL ? (
        label
      ) : (
        <>
          <span className="@max-[19rem]:sr-only">{label}</span>
          <span aria-hidden="true" className="hidden @max-[19rem]:inline">
            {COMPACT_LABEL}
          </span>
        </>
      )}
    </Button>
  );
}
