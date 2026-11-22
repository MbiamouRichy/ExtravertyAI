"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { movePipelineStageAction, setDealValueAction } from "@/app/actions/pipeline";
import {
  CURRENCIES,
  CurrencySchema,
  PIPELINE_STAGES,
  currencyDigits,
  formatAmountInput as editableAmount,
  formatDealValue,
  parseDealValue,
  type PipelineStageId,
} from "@/lib/pipeline-shared";

export function StageSelect({
  projectId,
  contactId,
  stage,
  onChanged,
}: {
  projectId: string;
  contactId: string;
  stage: PipelineStageId;
  onChanged: () => void;
}) {
  const id = useId();
  // Kept until the refreshed contact reports another stage, so the select
  // does not flash back to the previous one in between.
  const [optimistic, setOptimistic] = useState<PipelineStageId | null>(null);
  const [seen, setSeen] = useState(stage);
  if (seen !== stage) {
    setSeen(stage);
    setOptimistic(null);
  }
  const [pending, startTransition] = useTransition();
  const value = optimistic ?? stage;

  return (
    <Field className="gap-1.5">
      <FieldLabel htmlFor={id} className="text-xs">
        Étape du pipeline
      </FieldLabel>
      <Select
        value={value}
        disabled={pending}
        onValueChange={(next) => {
          const target = next as PipelineStageId;
          setOptimistic(target);
          startTransition(async () => {
            const result = await movePipelineStageAction({ projectId, contactId, stage: target });
            if (!result.success) {
              setOptimistic(null);
              toast.error(result.error);
              return;
            }
            onChanged();
          });
        }}
      >
        <SelectTrigger id={id} size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PIPELINE_STAGES.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

type Currency = (typeof CURRENCIES)[number];

const isCurrency = (value: string): value is Currency =>
  (CURRENCIES as readonly string[]).includes(value);

const amountPlaceholder = (currency: string) => (currencyDigits(currency) > 0 ? "1 250,50" : "150 000");

function amountValid(input: string, currency: string) {
  try {
    parseDealValue(input, currency);
    return true;
  } catch {
    return false;
  }
}

// Le montant se lit dans la devise choisie à côté : la vérification porte sur les deux.
const dealValueSchema = z
  .object({
    amount: z.string().trim().max(20, "Ce montant est trop long."),
    currency: CurrencySchema,
  })
  .superRefine((values, ctx) => {
    if (!amountValid(values.amount, values.currency))
      ctx.addIssue({
        code: "custom",
        path: ["amount"],
        message:
          currencyDigits(values.currency) > 0
            ? "Saisissez un montant valide, par exemple 1 250,50."
            : "Saisissez un montant entier, par exemple 150 000.",
      });
  });

export function DealValueForm({
  projectId,
  contactId,
  currency,
  value,
  onSaved,
  autoFocus = false,
  canChangeCurrency = false,
}: {
  projectId: string;
  contactId: string;
  currency: string;
  value: number | null;
  onSaved: (value: number | null) => void;
  autoFocus?: boolean;
  /** Administrateur : la devise du projet se choisit à côté du montant. */
  canChangeCurrency?: boolean;
}) {
  const id = useId();
  const router = useRouter();
  const projectCurrency: Currency = isCurrency(currency) ? currency : "XAF";
  const form = useForm<z.input<typeof dealValueSchema>, unknown, z.output<typeof dealValueSchema>>({
    resolver: zodResolver(dealValueSchema),
    defaultValues: { amount: editableAmount(value, projectCurrency), currency: projectCurrency },
  });
  const selectedCurrency = useWatch({ control: form.control, name: "currency" });
  const currencySwitch = selectedCurrency !== projectCurrency;
  const roundsCents = currencyDigits(selectedCurrency) < currencyDigits(projectCurrency);
  const [saving, setSaving] = useState(false);

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        const next = parseDealValue(values.amount, values.currency);
        setSaving(true);
        const result = await setDealValueAction({
          projectId,
          contactId,
          value: next,
          // Toujours envoyée : le montant est lu dans cette devise.
          currency: values.currency,
        });
        setSaving(false);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        form.reset({ amount: editableAmount(next, values.currency), currency: values.currency });
        const title =
          result.currencyChanged && next === null && value === null
            ? `Devise du projet : ${values.currency}`
            : next === null
              ? "Montant retiré"
              : `Montant enregistré : ${formatDealValue(next, values.currency)}`;
        toast.success(
          title,
          result.currencyChanged
            ? { description: `Tous les montants du projet sont désormais en ${values.currency}, sans conversion.` }
            : undefined,
        );
        // La devise vient de la page : elle est rechargée avec les montants remis à l’échelle.
        if (result.currencyChanged) router.refresh();
        onSaved(next);
      })}
    >
      <Controller
        name="amount"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="gap-1.5">
            <FieldLabel htmlFor={id} className="text-xs">
              Montant de l’affaire
            </FieldLabel>
            <InputGroup className="h-8">
              <InputGroupInput
                {...field}
                id={id}
                inputMode="decimal"
                autoComplete="off"
                autoFocus={autoFocus}
                placeholder={amountPlaceholder(selectedCurrency)}
                disabled={saving}
                aria-invalid={fieldState.invalid}
                aria-describedby={currencySwitch ? `${id}-help ${id}-currency-help` : `${id}-help`}
                className="min-w-0 text-xs tabular-nums"
              />
              <InputGroupAddon align="inline-end">
                {canChangeCurrency ? (
                  <Controller
                    name="currency"
                    control={form.control}
                    render={({ field: currencyField }) => (
                      <Select
                        name={currencyField.name}
                        value={currencyField.value}
                        onValueChange={currencyField.onChange}
                        disabled={saving}
                      >
                        <SelectTrigger
                          ref={currencyField.ref}
                          onBlur={currencyField.onBlur}
                          size="sm"
                          aria-label="Devise du projet"
                          aria-describedby={currencySwitch ? `${id}-currency-help` : undefined}
                          className="h-6 gap-0.5 border-0 bg-transparent px-1.5 py-0 font-mono text-[11px] shadow-none dark:bg-transparent dark:hover:bg-accent [&_svg]:size-3"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end" className="min-w-24">
                          {CURRENCIES.map((code) => (
                            <SelectItem key={code} value={code} className="font-mono text-xs">
                              {code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                ) : (
                  <InputGroupText className="font-mono text-[11px]">{projectCurrency}</InputGroupText>
                )}
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription id={`${id}-help`} className="text-xs">
              Laissez vide pour retirer le montant.
            </FieldDescription>
            {currencySwitch && (
              <FieldDescription id={`${id}-currency-help`} className="text-xs text-foreground">
                À l’enregistrement, tout le projet passe en {selectedCurrency} : montants du
                pipeline et prix du catalogue gardent leurs chiffres, sans conversion.
                {roundsCents ? " Les centimes sont arrondis à l’unité." : null}
              </FieldDescription>
            )}
            {fieldState.invalid && <FieldError errors={[fieldState.error]} className="text-xs" />}
          </Field>
        )}
      />
      <div className="mt-2 flex justify-end gap-2">
        {form.formState.isDirty && (
          <Button
            type="button"
            size="xs"
            variant="ghost"
            disabled={saving}
            onClick={() => form.reset()}
          >
            Annuler
          </Button>
        )}
        <Button type="submit" size="xs" variant="secondary" disabled={saving || !form.formState.isDirty}>
          {saving && <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

/** Section of the chat contact panel: stage and deal value. */
export function ContactPipelineSection({
  projectId,
  contactId,
  stage,
  dealValue,
  currency,
  canChangeCurrency = false,
  onChanged,
}: {
  projectId: string;
  contactId: string;
  stage: PipelineStageId;
  dealValue: number | null;
  currency: string;
  /** Administrateur du projet : le code de devise devient un sélecteur. */
  canChangeCurrency?: boolean;
  onChanged: () => void;
}) {
  return (
    <section aria-labelledby={`pipeline-${contactId}`} className="space-y-3 py-5">
      <h2
        id={`pipeline-${contactId}`}
        className="font-mono text-[11px] font-normal uppercase tracking-wider text-muted-foreground"
      >
        Pipeline
      </h2>
      <StageSelect projectId={projectId} contactId={contactId} stage={stage} onChanged={onChanged} />
      <DealValueForm
        // La devise fait partie de la clé : le champ repart du montant remis à l’échelle.
        key={`${contactId}:${currency}:${dealValue ?? "none"}`}
        projectId={projectId}
        contactId={contactId}
        currency={currency}
        value={dealValue}
        onSaved={onChanged}
        canChangeCurrency={canChangeCurrency}
      />
    </section>
  );
}
