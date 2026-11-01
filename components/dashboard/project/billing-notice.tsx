"use client";

import Link from "next/link";
import useSWR from "swr";
import { useEffect } from "react";
import { AlertCircle, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { type billingAccess } from "@/lib/billing-access";

import { LocalBillingDate } from "./local-billing-date";
import { BillingPlanButton } from "./billing-plan-button";

type Access = ReturnType<typeof billingAccess> & {
  /** Absent pour les rôles qui ne voient pas la facturation. */
  usage?: { used: number; limit: number } | null;
};
async function fetchStatus(url: string): Promise<Access> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("BILLING_STATUS_UNAVAILABLE");
  return response.json();
}
const titles = {
  active: "Automatisation en pause",
  trialing: "Essai",
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
  needsCheckout = false,
}: {
  projectId: string;
  initial: Access;
  canViewBilling: boolean;
  canManageBilling: boolean;
  needsCheckout?: boolean;
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
  const title = needsCheckout
    ? "Paiement à finaliser"
    : error && data.reason === "active" && !data.automationPaused
      ? "État de l’abonnement à vérifier"
      : titles[data.reason];
  const detail = needsCheckout
    ? "Le paiement n’a pas abouti lors de la création du projet. Reprenez-le pour activer l’essai de 10 jours."
    : data.reason === "active" && data.automationPaused
      ? "Votre abonnement reste actif ; les réponses automatiques sont en pause."
      : data.reason === "trialing"
        ? null
        : data.message;

  const usage = data.allowed ? data.usage : null;
  const limit = Math.max(1, usage?.limit ?? 1);
  const ratio = Math.min(1, (usage?.used ?? 0) / limit);

  return (
    <aside
      aria-label="État de l’abonnement"
      className={cn(
        "mx-4 mt-3 rounded-xl border px-3 py-2 sm:mx-6 xl:mx-8",
        blocked ? "border-destructive/30 bg-destructive/5" : "bg-card",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <div
          className={cn("min-w-0 text-sm", !usage && "flex-1")}
          role="status"
          aria-live="polite"
        >
          <p className="flex min-w-0 items-center gap-1.5 font-medium">
            {blocked && (
              <AlertCircle aria-hidden="true" className="size-4 shrink-0 text-destructive" />
            )}
            <span>
              {title}
              {data.endsAt && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  · {data.reason === "trialing" ? "jusqu’au" : "échéance le"}{" "}
                  <LocalBillingDate value={data.endsAt} dateOnly />
                </span>
              )}
            </span>
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
        {usage && (
          <div className="order-last flex w-full min-w-0 items-center gap-3 sm:order-none sm:w-auto sm:flex-1">
            <div
              role="progressbar"
              aria-label="Consommation du quota de messages"
              aria-valuemin={0}
              aria-valuemax={limit}
              aria-valuenow={Math.min(usage.used, limit)}
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn(
                  "h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500",
                  ratio >= 0.9 ? "bg-destructive" : "bg-foreground",
                )}
                style={{ width: `${ratio * 100}%` }}
              />
            </div>
            <p className="shrink-0 text-xs text-muted-foreground tabular-nums">
              <span className="text-foreground">{usage.used.toLocaleString("fr-FR")}</span>
              {" / "}
              {usage.limit.toLocaleString("fr-FR")} messages
            </p>
          </div>
        )}
        {(canViewBilling || canManageBilling) && (
          <div className="ml-auto flex shrink-0 flex-wrap gap-2">
            {blocked && canManageBilling ? (
              <BillingPlanButton
                projectId={projectId}
                intent="renew"
                size="sm"
                needsCheckout={needsCheckout}
              />
            ) : (
              canViewBilling && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/projects/${projectId}/billing`} aria-label="Facturation">
                    <span className="hidden sm:inline">Facturation</span>
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
