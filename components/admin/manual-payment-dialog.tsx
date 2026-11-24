"use client";

import { useId, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CircleAlert, Loader2, Wallet } from "lucide-react";

import { recordManualPaymentAction } from "@/app/admin/paiements/actions";
import {
  MANUAL_AMOUNT_MAX,
  MANUAL_AMOUNT_MIN,
  MANUAL_NOTE_MAX,
  MANUAL_PAYMENT_METHODS,
  MANUAL_PAYMENT_METHOD_LABEL,
  MANUAL_PAYMENT_MONTHS,
  MANUAL_REFERENCE_MAX,
  addMonthsUtc,
  requiresReference,
} from "@/lib/manual-billing-shared";
import { PRICING_PLANS, type PlanId } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const PLAN_IDS = PRICING_PLANS.map((plan) => plan.id) as [PlanId, ...PlanId[]];
const MONTH_VALUES = MANUAL_PAYMENT_MONTHS.map(String) as [string, ...string[]];

/** « 25 000 », « 25.000 » ou « 25000 » : le montant en francs CFA. */
function parseAmount(value: string) {
  const digits = value.replace(/[\s.  ]/g, "");
  return /^\d{1,9}$/.test(digits) ? Number(digits) : Number.NaN;
}

const Schema = z
  .object({
    plan: z.enum(PLAN_IDS, "Choisissez une offre."),
    months: z.enum(MONTH_VALUES, "Choisissez une durée."),
    amount: z
      .string()
      .trim()
      .min(1, "Indiquez le montant reçu.")
      .refine((value) => Number.isSafeInteger(parseAmount(value)), "Chiffres seulement, en francs CFA.")
      .refine(
        (value) => parseAmount(value) >= MANUAL_AMOUNT_MIN,
        `${MANUAL_AMOUNT_MIN} FCFA au minimum.`,
      )
      .refine(
        (value) => parseAmount(value) <= MANUAL_AMOUNT_MAX,
        "Montant trop élevé : vérifiez la saisie.",
      ),
    method: z.enum(MANUAL_PAYMENT_METHODS, "Choisissez un moyen de paiement."),
    reference: z
      .string()
      .trim()
      .max(MANUAL_REFERENCE_MAX, `${MANUAL_REFERENCE_MAX} caractères au maximum.`)
      .regex(/^[\p{L}\p{N} ._\-#/]*$/u, "Lettres, chiffres, espaces et . _ - # / seulement."),
    note: z.string().trim().max(MANUAL_NOTE_MAX, `${MANUAL_NOTE_MAX} caractères au maximum.`),
  })
  .superRefine((value, ctx) => {
    if (requiresReference(value.method) && value.reference.length < 4)
      ctx.addIssue({
        code: "custom",
        path: ["reference"],
        message: "Indiquez l’identifiant de la transaction (4 caractères au moins).",
      });
  });
type Values = z.infer<typeof Schema>;

export type ManualPaymentTarget = {
  id: string;
  name: string;
  ownerEmail: string | null;
  plan: PlanId;
  /** Fin de la période mobile money en cours : le paiement la prolonge. */
  runningEndsAt: string | null;
  /** Abonnement par carte encore vivant chez Polar : aucun paiement possible ici. */
  cardSubscription: boolean;
  deletionPending: boolean;
};

function formatDay(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

/**
 * Enregistre un paiement Airtel Money, Moov Money, en espèces ou par virement,
 * et ouvre aussitôt l'accès du projet. Le bouton d'envoi annonce la date de fin :
 * l'équipe voit ce qu'elle valide avant de valider.
 */
export function ManualPaymentDialog({
  project,
  timeZone,
  renewal = false,
}: {
  project: ManualPaymentTarget;
  timeZone: string;
  renewal?: boolean;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  // Un identifiant par paiement : renvoyer après une coupure réseau n'encaisse qu'une fois.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const defaults: Values = {
    plan: project.plan,
    months: "1",
    amount: "",
    method: "airtel_money",
    reference: "",
    note: "",
  };
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: defaults });
  const [months, method] = useWatch({ control: form.control, name: ["months", "method"] });
  const blocked = project.cardSubscription || project.deletionPending;

  const runningEnd = project.runningEndsAt ? new Date(project.runningEndsAt) : null;
  // Aperçu : le serveur recalcule la date sur son horloge, à la validation.
  const previewEnd = addMonthsUtc(runningEnd ?? new Date(), Number(months));
  const endLabel = formatDay(previewEnd, timeZone);

  function changeOpen(next: boolean) {
    if (form.formState.isSubmitting) return;
    setOpen(next);
    if (!next) form.reset(defaults);
  }

  const submit = form.handleSubmit(async (values) => {
    try {
      const result = await recordManualPaymentAction({
        projectId: project.id,
        requestId,
        plan: values.plan,
        months: Number(values.months),
        amountXaf: parseAmount(values.amount),
        method: values.method,
        reference: values.reference,
        note: values.note,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const until = formatDay(new Date(result.endsAt), timeZone);
      toast.success(
        result.duplicate
          ? `Ce paiement était déjà enregistré : « ${result.projectName} » est actif jusqu’au ${until}.`
          : `« ${result.projectName} » est actif jusqu’au ${until}.`,
      );
      setRequestId(crypto.randomUUID());
      form.reset(defaults);
      setOpen(false);
    } catch {
      // Même identifiant au prochain essai : un paiement déjà passé ne sera pas doublé.
      toast.error("Connexion interrompue. Réessayez : le paiement ne sera pas compté deux fois.");
    }
  });

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button
          variant={renewal ? "default" : "outline"}
          size="sm"
          className="h-auto min-h-10 w-full py-2 leading-tight whitespace-normal sm:min-h-8 sm:w-auto sm:py-1 sm:whitespace-nowrap"
        >
          <Wallet data-icon="inline-start" />
          {renewal ? "Renouveler" : "Enregistrer un paiement"}
          <span className="sr-only"> pour {project.name}</span>
        </Button>
      </DialogTrigger>
      {/* Colonne minmax(0,1fr) : la grille de la fenêtre ne s'élargit plus à la
          largeur d'un contenu insécable (e-mail, libellés) et tout passe à la
          ligne. overflow-x-hidden ne masque que les libellés invisibles (croix,
          boutons radio), qui dépassent de quelques pixels sur petit écran. */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] overflow-x-hidden overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          {/* pr-8 : le titre ne passe pas sous la croix de fermeture. */}
          <DialogTitle className="pr-8">Paiement hors carte</DialogTitle>
          <DialogDescription className="wrap-break-word">
            <span className="font-medium text-foreground">{project.name}</span>
            {project.ownerEmail && <> · {project.ownerEmail}</>}
          </DialogDescription>
        </DialogHeader>

        {blocked ? (
          <p role="alert" className="flex gap-3 rounded-lg border border-dashed p-4 text-sm">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {project.deletionPending
              ? "Ce projet est en cours de suppression : aucun paiement ne peut y être enregistré."
              : "Ce projet a un abonnement par carte en cours chez Polar. Révoquez-le dans Polar avant d’enregistrer un paiement, pour ne pas facturer deux fois."}
          </p>
        ) : (
          <form id={`${id}-form`} onSubmit={submit} noValidate aria-busy={form.formState.isSubmitting}>
            <FieldGroup className="gap-5">
              <Controller
                name="method"
                control={form.control}
                render={({ field, fieldState }) => (
                  <FieldSet data-invalid={fieldState.invalid} className="gap-2">
                    <FieldLegend variant="label">Moyen de paiement</FieldLegend>
                    <RadioGroup
                      name={field.name}
                      value={field.value}
                      onValueChange={field.onChange}
                      aria-invalid={fieldState.invalid}
                      className="grid grid-cols-2 gap-2"
                    >
                      {MANUAL_PAYMENT_METHODS.map((value) => (
                        <FieldLabel
                          key={value}
                          htmlFor={`${id}-method-${value}`}
                          // w-full et retour à la ligne : « Virement bancaire » tient dans sa case dès 220 px.
                          className={cn(
                            "relative min-h-10 w-full cursor-pointer items-center justify-center rounded-md border px-2 py-1.5 text-center text-sm leading-tight font-medium whitespace-normal transition-colors hover:bg-muted",
                            "has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
                            "has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary/5",
                          )}
                        >
                          {MANUAL_PAYMENT_METHOD_LABEL[value]}
                          <RadioGroupItem
                            id={`${id}-method-${value}`}
                            value={value}
                            className="absolute sr-only"
                          />
                        </FieldLabel>
                      ))}
                    </RadioGroup>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </FieldSet>
                )}
              />

              <div className="grid gap-5 sm:grid-cols-2">
                <Controller
                  name="amount"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={`${id}-amount`}>Montant reçu</FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          {...field}
                          id={`${id}-amount`}
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="25 000"
                          maxLength={13}
                          aria-invalid={fieldState.invalid}
                          className="tabular-nums"
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText>FCFA</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="plan"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={`${id}-plan`}>Offre</FieldLabel>
                      <Select name={field.name} value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger
                          id={`${id}-plan`}
                          ref={field.ref}
                          aria-invalid={fieldState.invalid}
                          className="w-full"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRICING_PLANS.map((plan) => (
                            <SelectItem key={plan.id} value={plan.id}>
                              {plan.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </div>

              <Controller
                name="months"
                control={form.control}
                render={({ field, fieldState }) => (
                  <FieldSet data-invalid={fieldState.invalid} className="gap-2">
                    <FieldLegend variant="label">Durée payée (mois)</FieldLegend>
                    <RadioGroup
                      name={field.name}
                      value={field.value}
                      onValueChange={field.onChange}
                      aria-invalid={fieldState.invalid}
                      aria-describedby={`${id}-months-help`}
                      className="grid grid-cols-5 gap-1 rounded-lg bg-muted p-[3px]"
                    >
                      {MANUAL_PAYMENT_MONTHS.map((value) => (
                        <FieldLabel
                          key={value}
                          htmlFor={`${id}-months-${value}`}
                          className={cn(
                            "relative h-9 w-full cursor-pointer items-center justify-center rounded-md border border-transparent text-sm font-medium text-foreground/60 tabular-nums transition-colors hover:text-foreground",
                            "has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
                            "has-data-[state=checked]:bg-background has-data-[state=checked]:text-foreground has-data-[state=checked]:shadow-sm dark:has-data-[state=checked]:border-input dark:has-data-[state=checked]:bg-input/30",
                          )}
                        >
                          {/* Le chiffre seul : cinq cases tiennent sur une ligne dès 220 px. */}
                          {value}
                          <span className="sr-only"> mois</span>
                          <RadioGroupItem
                            id={`${id}-months-${value}`}
                            value={String(value)}
                            className="absolute sr-only"
                          />
                        </FieldLabel>
                      ))}
                    </RadioGroup>
                    <FieldDescription id={`${id}-months-help`} className="text-xs">
                      {runningEnd
                        ? `Prolonge la période en cours, qui finit le ${formatDay(runningEnd, timeZone)}.`
                        : "L’accès démarre dès la validation."}
                    </FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </FieldSet>
                )}
              />

              <Controller
                name="reference"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`${id}-reference`}>
                      {requiresReference(method) ? "Identifiant de la transaction" : "Référence (facultatif)"}
                    </FieldLabel>
                    <Input
                      {...field}
                      id={`${id}-reference`}
                      autoComplete="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                      maxLength={MANUAL_REFERENCE_MAX}
                      placeholder={requiresReference(method) ? "Dans le SMS de confirmation" : "N° de reçu, de virement…"}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />

              <Controller
                name="note"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`${id}-note`}>Note interne (facultatif)</FieldLabel>
                    <Textarea
                      {...field}
                      id={`${id}-note`}
                      rows={2}
                      maxLength={MANUAL_NOTE_MAX}
                      placeholder="Installation comprise, payé par le gérant…"
                      aria-invalid={fieldState.invalid}
                      aria-describedby={`${id}-note-help`}
                      className="min-h-16 resize-y"
                    />
                    <FieldDescription id={`${id}-note-help`} className="text-xs">
                      Visible de l’équipe seulement, jamais du client.
                    </FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </FieldGroup>
          </form>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={form.formState.isSubmitting}
            onClick={() => changeOpen(false)}
          >
            Annuler
          </Button>
          {!blocked && (
            <Button
              type="submit"
              form={`${id}-form`}
              disabled={form.formState.isSubmitting}
              // La date complète dépasse la largeur d’un écran étroit : le libellé passe à la ligne.
              className="h-auto min-h-10 py-2 text-center leading-snug whitespace-normal sm:min-h-9"
            >
              {form.formState.isSubmitting && (
                <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />
              )}
              Activer jusqu’au {endLabel}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
