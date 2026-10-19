"use client";

import { useId, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
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
  PIPELINE_STAGES,
  currencyDigits,
  formatDealValue,
  parseDealValue,
  type PipelineStageId,
} from "@/lib/pipeline-shared";

/** Plain editable amount, without currency symbol: « 150 000 » or « 1 250,5 ». */
function editableAmount(minor: number | null, currency: string): string {
  if (minor === null) return "";
  const digits = currencyDigits(currency);
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: digits,
    useGrouping: true,
  }).format(minor / 10 ** digits);
}

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
  const [optimistic, setOptimistic] = useState<PipelineStageId | null>(null);
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
            setOptimistic(null);
            if (!result.success) {
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

export function DealValueForm({
  projectId,
  contactId,
  currency,
  value,
  onSaved,
  autoFocus = false,
}: {
  projectId: string;
  contactId: string;
  currency: string;
  value: number | null;
  onSaved: (value: number | null) => void;
  autoFocus?: boolean;
}) {
  const id = useId();
  const schema = z.object({
    amount: z
      .string()
      .trim()
      .max(20, "Ce montant est trop long.")
      .refine((input) => {
        try {
          parseDealValue(input, currency);
          return true;
        } catch {
          return false;
        }
      }, currencyDigits(currency) > 0
        ? "Saisissez un montant valide, par exemple 1 250,50."
        : "Saisissez un montant entier, par exemple 150 000."),
  });
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { amount: editableAmount(value, currency) },
  });
  const [saving, setSaving] = useState(false);

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async ({ amount }) => {
        const next = parseDealValue(amount, currency);
        setSaving(true);
        const result = await setDealValueAction({ projectId, contactId, value: next });
        setSaving(false);
        if (!result.success) {
          toast.error(result.error);
          return;
        }
        form.reset({ amount: editableAmount(next, currency) });
        toast.success(next === null ? "Montant retiré" : `Montant enregistré : ${formatDealValue(next, currency)}`);
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
                placeholder={currencyDigits(currency) > 0 ? "1 250,50" : "150 000"}
                disabled={saving}
                aria-invalid={fieldState.invalid}
                aria-describedby={`${id}-help`}
                className="text-xs tabular-nums"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText className="font-mono text-[11px]">{currency}</InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription id={`${id}-help`} className="text-xs">
              Laissez vide pour retirer le montant.
            </FieldDescription>
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
  onChanged,
}: {
  projectId: string;
  contactId: string;
  stage: PipelineStageId;
  dealValue: number | null;
  currency: string;
  onChanged: () => void;
}) {
  return (
    <section aria-labelledby={`pipeline-${contactId}`} className="space-y-3 rounded-xl border p-4">
      <h2
        id={`pipeline-${contactId}`}
        className="font-mono text-[11px] font-normal uppercase tracking-wider text-muted-foreground"
      >
        Pipeline
      </h2>
      <StageSelect projectId={projectId} contactId={contactId} stage={stage} onChanged={onChanged} />
      <DealValueForm
        key={`${contactId}:${dealValue ?? "none"}`}
        projectId={projectId}
        contactId={contactId}
        currency={currency}
        value={dealValue}
        onSaved={onChanged}
      />
    </section>
  );
}
