"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ArrowUpRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { changeProjectPlan } from "@/app/actions/billing-plan";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { planChange } from "@/lib/billing-plan-change";
import {
  PRICING_PLANS,
  TRIAL_MESSAGES,
  formatMessageLimit,
  formatPlanPrice,
  pricingPlan,
  type PlanId,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";
import { LocalBillingDate } from "./local-billing-date";

const PLAN_IDS = PRICING_PLANS.map((plan) => plan.id) as [PlanId, ...PlanId[]];

export type ChangePlanState = {
  projectId: string;
  projectName: string;
  currentPlan: PlanId;
  status: "trialing" | "active";
  /** Changement déjà programmé au renouvellement. */
  pendingPlan: PlanId | null;
  pendingAt: string | null;
  /** Fin de l'essai ou de la période payée en cours. */
  periodEnd: string | null;
  members: number;
};

function schemaFor(state: ChangePlanState) {
  return z
    .object({ plan: z.enum(PLAN_IDS, { error: "Choisissez une offre." }) })
    .refine((value) => value.plan !== state.currentPlan || !!state.pendingPlan, {
      message: "C’est déjà l’offre de ce projet. Choisissez-en une autre.",
      path: ["plan"],
    })
    .refine(
      (value) =>
        value.plan === state.currentPlan ||
        state.members <= pricingPlan(value.plan).users,
      {
        message: "Retirez des membres de l’équipe avant de passer à cette offre.",
        path: ["plan"],
      },
    );
}

/**
 * Changement d'offre du projet affiché, et de lui seul : le portail Polar
 * listerait tous les abonnements du client. Le serveur revérifie tout.
 */
export function ChangePlanDialog({
  state,
  defaultOpen = false,
  defaultPlan,
  label = "Changer d’offre",
  className,
}: {
  state: ChangePlanState;
  /** Ouvert à l'arrivée (lien « ?offre=… » depuis une autre page). */
  defaultOpen?: boolean;
  defaultPlan?: PlanId;
  label?: string;
  className?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  const schema = useMemo(() => schemaFor(state), [state]);
  const initialPlan =
    defaultPlan && defaultPlan !== state.currentPlan
      ? defaultPlan
      : (state.pendingPlan ?? state.currentPlan);
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { plan: initialPlan },
    mode: "onChange",
  });
  const selected = useWatch({ control: form.control, name: "plan" });
  const submitting = form.formState.isSubmitting;
  const unchanged = selected === state.currentPlan && !state.pendingPlan;

  function close(next: boolean) {
    if (submitting) return;
    setOpen(next);
    if (next) return;
    form.reset({ plan: initialPlan });
    // L'offre ne se rouvre pas à l'actualisation une fois le dialogue fermé.
    const url = new URL(window.location.href);
    if (url.searchParams.has("offre")) {
      url.searchParams.delete("offre");
      window.history.replaceState(null, "", url.pathname + url.search + url.hash);
    }
  }

  async function onSubmit(values: z.infer<typeof schema>) {
    try {
      const result = await changeProjectPlan({
        projectId: state.projectId,
        plan: values.plan,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message);
      close(false);
      router.refresh();
    } catch {
      toast.error("Le changement n’a pas été confirmé. Actualisez la page pour vérifier.");
    }
  }

  const target = pricingPlan(selected);
  const cancelling = selected === state.currentPlan && !!state.pendingPlan;
  const change = planChange(state.status, state.currentPlan, selected);
  const tooSmall =
    !cancelling && !!change && state.members > target.users;
  const date = (value: string | null) =>
    value ? (
      <strong className="font-medium text-foreground">
        <LocalBillingDate value={value} dateOnly />
      </strong>
    ) : null;

  return (
    <>
      <Button
        variant="default"
        className={cn("h-auto min-h-10 whitespace-normal sm:min-h-9", className)}
        onClick={() => setOpen(true)}
      >
        <ArrowUpRight aria-hidden="true" className="size-4" />
        {label}
      </Button>
      <Dialog open={open} onOpenChange={close}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="grid min-w-0 gap-5">
            <DialogHeader>
              <DialogTitle>Changer d’offre</DialogTitle>
              <DialogDescription>
                Pour le projet{" "}
                <strong className="font-medium text-foreground break-all">
                  {state.projectName}
                </strong>{" "}
                uniquement. Vos autres projets gardent leur offre.
              </DialogDescription>
            </DialogHeader>

            <Controller
              name="plan"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="min-w-0">
                  <RadioGroup
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    aria-label="Offre du projet"
                    aria-invalid={fieldState.invalid}
                    aria-describedby="plan-change-effect"
                    disabled={submitting}
                    className="gap-0 divide-y rounded-xl border"
                  >
                    {PRICING_PLANS.map((plan) => {
                      const checked = field.value === plan.id;
                      return (
                        <FieldLabel
                          key={plan.id}
                          htmlFor={`change-plan-${plan.id}`}
                          className={cn(
                            "flex w-full! min-w-0 cursor-pointer items-center gap-3 p-3.5 font-normal transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-muted/50 sm:p-4",
                            checked && "bg-muted/50",
                          )}
                        >
                          <RadioGroupItem
                            ref={checked ? field.ref : undefined}
                            id={`change-plan-${plan.id}`}
                            value={plan.id}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium">
                              {plan.name}
                              {plan.id === state.currentPlan && (
                                <Badge variant="secondary" className="font-normal">
                                  Offre actuelle
                                </Badge>
                              )}
                              {plan.id === state.pendingPlan && (
                                <Badge variant="outline" className="font-normal">
                                  Prévue
                                </Badge>
                              )}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                              {formatMessageLimit(plan.messageLimit)} messages ·{" "}
                              {plan.users} membres
                            </span>
                          </span>
                          <span className="shrink-0 text-right text-sm font-medium tabular-nums">
                            {formatPlanPrice(plan.priceCents)}
                            <span className="block text-xs font-normal text-muted-foreground">
                              / mois
                            </span>
                          </span>
                        </FieldLabel>
                      );
                    })}
                  </RadioGroup>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />

            <div
              id="plan-change-effect"
              aria-live="polite"
              className="rounded-lg bg-muted/50 p-3.5 text-sm text-muted-foreground sm:p-4"
            >
              {cancelling ? (
                <p>
                  Le passage à l’offre {pricingPlan(state.pendingPlan).name}
                  {state.pendingAt ? <> prévu le {date(state.pendingAt)}</> : " prévu"} sera
                  annulé : le projet garde l’offre {target.name}.
                </p>
              ) : !change ? (
                <p>
                  Choisissez l’offre vers laquelle passer.
                  {state.pendingPlan && (
                    <>
                      {" "}Passage à l’offre {pricingPlan(state.pendingPlan).name} déjà prévu
                      {state.pendingAt ? <> le {date(state.pendingAt)}</> : null}.
                    </>
                  )}
                </p>
              ) : tooSmall ? (
                <p>
                  L’équipe compte {state.members} membres et l’offre {target.name} en
                  comprend {target.users}. Retirez des membres dans l’onglet Équipe avant ce
                  changement.
                </p>
              ) : change.kind === "trial" ? (
                <p>
                  Les fonctions de l’offre {target.name} s’activent tout de suite. Rien n’est
                  prélevé pendant l’essai, qui reste limité à{" "}
                  {formatMessageLimit(TRIAL_MESSAGES)} messages : le premier paiement de{" "}
                  {formatPlanPrice(target.priceCents)} aura lieu
                  {state.periodEnd ? <> le {date(state.periodEnd)}</> : " à la fin de l’essai"}.
                </p>
              ) : change.kind === "upgrade" ? (
                <p>
                  Effet immédiat : {formatMessageLimit(target.messageLimit)} messages par mois
                  et {target.users} membres. La différence de prix jusqu’au prochain
                  renouvellement
                  {state.periodEnd ? <> ({date(state.periodEnd)})</> : null} est prélevée
                  maintenant, puis {formatPlanPrice(target.priceCents)} par mois.
                </p>
              ) : (
                <p>
                  Prend effet au prochain renouvellement
                  {state.periodEnd ? <>, le {date(state.periodEnd)}</> : null} : vous gardez
                  l’offre {pricingPlan(state.currentPlan).name} d’ici là, sans
                  remboursement de la période en cours. Ensuite{" "}
                  {formatPlanPrice(target.priceCents)} par mois.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => close(false)}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={submitting || unchanged || tooSmall}
                aria-busy={submitting}
              >
                {submitting && (
                  <Loader2
                    aria-hidden="true"
                    className="size-4 animate-spin motion-reduce:animate-none"
                  />
                )}
                {submitting
                  ? "Confirmation…"
                  : cancelling
                    ? "Annuler le changement prévu"
                    : change?.kind === "upgrade"
                      ? `Passer à ${target.name} et payer`
                      : change
                        ? `Passer à ${target.name}`
                        : "Changer d’offre"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
