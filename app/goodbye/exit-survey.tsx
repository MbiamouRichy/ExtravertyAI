"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import {
  DELETION_FEEDBACK_REASONS,
  DeletionFeedbackSchema,
  type DeletionFeedbackValues,
} from "@/lib/deletion-feedback";
import { submitDeletionFeedback } from "./actions";

export function ExitSurvey() {
  const [sent, setSent] = useState(false);
  const form = useForm<DeletionFeedbackValues>({
    resolver: zodResolver(DeletionFeedbackSchema),
    defaultValues: { reason: undefined, comment: "" },
  });
  const busy = form.formState.isSubmitting;

  async function onSubmit(values: DeletionFeedbackValues) {
    const result = await submitDeletionFeedback(values);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    setSent(true);
  }

  if (sent)
    return (
      <div
        role="status"
        className="flex items-start gap-3 rounded-xl border bg-card p-5 text-sm"
      >
        <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0" />
        <p>
          <span className="font-medium">Merci pour votre retour.</span>{" "}
          <span className="text-muted-foreground">
            Il nous aide à améliorer ExtravertyAI.
          </span>
        </p>
      </div>
    );

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      aria-labelledby="exit-survey-title"
      className="rounded-xl border bg-card p-5 sm:p-6"
    >
      <h2
        id="exit-survey-title"
        className="text-base! font-semibold! leading-snug! tracking-tight!"
      >
        Pourquoi partez-vous&nbsp;?
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Facultatif · 10 secondes · une seule réponse possible.
      </p>

      <FieldGroup className="mt-5 gap-5">
        <Controller
          name="reason"
          control={form.control}
          render={({ field, fieldState }) => (
            <FieldSet data-invalid={fieldState.invalid}>
              <FieldLegend variant="label" className="sr-only">
                Raison principale
              </FieldLegend>
              <RadioGroup
                name={field.name}
                value={field.value ?? ""}
                onValueChange={field.onChange}
                disabled={busy}
                aria-invalid={fieldState.invalid}
                className="grid gap-2 sm:grid-cols-2"
              >
                {DELETION_FEEDBACK_REASONS.map((reason) => (
                  <Field
                    key={reason.value}
                    orientation="horizontal"
                    className="rounded-lg border px-3 py-2.5 transition-colors has-data-[state=checked]:border-foreground has-data-[state=checked]:bg-muted/50"
                  >
                    <RadioGroupItem
                      value={reason.value}
                      id={`exit-reason-${reason.value}`}
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldLabel
                      htmlFor={`exit-reason-${reason.value}`}
                      className="font-normal"
                    >
                      {reason.label}
                    </FieldLabel>
                  </Field>
                ))}
              </RadioGroup>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </FieldSet>
          )}
        />

        <Controller
          name="comment"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="exit-comment">
                Un mot de plus&nbsp;?{" "}
                <span className="font-normal text-muted-foreground">
                  (facultatif)
                </span>
              </FieldLabel>
              <Textarea
                {...field}
                id="exit-comment"
                rows={3}
                maxLength={500}
                autoComplete="off"
                disabled={busy}
                aria-invalid={fieldState.invalid}
                aria-describedby="exit-comment-help"
                placeholder="Ce qui vous aurait fait rester…"
                className="resize-none"
              />
              <FieldDescription id="exit-comment-help">
                N’indiquez aucune information personnelle.{" "}
                {field.value.length}/500
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>

      <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck aria-hidden className="size-3.5 shrink-0" />
          Réponse anonyme, sans lien avec votre ancien compte.
        </p>
        <Button type="submit" disabled={busy} className="sm:w-auto">
          {busy && <Loader2 aria-hidden className="animate-spin" />}
          {busy ? "Envoi…" : "Envoyer"}
        </Button>
      </div>
    </form>
  );
}
