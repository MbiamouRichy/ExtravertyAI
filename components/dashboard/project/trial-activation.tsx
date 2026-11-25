"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { retryTrialActivation } from "@/app/actions/billing-plan";
import { useChatRealtime } from "@/hooks/use-chat-data";

/**
 * Relance le premier prélèvement après une carte refusée. Le serveur revérifie
 * les droits et l'état de l'essai ; seul le worker de facturation appelle Polar.
 */
export function TrialActivationRetryButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function retry() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await retryTrialActivation(projectId);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else toast.error(result.error);
    } catch {
      toast.error("Le service de paiement est indisponible. Réessayez dans un instant.");
    }
    setBusy(false);
  }
  return (
    <Button
      className="h-auto min-h-10 w-full whitespace-normal sm:min-h-9 sm:w-auto"
      disabled={busy}
      aria-busy={busy}
      onClick={() => void retry()}
    >
      {busy ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
      ) : (
        <RotateCw aria-hidden="true" className="size-4" />
      )}
      Relancer le paiement
    </Button>
  );
}

/**
 * Paiement en cours : la page se met à jour dès que le worker a fini (temps
 * réel), avec une relecture lente en secours, limitée à quelques minutes.
 */
export function TrialActivationRefresh({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  useChatRealtime(projectId, () => startTransition(() => router.refresh()));
  useEffect(() => {
    let remaining = 20;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        startTransition(() => router.refresh());
      if (--remaining <= 0) clearInterval(timer);
    }, 15_000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
