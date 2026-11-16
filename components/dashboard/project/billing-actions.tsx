"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Loader2 } from "lucide-react";
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
import { cancelProjectSubscription } from "@/app/actions/project-settings";
import { openProjectPaymentSettings } from "@/app/actions/billing-plan";
import type { PlanId } from "@/lib/pricing";
import { BillingPlanButton } from "./billing-plan-button";
import { ChangePlanDialog, type ChangePlanState } from "./change-plan-dialog";
import { LocalBillingDate } from "./local-billing-date";
import {
  ReauthButton,
  useReauthenticate,
  useRecentSession,
} from "../user/recent-session";
import { returnAnchor } from "@/lib/return-anchor";

/** Bloc de résiliation : retour ici après une reconnexion. */
const CANCEL_ANCHOR = "resilier-abonnement";

export type BillingCancellation = {
  /** Abonnement à jour : il s'arrête en fin de période, sinon tout de suite. */
  atPeriodEnd: boolean;
  trial: boolean;
  endsAt: Date | number | null | undefined;
};

/** Bloc Paiement de la page : moyen de paiement et facturation de ce projet. */
export const PAYMENT_ANCHOR = "paiement";

/**
 * L'action principale qu'appelle l'état de l'abonnement : payer, changer
 * d'offre (formulaire du projet) ou renouveler. Pleine largeur sur mobile.
 */
export function BillingActions({
  projectId,
  configured,
  needsCheckout = false,
  primary,
  changePlan,
}: {
  projectId: string;
  configured: boolean;
  /** Paiement initial jamais abouti : seule action utile, le reprendre. */
  needsCheckout?: boolean;
  primary: { intent: "renew" | "upgrade"; label: string } | null;
  changePlan?: {
    state: ChangePlanState;
    defaultOpen?: boolean;
    defaultPlan?: PlanId;
  } | null;
}) {
  const width = "min-h-10 w-full shrink-0 sm:min-h-9 sm:w-auto";
  if (needsCheckout)
    return <BillingPlanButton projectId={projectId} intent="renew" needsCheckout className={width} />;
  if (primary?.intent === "upgrade" && changePlan)
    return (
      <ChangePlanDialog
        state={changePlan.state}
        defaultOpen={changePlan.defaultOpen}
        defaultPlan={changePlan.defaultPlan}
        label={primary.label}
        className={width}
      />
    );
  if (primary?.intent === "renew")
    return (
      <BillingPlanButton
        projectId={projectId}
        intent={primary.intent}
        label={primary.label}
        variant="default"
        disabled={!configured}
        className={width}
      />
    );
  return null;
}

/**
 * Modification de la carte, chez Polar. Le portail couvre tout le compte du
 * titulaire : seul celui-ci peut l'ouvrir, ce que le serveur revérifie.
 */
export function PaymentSettingsButton({ projectId }: { projectId: string }) {
  const [busy, setBusy] = useState(false);
  async function open() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await openProjectPaymentSettings(projectId);
      if (result.success) {
        window.location.assign(result.url);
        return;
      }
      toast.error(result.error);
    } catch {
      toast.error("Le service de paiement est indisponible. Réessayez dans un instant.");
    }
    setBusy(false);
  }
  return (
    <Button
      variant="outline"
      className="h-auto min-h-10 w-full whitespace-normal sm:min-h-9 sm:w-auto"
      disabled={busy}
      aria-busy={busy}
      onClick={() => void open()}
    >
      {busy ? (
        <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
      ) : (
        <ExternalLink aria-hidden="true" className="size-4" />
      )}
      Modifier la carte
    </Button>
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
  const { reconnect } = useReauthenticate();
  const billingPage = `/projects/${projectId}/billing`;
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function confirm() {
    setBusy(true);
    try {
      const result = await cancelProjectSubscription(projectId);
      if (!result.success) {
        if ("code" in result && result.code === "REAUTH_REQUIRED") {
          setOpen(false);
          toast.error(result.error, {
            action: {
              label: "Se reconnecter",
              onClick: () => void reconnect(billingPage, CANCEL_ANCHOR),
            },
          });
        } else toast.error(result.error);
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
  // Un seul bouton à la fois, comme la suppression dans les paramètres :
  // résilier après une connexion récente, sinon se reconnecter d'abord.
  return (
    <section
      aria-labelledby="cancel-title"
      {...returnAnchor(CANCEL_ANCHOR, "flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6")}
    >
      <div className="min-w-0">
        <h2 id="cancel-title" className="text-sm font-medium">
          Résilier l’abonnement
        </h2>
        <p className="mt-0.5 max-w-lg text-sm text-muted-foreground">
          {cancellation.atPeriodEnd
            ? "L’offre reste active jusqu’à la fin de la période."
            : "L’abonnement s’arrête immédiatement."}
          {!recentLogin && " Reconnectez-vous d’abord, par sécurité."}
        </p>
      </div>
      {recentLogin ? (
        <Button
          variant="outline"
          className="min-h-10 w-full shrink-0 text-destructive hover:text-destructive sm:min-h-9 sm:w-auto"
          onClick={() => setOpen(true)}
        >
          Résilier
        </Button>
      ) : (
        <ReauthButton
          callbackUrl={billingPage}
          anchor={CANCEL_ANCHOR}
          label="Se reconnecter"
          className="min-h-10 w-full shrink-0 sm:min-h-9 sm:w-auto"
        />
      )}
      <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
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
    </section>
  );
}
