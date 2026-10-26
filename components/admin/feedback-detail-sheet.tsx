"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { FileQuestion, Loader2, Mail, Save } from "lucide-react";

import {
  FEEDBACK_STATUSES,
  INTERNAL_NOTE_MAX,
  type FeedbackDetail,
} from "@/lib/admin-feedback";
import { updateFeedbackAction } from "@/app/admin/feedback/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { KIND_LABEL, STATUS_LABEL, formatFeedbackDate } from "./feedback-labels";
import { cn } from "@/lib/utils";

const Schema = z.object({
  status: z.enum(FEEDBACK_STATUSES),
  internalNote: z
    .string()
    .trim()
    .max(INTERNAL_NOTE_MAX, `${INTERNAL_NOTE_MAX} caractères au maximum.`),
});
type Values = z.infer<typeof Schema>;

/** Détail d'un retour, ouvert par `?id=` : l'URL garde les filtres de la liste. */
export function FeedbackDetailSheet({
  feedback,
  closeHref,
  timeZone,
}: {
  feedback: FeedbackDetail | null;
  closeHref: string;
  timeZone: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  function changeOpen(next: boolean) {
    setOpen(next);
    // Après l'animation de fermeture, la liste reprend son URL sans détail.
    if (!next) setTimeout(() => router.push(closeHref, { scroll: false }), 150);
  }

  return (
    <Sheet open={open} onOpenChange={changeOpen}>
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-lg">
        {feedback ? (
          <FeedbackDetailBody feedback={feedback} timeZone={timeZone} />
        ) : (
          <>
            <SheetHeader className="sr-only">
              <SheetTitle>Retour introuvable</SheetTitle>
              <SheetDescription>Ce retour n’existe pas ou a été supprimé.</SheetDescription>
            </SheetHeader>
            <Empty className="m-4 rounded-2xl border border-dashed p-8">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileQuestion aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>Retour introuvable</EmptyTitle>
                <EmptyDescription>
                  Ce retour n’existe pas ou a été supprimé avec le compte de son auteur.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function FeedbackDetailBody({
  feedback,
  timeZone,
}: {
  feedback: FeedbackDetail;
  timeZone: string;
}) {
  const kind = KIND_LABEL[feedback.kind];
  const status = STATUS_LABEL[feedback.status];
  const subject = `Votre retour sur ExtravertyAI (${kind.label.toLowerCase()})`;

  return (
    <>
      <SheetHeader className="border-b pr-12">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            <kind.icon data-icon="inline-start" aria-hidden="true" />
            {kind.label}
          </Badge>
          <Badge variant={status.variant}>{status.label}</Badge>
        </div>
        <SheetTitle className="mt-1">
          Retour du{" "}
          <time dateTime={feedback.createdAt.toISOString()}>
            {formatFeedbackDate(feedback.createdAt, timeZone)}
          </time>
        </SheetTitle>
        <SheetDescription>
          {feedback.user?.name ?? "Compte supprimé"}
          {feedback.project ? ` · ${feedback.project.name}` : ""}
        </SheetDescription>
      </SheetHeader>

      <div className="flex flex-col gap-6 p-4">
        <section aria-labelledby="feedback-message">
          <h3 id="feedback-message" className="text-xs font-medium text-muted-foreground">
            Message
          </h3>
          <p className="mt-2 rounded-xl border bg-muted/30 p-3 text-sm leading-relaxed break-words whitespace-pre-wrap">
            {feedback.message}
          </p>
        </section>

        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Auteur</dt>
          <dd className="min-w-0">
            <span className="block truncate">{feedback.user?.name ?? "Compte supprimé"}</span>
            {feedback.user && (
              <span className="block truncate text-xs text-muted-foreground">
                {feedback.user.email}
              </span>
            )}
          </dd>
          <dt className="text-muted-foreground">Projet</dt>
          <dd className="truncate">{feedback.project?.name ?? "Aucun"}</dd>
          <dt className="text-muted-foreground">Page</dt>
          <dd className="min-w-0">
            {feedback.pagePath ? (
              <code className="block truncate font-mono text-xs" title={feedback.pagePath}>
                {feedback.pagePath}
              </code>
            ) : (
              "Inconnue"
            )}
          </dd>
          <dt className="text-muted-foreground">Recontact</dt>
          <dd>{feedback.contactOk ? "Accepté" : "Refusé"}</dd>
          {feedback.handledAt && (
            <>
              <dt className="text-muted-foreground">Pris en charge</dt>
              <dd className="min-w-0">
                {feedback.handledBy?.name ?? "Ancien membre"},{" "}
                <time dateTime={feedback.handledAt.toISOString()}>
                  {formatFeedbackDate(feedback.handledAt, timeZone)}
                </time>
              </dd>
            </>
          )}
        </dl>

        {feedback.replyEmail ? (
          <Button asChild variant="outline" className="w-full sm:w-fit">
            <a
              href={`mailto:${encodeURIComponent(feedback.replyEmail)}?subject=${encodeURIComponent(subject)}`}
            >
              <Mail data-icon="inline-start" />
              Répondre par e-mail
            </a>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            L’auteur n’a pas accepté d’être recontacté : pas de réponse par e-mail.
          </p>
        )}

        <FeedbackTriageForm feedback={feedback} />
      </div>
    </>
  );
}

function FeedbackTriageForm({ feedback }: { feedback: FeedbackDetail }) {
  const id = useId();
  const defaults: Values = {
    status: feedback.status,
    internalNote: feedback.internalNote ?? "",
  };
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: defaults });
  const note = useWatch({ control: form.control, name: "internalNote" });

  const submit = form.handleSubmit(async (values) => {
    try {
      const result = await updateFeedbackAction({ id: feedback.id, ...values });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      form.reset(values);
      toast.success(result.changed ? "Retour mis à jour." : "Aucun changement à enregistrer.");
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
                <SelectTrigger
                  id={`${id}-status`}
                  ref={field.ref}
                  aria-invalid={fieldState.invalid}
                  className="w-full"
                >
                  <SelectValue>{STATUS_LABEL[field.value].label}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {FEEDBACK_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABEL[status].label}
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
                maxLength={INTERNAL_NOTE_MAX}
                placeholder="Ticket lié, piste de correction, décision…"
                aria-invalid={fieldState.invalid}
                aria-describedby={`${id}-note-help`}
                className="min-h-24 resize-y"
              />
              <FieldDescription
                id={`${id}-note-help`}
                className="flex justify-between gap-3 text-xs"
              >
                <span>Visible de l’équipe seulement, jamais de l’auteur.</span>
                <span
                  className={cn(
                    "shrink-0 tabular-nums",
                    note.length > INTERNAL_NOTE_MAX * 0.9 && "text-foreground",
                  )}
                >
                  {note.length.toLocaleString("fr-FR")} /{" "}
                  {INTERNAL_NOTE_MAX.toLocaleString("fr-FR")}
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
          disabled={form.formState.isSubmitting || !form.formState.isDirty}
          onClick={() => form.reset(defaults)}
        >
          Annuler les modifications
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting || !form.formState.isDirty}>
          {form.formState.isSubmitting ? (
            <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />
          ) : (
            <Save data-icon="inline-start" />
          )}
          {form.formState.isSubmitting ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </form>
  );
}
