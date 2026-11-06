"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  cancelProjectSubscription,
  openProjectBillingPortal,
} from "@/app/actions/project-settings";
import { BillingPlanButton } from "./billing-plan-button";
import { LocalBillingDate } from "./local-billing-date";
import { ReauthButton, useRecentSession } from "../user/recent-session";

export type BillingCancellation = {
  /** Abonnement à jour : il s'arrête en fin de période, sinon tout de suite. */
  atPeriodEnd: boolean;
  trial: boolean;
  endsAt: Date | number | null | undefined;
};

/** Une action principale selon l'état de l'abonnement, et l'accès au portail. */
export function BillingActions({
  projectId,
  configured,
  needsCheckout = false,
  primary,
}: {
  projectId: string;
  configured: boolean;
  /** Paiement initial jamais abouti : seule action utile, le reprendre. */
  needsCheckout?: boolean;
  primary: { intent: "renew" | "upgrade"; label: string } | null;
}) {
  const [busy, setBusy] = useState(false);
  async function openPortal() {
    setBusy(true);
    try {
      const result = await openProjectBillingPortal(projectId);
      if (result.success) window.location.assign(result.url);
      else toast.error(result.error);
    } catch {
      toast.error("Le portail est temporairement indisponible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }
  if (needsCheckout)
    return <BillingPlanButton projectId={projectId} intent="renew" needsCheckout />;
  return (
    <div className="flex flex-col gap-2 min-[400px]:grid min-[400px]:grid-cols-2 sm:flex sm:flex-row">
      <Button
        variant="outline"
        className="h-auto min-h-9 whitespace-normal"
        disabled={busy || !configured}
        aria-busy={busy}
        onClick={() => void openPortal()}
      >
        {busy ? (
          <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
        ) : (
          <ArrowUpRight aria-hidden="true" className="size-4" />
        )}
        Gérer le paiement
      </Button>
      {primary && (
        <BillingPlanButton
          projectId={projectId}
          intent={primary.intent}
          label={primary.label}
          variant="default"
          disabled={!configured}
        />
      )}
    </div>
  );
}

/**
 * Résiliation, en bas de page. Le bouton ne s'active qu'avec une connexion de
 * moins de 10 minutes ; le serveur le revérifie à la confirmation.
 */
export function BillingCancelSection({
  projectId,
  sessionCreatedAt,
  cancellation,
}: {
  projectId: string;
  sessionCreatedAt: string;
  cancellation: BillingCancellation;
}) {
  const router = useRouter();
  const recentLogin = useRecentSession(sessionCreatedAt);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      const result = await cancelProjectSubscription(projectId);
      if (!result.success) {
        toast.error(result.error);
        if ("code" in result) setOpen(false);
        return;
      }
      toast.success(
        cancellation.atPeriodEnd
          ? "Résiliation programmée. Vous pouvez réactiver l’abonnement jusqu’à la fin de la période."
          : "Abonnement résilié.",
      );
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("La résiliation n’a pas été confirmée. Réessayez.");
    } finally {
      setBusy(false);
    }
  }
  const date = cancellation.endsAt ? (
    <strong className="font-medium text-foreground">
      <LocalBillingDate value={cancellation.endsAt} dateOnly />
    </strong>
  ) : null;
  return (
    <section
      aria-labelledby="cancel-title"
      className="flex flex-col gap-4 border-t pt-8 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <h2 id="cancel-title" className="text-sm font-medium">
          Résilier l’abonnement
        </h2>
        <p className="mt-1 max-w-lg text-sm text-muted-foreground">
          {cancellation.atPeriodEnd
            ? "Aucun nouveau prélèvement. Votre offre reste active jusqu’à la fin de la période en cours."
            : "Le paiement en attente est abandonné et l’abonnement s’arrête immédiatement."}
          {!recentLogin &&
            " Par sécurité, reconnectez-vous d’abord : la résiliation reste possible 10 minutes après la connexion."}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        {!recentLogin && (
          <ReauthButton
            callbackUrl={`/projects/${projectId}/billing`}
            label="Se reconnecter"
          />
        )}
        <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
          <Button
            variant="destructive"
            disabled={!recentLogin}
            onClick={() => setOpen(true)}
          >
            Résilier
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Résilier l’abonnement ?</AlertDialogTitle>
              <AlertDialogDescription>
                {!cancellation.atPeriodEnd ? (
                  <>
                    Le paiement en attente est abandonné et l’abonnement
                    s’arrête immédiatement. Vous pourrez souscrire de nouveau à
                    tout moment.
                  </>
                ) : cancellation.trial ? (
                  <>
                    Votre essai reste actif{date ? <> jusqu’au {date}</> : " jusqu’à son terme"}, et
                    vous ne serez pas prélevé. Vous pouvez réactiver
                    l’abonnement d’ici là.
                  </>
                ) : (
                  <>
                    Votre offre reste active{date ? <> jusqu’au {date}</> : " jusqu’à la fin de la période"}, puis
                    aucun nouveau paiement n’est prélevé. Vous pouvez réactiver
                    l’abonnement d’ici là.
                  </>
                )}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Garder l’abonnement</AlertDialogCancel>
              <Button variant="destructive" disabled={busy} onClick={() => void confirm()}>
                {busy && (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
                )}
                {busy ? "Résiliation…" : "Résilier"}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
