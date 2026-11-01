"use client";

import { useId, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, PenLine, ThumbsDown, ThumbsUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { rateAiMessageAction, submitCorrectionAction } from "@/app/actions/agent-improvement";
import type { ChatFeedback } from "@/lib/chat";
import { KNOWLEDGE_LIMITS } from "@/lib/knowledge-shared";
import { cn } from "@/lib/utils";

const CorrectionFormSchema = z.object({
  question: z.string().trim().max(KNOWLEDGE_LIMITS.titleMax, `${KNOWLEDGE_LIMITS.titleMax} caractères au maximum.`),
  correction: z
    .string()
    .trim()
    .min(3, "Écrivez au moins 3 caractères.")
    .max(KNOWLEDGE_LIMITS.contentMax, `${KNOWLEDGE_LIMITS.contentMax} caractères au maximum.`),
  kind: z.enum(["FAQ", "TEXT"]),
});

const PublishFormSchema = CorrectionFormSchema.extend({
  question: CorrectionFormSchema.shape.question.min(3, "Au moins 3 caractères."),
});

/** Team feedback on one AI reply: approve, flag, or correct it. */
export function AiFeedbackControls({
  projectId,
  messageId,
  question,
  canPublish,
  feedback,
}: {
  projectId: string;
  messageId: string;
  /** Message du client auquel cette réponse a répondu. */
  question: string;
  /** Ajoute directement à l’Assistant IA ; le serveur revérifie ce droit. */
  canPublish: boolean;
  feedback: ChatFeedback | null;
}) {
  const id = useId();
  const [current, setCurrent] = useState<ChatFeedback | null>(feedback);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<z.input<typeof CorrectionFormSchema>, unknown, z.output<typeof CorrectionFormSchema>>({
    resolver: zodResolver(canPublish ? PublishFormSchema : CorrectionFormSchema),
    defaultValues: {
      question: question.slice(0, KNOWLEDGE_LIMITS.titleMax),
      correction: feedback?.correction ?? "",
      kind: "FAQ",
    },
  });

  function rate(rating: "UP" | "DOWN") {
    const previous = current;
    setCurrent({ rating, correction: null });
    startTransition(async () => {
      const result = await rateAiMessageAction({ projectId, messageId, rating });
      if (!result.success) {
        setCurrent(previous);
        toast.error(result.error);
        return;
      }
      setCurrent(result.feedback);
    });
  }

  function submit(values: z.output<typeof CorrectionFormSchema>) {
    startTransition(async () => {
      const result = await submitCorrectionAction({ projectId, messageId, ...values });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setCurrent(result.feedback);
      setOpen(false);
      toast.success(result.published ? "Réponse ajoutée à l’Assistant IA" : "Correction envoyée à l’équipe");
    });
  }

  return (
    <span className="inline-flex items-center gap-0.5" role="group" aria-label="Évaluer cette réponse de l’IA">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={pending}
        aria-pressed={current?.rating === "UP"}
        aria-label="Bonne réponse"
        className={cn("text-muted-foreground", current?.rating === "UP" && "bg-muted text-foreground")}
        onClick={() => rate("UP")}
      >
        <ThumbsUp aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        disabled={pending}
        aria-pressed={current?.rating === "DOWN"}
        aria-label="Réponse à revoir"
        className={cn("text-muted-foreground", current?.rating === "DOWN" && "bg-muted text-foreground")}
        onClick={() => {
          if (current?.rating !== "DOWN") rate("DOWN");
          setOpen(true);
        }}
      >
        <ThumbsDown aria-hidden="true" />
      </Button>
      {current?.rating === "DOWN" && (
        <Button
          type="button"
          variant="ghost"
          size="xs"
          className="text-muted-foreground"
          onClick={() => setOpen(true)}
        >
          <PenLine data-icon="inline-start" />
          {current.correction ? "Corrigée" : "Corriger"}
        </Button>
      )}

      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Corriger la réponse</DialogTitle>
            <DialogDescription>
              {canPublish
                ? "Ajoutée à l’Assistant IA dès maintenant. L’équipe est prévenue."
                : "Un administrateur la validera. L’équipe est prévenue."}
            </DialogDescription>
          </DialogHeader>
          <form id={id} noValidate onSubmit={form.handleSubmit(submit)}>
            <FieldGroup className="gap-4">
              {canPublish ? (
                <Controller
                  name="question"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={`${id}-question`}>Question du client</FieldLabel>
                      <Input
                        {...field}
                        id={`${id}-question`}
                        autoComplete="off"
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              ) : (
                question && (
                  <blockquote className="border-l-2 pl-3 text-sm text-muted-foreground wrap-anywhere">
                    <p className="line-clamp-3">{question}</p>
                  </blockquote>
                )
              )}
              <Controller
                name="correction"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`${id}-correction`}>Bonne réponse</FieldLabel>
                    <Textarea
                      {...field}
                      id={`${id}-correction`}
                      rows={4}
                      autoFocus
                      maxLength={KNOWLEDGE_LIMITS.contentMax}
                      aria-invalid={fieldState.invalid}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </FieldGroup>
          </form>
          <DialogFooter>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
              Annuler
            </Button>
            <Button type="submit" form={id} disabled={pending}>
              {pending && <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
              {canPublish ? "Ajouter" : "Envoyer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </span>
  );
}
