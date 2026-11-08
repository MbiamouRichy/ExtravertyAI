"use client";
import { useState } from "react";
import { Loader2, RefreshCw, ArrowUpRight, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  NumberVerification,
  toCheckoutAttempt,
} from "@/components/dashboard/project/number-verification";
import { cn } from "@/lib/utils";
import { openProjectBillingPortal } from "@/app/actions/project-settings";
import { resumeProjectCheckout } from "@/app/actions/stripe-actions";
export function BillingPlanButton({
  projectId,
  intent,
  disabled = false,
  size = "default",
  label,
  variant,
  className,
  needsCheckout = false,
}: {
  projectId: string;
  intent: "renew" | "upgrade";
  /** Paiement initial jamais abouti : on repart sur un Checkout Stripe. */
  needsCheckout?: boolean;
  disabled?: boolean;
  size?: "default" | "sm" | "lg";
  /** Overrides the default label (e.g. a contextual upsell). */
  label?: string;
  variant?: "default" | "outline";
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  // Le numéro a déjà eu son essai : paiement immédiat, confirmé explicitement.
  const [confirmPaid, setConfirmPaid] = useState(false);
  // Numéro jamais prouvé : le code est demandé avant d’ouvrir le paiement.
  const [verify, setVerify] = useState<{
    number: string;
    withoutTrial: boolean;
  } | null>(null);
  async function open(withoutTrial = false) {
    if (busy) return;
    setBusy(true);
    try {
      if (needsCheckout) {
        const result = await resumeProjectCheckout({ projectId, withoutTrial });
        if (result.success) {
          window.location.assign(result.url);
          return;
        }
        if ("code" in result && result.code === "TRIAL_UNAVAILABLE") {
          setConfirmPaid(true);
          return;
        }
        if ("code" in result && result.code === "NUMBER_NOT_VERIFIED") {
          setConfirmPaid(false);
          setVerify({ number: result.number, withoutTrial });
          return;
        }
        toast.error(result.error);
        return;
      }
      const result = await openProjectBillingPortal(projectId, intent);
      if (result.success) {
        window.location.assign(result.url);
        return;
      }
      toast.error(result.error);
    } catch {
      toast.error(
        "La facturation est indisponible. Réessayez dans quelques instants.",
      );
    } finally {
      setBusy(false);
    }
  }
  const Icon = busy
    ? Loader2
    : needsCheckout
      ? CreditCard
      : intent === "renew"
        ? RefreshCw
        : ArrowUpRight;
  return (
    <>
      <Button
        size={size}
        variant={
          variant ??
          (needsCheckout || intent === "renew" ? "default" : "outline")
        }
        className={cn(
          "h-auto min-h-9 whitespace-normal text-center",
          className,
        )}
        disabled={disabled || busy}
        aria-busy={busy}
        onClick={() => void open()}
      >
        <Icon
          aria-hidden="true"
          className={busy ? "size-4 animate-spin" : "size-4"}
        />
        {label ??
          (needsCheckout
            ? "Reprendre le paiement"
            : intent === "renew"
              ? "Renouveler le plan"
              : "Changer d’offre")}
      </Button>
      {needsCheckout && (
        <Dialog open={!!verify} onOpenChange={(next) => !next && setVerify(null)}>
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
            {/* Titre lu par les lecteurs d’écran ; le composant affiche le sien. */}
            <DialogTitle className="sr-only">Vérification du numéro WhatsApp</DialogTitle>
            <DialogDescription className="sr-only">
              Saisissez le code reçu pour ouvrir le paiement.
            </DialogDescription>
            {verify && (
              <NumberVerification
                target={{ projectId }}
                number={verify.number}
                withoutTrial={verify.withoutTrial}
                onContinue={async (verificationId, paid) =>
                  toCheckoutAttempt(
                    await resumeProjectCheckout({
                      projectId,
                      withoutTrial: paid,
                      verificationId,
                    }),
                  )
                }
              />
            )}
          </DialogContent>
        </Dialog>
      )}
      {needsCheckout && (
        <AlertDialog
          open={confirmPaid}
          onOpenChange={(next) => !busy && setConfirmPaid(next)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Essai déjà utilisé pour ce numéro
              </AlertDialogTitle>
              <AlertDialogDescription>
                L’essai gratuit est accordé une seule fois par numéro WhatsApp
                professionnel. Le premier mois de l’offre sera prélevé dès la
                validation du paiement.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
              <Button
                disabled={busy}
                aria-busy={busy}
                onClick={() => void open(true)}
              >
                {busy && (
                  <Loader2
                    aria-hidden="true"
                    className="size-4 animate-spin motion-reduce:animate-none"
                  />
                )}
                Payer et reprendre
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}

export function BillingPlanMenuItem({
  projectId,
  intent,
}: {
  projectId: string;
  intent: "renew" | "upgrade";
}) {
  const [busy, setBusy] = useState(false);
  return (
    <DropdownMenuItem
      disabled={busy}
      onSelect={(event) => {
        event.preventDefault();
        setBusy(true);
        void openProjectBillingPortal(projectId, intent)
          .then((result) => {
            if (result.success) window.location.assign(result.url);
            else toast.error(result.error);
          })
          .catch(() =>
            toast.error("La facturation est indisponible. Réessayez."),
          )
          .finally(() => setBusy(false));
      }}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" />
      ) : intent === "renew" ? (
        <RefreshCw className="size-4" />
      ) : (
        <ArrowUpRight className="size-4" />
      )}
      {intent === "renew" ? "Renouveler le plan" : "Changer d’offre"}
    </DropdownMenuItem>
  );
}
