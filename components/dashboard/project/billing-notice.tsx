"use client";

import Link from "next/link";
import useSWR from "swr";
import { useEffect } from "react";
import { AlertCircle, ArrowUpRight, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { type billingAccess } from "@/lib/billing-access";

import { LocalBillingDate } from "./local-billing-date";
import { BillingPlanButton } from "./billing-plan-button";

type Access = ReturnType<typeof billingAccess>;
async function fetchStatus(url: string): Promise<Access> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("BILLING_STATUS_UNAVAILABLE");
  return response.json();
}
const titles = {
  active: "Automatisation en pause",
  trialing: "Période d’essai",
  trial_expired: "Essai terminé",
  payment_pending: "Confirmation du paiement en attente",
  payment_failed: "Paiement à régulariser",
  inactive: "Abonnement suspendu ou terminé",
};

export function BillingNotice({
  projectId,
  initial,
  canViewBilling,
  canManageBilling,
}: {
  projectId: string;
  initial: Access;
  canViewBilling: boolean;
  canManageBilling: boolean;
}) {
  const {
    data = initial,
    error,
    mutate,
  } = useSWR<Access>(
    `/api/projects/${encodeURIComponent(projectId)}/billing-status`,
    fetchStatus,
    { fallbackData: initial, refreshInterval: 30000, revalidateOnFocus: true },
  );
  // Layouts persist across navigation: refresh at the deadline as well as polling.
  useEffect(() => {
    if (!data.allowed || !data.endsAt) return;
    const remaining = new Date(data.endsAt).getTime() - Date.now();
    if (remaining <= 0 || remaining > 2147483646) return;
    const timer = setTimeout(() => void mutate(), remaining + 100);
    return () => clearTimeout(timer);
  }, [data.allowed, data.endsAt, mutate]);
  if (data.reason === "active" && !data.automationPaused && !error) return null;
  const blocked = !data.allowed;
  const title =
    error && data.reason === "active" && !data.automationPaused
      ? "État de l’abonnement à vérifier"
      : titles[data.reason];
  const detail =
    data.reason === "active" && data.automationPaused
      ? "Votre abonnement reste actif ; les réponses automatiques sont en pause."
      : data.reason === "trialing"
        ? null
        : data.message;

  return (
    <aside
      aria-label="État de l’abonnement"
      className={cn(
        "mx-4 mt-4 rounded-xl border px-4 py-3 sm:mx-6 xl:mx-8",
        blocked ? "border-destructive/30 bg-destructive/5" : "bg-muted/40",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3" role="status" aria-live="polite">
          <span
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background",
              blocked && "border-destructive/30 text-destructive",
            )}
          >
            {blocked ? (
              <AlertCircle aria-hidden="true" className="size-4" />
            ) : (
              <CalendarClock aria-hidden="true" className="size-4" />
            )}
          </span>
          <div className="min-w-0 text-sm">
            <p className="font-medium">
              {title}
              {data.endsAt && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {data.reason === "trialing" ? "jusqu’au" : "échéance le"}{" "}
                  <LocalBillingDate value={data.endsAt} />
                </span>
              )}
            </p>
            {detail && <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>}
            {!canViewBilling && blocked && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                Contactez le propriétaire du projet pour régulariser l’abonnement.
              </p>
            )}
            {error && (
              <p className="mt-0.5 text-xs text-destructive">
                Actualisation indisponible. Réessayez dans quelques instants.
              </p>
            )}
          </div>
        </div>
        {(canViewBilling || canManageBilling) && (
          <div className="flex shrink-0 flex-wrap gap-2 pl-11 sm:pl-0">
            {blocked && canManageBilling ? (
              <BillingPlanButton projectId={projectId} intent="renew" size="sm" />
            ) : (
              canViewBilling && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/projects/${projectId}/billing`}>
                    Voir la facturation
                    <ArrowUpRight data-icon="inline-end" />
                  </Link>
                </Button>
              )
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
