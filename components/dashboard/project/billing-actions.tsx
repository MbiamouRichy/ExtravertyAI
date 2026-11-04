"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, CircleX, Loader2 } from "lucide-react";
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

export type BillingCancellation = {
  /** Abonnement à jour : il s'arrête en fin de période, sinon tout de suite. */
  atPeriodEnd: boolean;
  trial: boolean;
  endsAt: Date | number | null | undefined;
};

export function BillingActions({
  projectId,
  canManage,
  configured,
  needsCheckout = false,
  cancellation = null,
}: {
  projectId: string;
  canManage: boolean;
  configured: boolean;
  /** Paiement initial jamais abouti : seule action utile, le reprendre. */
  needsCheckout?: boolean;
  /** Null quand l'abonnement est déjà terminé ou sa résiliation programmée. */
  cancellation?: BillingCancellation | null;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function openPortal() {
    setBusy(true);
    setError("");
    try {
      const result = await openProjectBillingPortal(projectId);
      if (result.success) window.location.assign(result.url);
      else setError(result.error);
    } catch {
      setError("Le portail est temporairement indisponible. Réessayez.");
    } finally {
      setBusy(false);
    }
  }
  if (needsCheckout)
    return canManage ? (
      <div className="min-w-0 space-y-2">
        <BillingPlanButton projectId={projectId} intent="renew" needsCheckout />
        <p className="max-w-xs text-xs text-muted-foreground">
          Le paiement n’a pas abouti. Reprenez-le pour activer l’essai de 10 jours.
        </p>
      </div>
    ) : null;
  return (
    <div className="min-w-0 space-y-3">
      <div className="grid grid-cols-2 gap-2 *:first:col-span-2 sm:flex sm:flex-wrap sm:*:first:col-span-1">
        {canManage && (
          <>
            <BillingPlanButton projectId={projectId} intent="renew" disabled={!configured} />
            <BillingPlanButton projectId={projectId} intent="upgrade" disabled={!configured} />
          </>
        )}
        {canManage && (
          <Button
            variant="outline"
            className="h-auto min-h-9 whitespace-normal text-center"
            disabled={busy || !configured}
            onClick={() => void openPortal()}
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <ArrowUpRight className="size-4" aria-hidden="true" />
            )}
            Gérer l’abonnement
          </Button>
        )}
        {canManage && cancellation && (
          <CancelSubscriptionButton projectId={projectId} cancellation={cancellation} />
        )}
      </div>
      {error && (
        <p role="alert" className="max-w-md text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

function CancelSubscriptionButton({
  projectId,
  cancellation,
}: {
  projectId: string;
  cancellation: BillingCancellation;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      const result = await cancelProjectSubscription(projectId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        cancellation.atPeriodEnd
          ? "Résiliation programmée. Vous pouvez renouveler le plan jusqu’à la fin de la période."
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
    <strong className="text-foreground">
      <LocalBillingDate value={cancellation.endsAt} dateOnly />
    </strong>
  ) : null;
  return (
    <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
      <Button
        variant="destructive"
        className="col-span-2 h-auto min-h-9 whitespace-normal text-center sm:col-span-1"
        onClick={() => setOpen(true)}
      >
        <CircleX className="size-4" aria-hidden="true" />
        Résilier l’abonnement
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Résilier l’abonnement ?</AlertDialogTitle>
          <AlertDialogDescription>
            {!cancellation.atPeriodEnd ? (
              <>
                Le paiement en attente est abandonné et l’abonnement s’arrête
                immédiatement. Vous pourrez souscrire de nouveau à tout moment.
              </>
            ) : cancellation.trial ? (
              <>
                Votre essai reste actif{date ? <> jusqu’au {date}</> : " jusqu’à son terme"}, et
                vous ne serez pas prélevé. Vous pouvez changer d’avis d’ici là
                avec « Renouveler le plan ».
              </>
            ) : (
              <>
                Votre offre reste active{date ? <> jusqu’au {date}</> : " jusqu’à la fin de la période"}, puis
                aucun nouveau paiement n’est prélevé. Vous pouvez changer d’avis
                d’ici là avec « Renouveler le plan ».
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Garder l’abonnement</AlertDialogCancel>
          <Button variant="destructive" disabled={busy} onClick={() => void confirm()}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {busy ? "Résiliation…" : "Résilier"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
