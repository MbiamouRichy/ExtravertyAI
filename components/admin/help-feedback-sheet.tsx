"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowUpRight, FileQuestion, Loader2, Save, ThumbsDown, ThumbsUp } from "lucide-react";

import { updateHelpFeedbackAction } from "@/app/admin/aide/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  HELP_FEEDBACK_REASON_LABEL,
  HELP_FEEDBACK_STATUSES,
  HELP_INTERNAL_NOTE_MAX as NOTE_MAX,
} from "@/lib/help-center/feedback-shared";
import { cn } from "@/lib/utils";
import { formatFeedbackDate } from "./feedback-labels";
import { HELP_STATUS_LABEL } from "./help-feedback-labels";

/** Données du détail, sérialisables : préparées par la page serveur. */
export type HelpFeedbackSheetData = {
  id: string;
  articleSlug: string;
  articleTitle: string;
  helpful: boolean;
  reason: keyof typeof HELP_FEEDBACK_REASON_LABEL | null;
  comment: string | null;
  status: (typeof HELP_FEEDBACK_STATUSES)[number];
  createdAt: Date;
  updatedAt: Date;
  author: { name: string; email: string } | null;
  handledAt: Date | null;
  handledByName: string | null;
  internalNote: string | null;
};

const Schema = z.object({
  status: z.enum(HELP_FEEDBACK_STATUSES),
  internalNote: z.string().trim().max(NOTE_MAX, `${NOTE_MAX} caractères au maximum.`),
});
type Values = z.infer<typeof Schema>;

/** Détail d’un avis, ouvert par `?id=` : l’URL garde les filtres de la liste. */
export function HelpFeedbackSheet({
  feedback,
  closeHref,
  timeZone,
}: {
  feedback: HelpFeedbackSheetData | null;
  closeHref: string;
  timeZone: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) setTimeout(() => router.push(closeHref, { scroll: false }), 150);
  }

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-lg">
        {feedback ? (
          <Body feedback={feedback} timeZone={timeZone} />
        ) : (
          <>
            <SheetHeader className="sr-only">
              <SheetTitle>Avis introuvable</SheetTitle>
              <SheetDescription>Cet avis n’existe pas ou a été supprimé.</SheetDescription>
            </SheetHeader>
            <Empty className="m-4 rounded-2xl border border-dashed p-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileQuestion aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>Avis introuvable</EmptyTitle>
                <EmptyDescription>Cet avis n’existe pas ou a été supprimé.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Body({ feedback, timeZone }: { feedback: HelpFeedbackSheetData; timeZone: string }) {
  const status = HELP_STATUS_LABEL[feedback.status];
  const Vote = feedback.helpful ? ThumbsUp : ThumbsDown;
  return (
    <>
      <SheetHeader className="border-b pr-12">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            <Vote data-icon="inline-start" aria-hidden="true" />
            {feedback.helpful ? "Utile" : "Pas utile"}
          </Badge>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <SheetTitle className="mt-1">{feedback.articleTitle}</SheetTitle>
        <SheetDescription>
          Avis du{" "}
          <time dateTime={feedback.updatedAt.toISOString()}>{formatFeedbackDate(feedback.updatedAt, timeZone)}</time>
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-6 p-4">
        {!feedback.helpful && (
          <section aria-labelledby="help-feedback-comment">
            <h3 id="help-feedback-comment" className="text-xs font-medium text-muted-foreground">
              {feedback.reason ? HELP_FEEDBACK_REASON_LABEL[feedback.reason] : "Aucun motif précisé"}
            </h3>
            <p
              className={cn(
                "mt-2 rounded-xl border bg-muted/30 p-3 text-sm leading-relaxed break-words whitespace-pre-wrap",
                !feedback.comment && "text-muted-foreground",
              )}
            >
              {feedback.comment ?? "Pas de commentaire."}
            </p>
          </section>
        )}

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Article</dt>
          <dd className="min-w-0">
            <Link
              href={`/aide/${feedback.articleSlug}`}
              target="_blank"
              className="inline-flex items-center gap-1 underline underline-offset-4"
            >
              /aide/{feedback.articleSlug}
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
              <span className="sr-only"> (nouvel onglet)</span>
            </Link>
          </dd>
          <dt className="text-muted-foreground">Auteur</dt>
          <dd className="min-w-0">
            {feedback.author ? (
              <>
                <span className="block truncate">{feedback.author.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{feedback.author.email}</span>
              </>
            ) : (
              "Visiteur sans compte"
            )}
          </dd>
          <dt className="text-muted-foreground">Premier vote</dt>
          <dd>
            <time dateTime={feedback.createdAt.toISOString()}>{formatFeedbackDate(feedback.createdAt, timeZone)}</time>
          </dd>
          {feedback.handledAt && (
            <>
              <dt className="text-muted-foreground">Pris en charge</dt>
              <dd className="min-w-0">
                {feedback.handledByName ?? "Ancien membre"},{" "}
                <time dateTime={feedback.handledAt.toISOString()}>{formatFeedbackDate(feedback.handledAt, timeZone)}</time>
              </dd>
            </>
          )}
        </dl>

        <TriageForm feedback={feedback} />
      </div>
    </>
  );
}

function TriageForm({ feedback }: { feedback: HelpFeedbackSheetData }) {
  const id = useId();
  const defaults: Values = { status: feedback.status, internalNote: feedback.internalNote ?? "" };
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: defaults });
  const note = useWatch({ control: form.control, name: "internalNote" });
  const submitting = form.formState.isSubmitting;

  const submit = form.handleSubmit(async (values) => {
    try {
      const result = await updateHelpFeedbackAction({ id: feedback.id, ...values });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      form.reset(values);
      toast.success(result.changed ? "Avis mis à jour." : "Aucun changement à enregistrer.");
    } catch {
      toast.error("Connexion interrompue. La modification n’a pas été enregistrée.");
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4 border-t pt-6">
      <h3 className="text-sm font-medium">Suivi interne</h3>
      <FieldGroup>
        <Controller
          name="status"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${id}-status`}>Statut</FieldLabel>
              <Select name={field.name} value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id={`${id}-status`} ref={field.ref} aria-invalid={fieldState.invalid} className="w-full">
                  <SelectValue>{HELP_STATUS_LABEL[field.value].label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {HELP_FEEDBACK_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {HELP_STATUS_LABEL[status].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
        <Controller
          name="internalNote"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${id}-note`}>Note interne</FieldLabel>
              <Textarea
                {...field}
                id={`${id}-note`}
                rows={4}
                maxLength={NOTE_MAX}
                placeholder="Correction apportée à l’article, décision…"
                aria-invalid={fieldState.invalid}
                aria-describedby={`${id}-note-help`}
                className="min-h-24 resize-y"
              />
              <FieldDescription id={`${id}-note-help`} className="flex justify-between gap-3 text-xs">
                <span>Visible de l’équipe seulement.</span>
                <span className={cn("shrink-0 tabular-nums", note.length > NOTE_MAX * 0.9 && "text-foreground")}>
                  {note.length.toLocaleString("fr-FR")} / {NOTE_MAX.toLocaleString("fr-FR")}
                </span>
              </FieldDescription>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />
      </FieldGroup>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={submitting || !form.formState.isDirty}
          onClick={() => form.reset(defaults)}
        >
          Annuler les modifications
        </Button>
        <Button type="submit" disabled={submitting || !form.formState.isDirty}>
          {submitting ? (
            <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          {submitting ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
