"use client";

import { useId, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CircleCheck, Loader2, Send, ThumbsDown, ThumbsUp } from "lucide-react";

import { submitHelpFeedbackAction } from "@/app/aide/actions";
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
  HELP_FEEDBACK_COMMENT_MAX,
  HELP_FEEDBACK_REASON_LABEL,
  HELP_FEEDBACK_REASONS,
  type HelpFeedbackReasonValue,
} from "@/lib/help-center/feedback-shared";

const DetailsSchema = z.object({
  reason: z
    .string()
    .refine(
      (value): value is HelpFeedbackReasonValue => (HELP_FEEDBACK_REASONS as readonly string[]).includes(value),
      "Choisissez ce qui n’allait pas.",
    ),
  comment: z
    .string()
    .trim()
    .max(HELP_FEEDBACK_COMMENT_MAX, `${HELP_FEEDBACK_COMMENT_MAX} caractères au maximum.`),
});
// Saisie : motif vide tant que rien n’est coché ; après validation, un motif connu.
type DetailsInput = z.input<typeof DetailsSchema>;
type DetailsValues = z.output<typeof DetailsSchema>;
const DEFAULTS: DetailsInput = { reason: "", comment: "" };
const COUNTER_FROM = Math.floor(HELP_FEEDBACK_COMMENT_MAX * 0.8);

type Step = "vote" | "details" | "thanks";

/**
 * « Cet article vous a-t-il aidé ? ». Un clic suffit à compter le vote ; après
 * un « Non », le motif et le commentaire sont facultatifs et complètent le
 * même vote. L’équipe les traite dans le back-office (/admin/aide).
 */
export function HelpFeedback({ articleSlug }: { articleSlug: string }) {
  const id = useId();
  const [step, setStep] = useState<Step>("vote");
  const [vote, setVote] = useState<boolean | null>(null);
  const [voting, setVoting] = useState(false);
  const form = useForm<DetailsInput, unknown, DetailsValues>({ resolver: zodResolver(DetailsSchema), defaultValues: DEFAULTS });
  const comment = useWatch({ control: form.control, name: "comment" });
  const submitting = form.formState.isSubmitting;

  async function sendVote(helpful: boolean) {
    setVoting(true);
    try {
      const result = await submitHelpFeedbackAction({ articleSlug, helpful });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setVote(helpful);
      setStep(helpful ? "thanks" : "details");
    } catch {
      toast.error("Connexion interrompue. Votre avis n’a pas été envoyé.");
    } finally {
      setVoting(false);
    }
  }

  const submitDetails = form.handleSubmit(async (values) => {
    try {
      const result = await submitHelpFeedbackAction({
        articleSlug,
        helpful: false,
        reason: values.reason as HelpFeedbackReasonValue,
        comment: values.comment || null,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setStep("thanks");
    } catch {
      toast.error("Connexion interrompue. Vos précisions n’ont pas été envoyées.");
    }
  });

  function restart() {
    form.reset(DEFAULTS);
    setVote(null);
    setStep("vote");
  }

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-2xl border bg-muted/30 p-5 sm:p-6">
      {step === "thanks" ? (
        <div role="status" className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-foreground" />
            <div>
              <h2 id={`${id}-title`} className="text-base! tracking-tight!">
                Merci pour votre avis
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {vote
                  ? "Ravi que ce guide vous ait aidé."
                  : "L’équipe lit chaque avis pour améliorer ce guide. Besoin d’aide tout de suite ? Écrivez-nous sur WhatsApp."}
              </p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={restart}>
            Modifier mon avis
          </Button>
        </div>
      ) : step === "details" ? (
        <form onSubmit={submitDetails} noValidate aria-labelledby={`${id}-title`} className="grid gap-5">
          <div>
            <h2 id={`${id}-title`} className="text-base! tracking-tight!">
              Qu’est-ce qui n’allait pas ?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Votre vote est compté. Ces précisions sont facultatives.</p>
          </div>
          <FieldGroup className="gap-5">
            <Controller
              name="reason"
              control={form.control}
              render={({ field, fieldState }) => (
                <FieldSet data-invalid={fieldState.invalid}>
                  <FieldLegend variant="label">Motif</FieldLegend>
                  <RadioGroup
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    aria-invalid={fieldState.invalid}
                    className="grid gap-2 sm:grid-cols-2"
                  >
                    {HELP_FEEDBACK_REASONS.map((reason) => (
                      <Field key={reason} orientation="horizontal" className="rounded-lg border bg-background px-3 py-2.5">
                        <RadioGroupItem id={`${id}-${reason}`} value={reason} aria-invalid={fieldState.invalid} />
                        <FieldLabel htmlFor={`${id}-${reason}`} className="font-normal">
                          {HELP_FEEDBACK_REASON_LABEL[reason]}
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
                  <FieldLabel htmlFor={`${id}-comment`}>Précisions (facultatif)</FieldLabel>
                  <Textarea
                    {...field}
                    id={`${id}-comment`}
                    rows={3}
                    maxLength={HELP_FEEDBACK_COMMENT_MAX}
                    autoComplete="off"
                    placeholder="L’étape où vous avez bloqué, ce que vous voyiez à l’écran…"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={`${id}-comment-help`}
                    className="min-h-20 resize-y bg-background"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  <FieldDescription id={`${id}-comment-help`} className="flex justify-between gap-3 text-xs">
                    <span>N’indiquez ni mot de passe, ni code, ni donnée de vos clients.</span>
                    {comment.length >= COUNTER_FROM && (
                      <span className="shrink-0 text-foreground tabular-nums">
                        {comment.length} / {HELP_FEEDBACK_COMMENT_MAX}
                      </span>
                    )}
                  </FieldDescription>
                </Field>
              )}
            />
          </FieldGroup>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" disabled={submitting} onClick={() => setStep("thanks")}>
              Passer
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />
              ) : (
                <Send data-icon="inline-start" />
              )}
              {submitting ? "Envoi…" : "Envoyer"}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id={`${id}-title`} className="text-base! tracking-tight!">
              Cet article vous a-t-il aidé ?
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">Un clic suffit : votre réponse nous aide à améliorer ce guide.</p>
          </div>
          <div className="flex gap-2" aria-busy={voting}>
            <Button type="button" variant="outline" disabled={voting} onClick={() => void sendVote(true)}>
              <ThumbsUp data-icon="inline-start" />
              Oui
            </Button>
            <Button type="button" variant="outline" disabled={voting} onClick={() => void sendVote(false)}>
              <ThumbsDown data-icon="inline-start" />
              Non
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
