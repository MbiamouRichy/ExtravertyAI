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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { rateAiMessageAction } from "@/app/actions/agent-improvement";
import type { ChatFeedback } from "@/lib/chat";
import { KNOWLEDGE_LIMITS } from "@/lib/knowledge-shared";
import { cn } from "@/lib/utils";

const CorrectionFormSchema = z.object({
  correction: z
    .string()
    .trim()
    .min(3, "Proposez une réponse d’au moins 3 caractères.")
    .max(KNOWLEDGE_LIMITS.contentMax, `${KNOWLEDGE_LIMITS.contentMax} caractères au maximum.`),
});

/** Team feedback on one AI reply: approve, flag, or propose a better answer. */
export function AiFeedbackControls({
  projectId,
  messageId,
  feedback,
}: {
  projectId: string;
  messageId: string;
  feedback: ChatFeedback | null;
}) {
  const id = useId();
  const [current, setCurrent] = useState<ChatFeedback | null>(feedback);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<z.input<typeof CorrectionFormSchema>, unknown, z.output<typeof CorrectionFormSchema>>({
    resolver: zodResolver(CorrectionFormSchema),
    defaultValues: { correction: feedback?.correction ?? "" },
  });

  function rate(rating: "UP" | "DOWN", correction: string | null = null, after?: () => void) {
    const previous = current;
    setCurrent({ rating, correction });
    startTransition(async () => {
      const result = await rateAiMessageAction({ projectId, messageId, rating, correction });
      if (!result.success) {
        setCurrent(previous);
        toast.error(result.error);
        return;
      }
      setCurrent(result.feedback);
      after?.();
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
          {current.correction ? "Correction proposée" : "Corriger"}
        </Button>
      )}

      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Proposer une meilleure réponse</DialogTitle>
            <DialogDescription>
              Un administrateur pourra l’ajouter à la base de connaissances : l’assistant
              répondra correctement la prochaine fois.
            </DialogDescription>
          </DialogHeader>
          <form
            id={id}
            noValidate
            onSubmit={form.handleSubmit(({ correction }) =>
              rate("DOWN", correction, () => {
                setOpen(false);
                toast.success("Merci, votre correction est transmise");
              }),
            )}
          >
            <Controller
              name="correction"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${id}-correction`}>Réponse attendue</FieldLabel>
                  <Textarea
                    {...field}
                    id={`${id}-correction`}
                    rows={5}
                    autoFocus
                    maxLength={KNOWLEDGE_LIMITS.contentMax}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={`${id}-help`}
                  />
                  <FieldDescription id={`${id}-help`}>
                    Écrivez la réponse telle que l’assistant aurait dû la donner.
                  </FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </form>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Plus tard
            </Button>
            <Button type="submit" form={id} disabled={pending}>
              {pending && <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
              Envoyer la correction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </span>
  );
}
