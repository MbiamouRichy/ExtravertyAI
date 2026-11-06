"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
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
import { cn } from "@/lib/utils";
import { submitDeletionFeedback } from "./actions";

const COMMENT_MAX = 500;

// The one card of the page, so the survey is the first thing seen.
const card = "rounded-2xl border bg-card p-4 text-card-foreground shadow-sm sm:p-6";

// The radio stays the focusable control, visually hidden (`absolute` beats the
// radio's own `relative`, or it keeps its 16 px); the pill is its label.
const chip = cn(
  "relative cursor-pointer rounded-full border bg-background px-3.5 py-2 text-sm font-normal leading-none transition-colors",
  "hover:bg-muted has-focus-visible:ring-3 has-focus-visible:ring-ring/50",
  "has-disabled:cursor-not-allowed has-disabled:opacity-50",
  "has-data-[state=checked]:border-primary has-data-[state=checked]:bg-primary has-data-[state=checked]:text-primary-foreground",
  "dark:has-data-[state=checked]:border-primary dark:has-data-[state=checked]:bg-primary",
);

export function ExitSurvey({
  answered = false,
  className,
}: {
  /** Already answered from this browser: only the thank-you note remains. */
  answered?: boolean;
  className?: string;
}) {
  const [sent, setSent] = useState(answered);
  const form = useForm<DeletionFeedbackValues>({
    resolver: zodResolver(DeletionFeedbackSchema),
    defaultValues: { reason: undefined, comment: "" },
  });
  const busy = form.formState.isSubmitting;
  const reason = useWatch({ control: form.control, name: "reason" });
  const followUp = DELETION_FEEDBACK_REASONS.find(
    (item) => item.value === reason,
  )?.followUp;

  async function onSubmit(values: DeletionFeedbackValues) {
    const result = await submitDeletionFeedback(values);
    if (!result.success) {
      toast.error(result.error, { position: "top-center" });
      return;
    }
    setSent(true);
  }

  if (sent)
    return (
      <section
        role="status"
        className={cn(
          card,
          "flex items-start gap-3 text-sm motion-safe:animate-in motion-safe:fade-in",
          className,
        )}
      >
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check aria-hidden className="size-3" />
        </span>
        <p>
          <span className="font-medium">Merci, c’est noté.</span>{" "}
          <span className="text-muted-foreground">
            Votre retour nous aide à améliorer ExtravertyAI.
          </span>
        </p>
      </section>
    );

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      noValidate
      aria-labelledby="exit-survey-title"
      aria-describedby="exit-survey-help"
      aria-busy={busy}
      className={cn(card, className)}
    >
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
        Une dernière question
      </p>
      <h2
        id="exit-survey-title"
        className="mt-2 text-xl! font-bold! leading-tight! tracking-tight!"
      >
        Pourquoi partez-vous&nbsp;?
      </h2>
      <p id="exit-survey-help" className="mt-1 text-sm text-muted-foreground">
        10 secondes. Réponse anonyme, sans lien avec votre ancien compte.
      </p>

      <Controller
        name="reason"
        control={form.control}
        render={({ field, fieldState }) => (
          <FieldSet data-invalid={fieldState.invalid} className="mt-5">
            <FieldLegend variant="label" className="sr-only">
              Raison principale
            </FieldLegend>
            <RadioGroup
              name={field.name}
              value={field.value ?? ""}
              onValueChange={field.onChange}
              disabled={busy}
              aria-invalid={fieldState.invalid}
              className="flex flex-wrap gap-2"
            >
              {DELETION_FEEDBACK_REASONS.map((item) => (
                <FieldLabel
                  key={item.value}
                  htmlFor={`exit-reason-${item.value}`}
                  className={chip}
                >
                  <RadioGroupItem
                    value={item.value}
                    id={`exit-reason-${item.value}`}
                    aria-invalid={fieldState.invalid}
                    className="sr-only absolute"
                  />
                  {item.label}
                </FieldLabel>
              ))}
            </RadioGroup>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </FieldSet>
        )}
      />

      {/* The comment only shows once a reason is picked: one tap is enough. */}
      {followUp && (
        <div className="mt-6 space-y-4 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-300">
          <Controller
            name="comment"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="exit-comment">{followUp}</FieldLabel>
                <Textarea
                  {...field}
                  id="exit-comment"
                  rows={3}
                  maxLength={COMMENT_MAX}
                  autoComplete="off"
                  disabled={busy}
                  aria-invalid={fieldState.invalid}
                  aria-describedby="exit-comment-help"
                  placeholder="Facultatif"
                  className="resize-none"
                />
                <FieldDescription
                  id="exit-comment-help"
                  className="flex justify-between gap-3 text-xs"
                >
                  <span>N’indiquez aucune information personnelle.</span>
                  <span className="shrink-0 tabular-nums" aria-hidden>
                    {field.value.length}/{COMMENT_MAX}
                  </span>
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />
          <Button
            type="submit"
            size="lg"
            disabled={busy}
            className="w-full"
          >
            {busy && <Loader2 aria-hidden className="animate-spin" />}
            {busy ? "Envoi…" : "Envoyer ma réponse"}
          </Button>
        </div>
      )}
    </form>
  );
}
