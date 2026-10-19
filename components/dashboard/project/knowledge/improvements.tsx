"use client";

import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CircleHelp, Loader2, MessageSquareWarning, ThumbsDown, ThumbsUp } from "lucide-react";

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
import {
  answerGapAction,
  dismissCorrectionAction,
  dismissGapAction,
  promoteCorrectionAction,
} from "@/app/actions/agent-improvement";
import { KNOWLEDGE_LIMITS } from "@/lib/knowledge-shared";

export type ImprovementData = {
  ratings: { up: number; down: number };
  gaps: Array<{ id: string; question: string; createdAt: string; contactId: string | null; contactName: string | null }>;
  corrections: Array<{
    id: string;
    correction: string;
    original: string;
    question: string;
    author: string;
    contactName: string;
    updatedAt: string;
  }>;
};

const DraftSchema = z.object({
  question: z.string().trim().min(3, "Au moins 3 caractères.").max(KNOWLEDGE_LIMITS.titleMax),
  answer: z.string().trim().min(3, "Au moins 3 caractères.").max(KNOWLEDGE_LIMITS.contentMax),
});

type Draft =
  | { type: "gap"; id: string; question: string; answer: string }
  | { type: "correction"; id: string; question: string; answer: string };

function DraftDialog({
  projectId,
  draft,
  onClose,
  onSaved,
}: {
  projectId: string;
  draft: Draft;
  onClose: () => void;
  onSaved: () => void;
}) {
  const id = useId();
  const form = useForm<z.input<typeof DraftSchema>, unknown, z.output<typeof DraftSchema>>({
    resolver: zodResolver(DraftSchema),
    defaultValues: { question: draft.question.slice(0, KNOWLEDGE_LIMITS.titleMax), answer: draft.answer },
  });
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter à la base de connaissances</DialogTitle>
          <DialogDescription>
            L’assistant utilisera cette réponse dès la prochaine question similaire.
          </DialogDescription>
        </DialogHeader>
        <form
          id={id}
          noValidate
          onSubmit={form.handleSubmit(async (values) => {
            setSaving(true);
            const result =
              draft.type === "gap"
                ? await answerGapAction({ projectId, gapId: draft.id, draft: values })
                : await promoteCorrectionAction({ projectId, feedbackId: draft.id, draft: values });
            setSaving(false);
            if (!result.success) {
              toast.error(result.error);
              return;
            }
            toast.success("Réponse ajoutée à la base de connaissances");
            onClose();
            onSaved();
          })}
        >
          <FieldGroup className="gap-4">
            <Controller
              name="question"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${id}-question`}>Question du client</FieldLabel>
                  <Input {...field} id={`${id}-question`} autoComplete="off" aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="answer"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${id}-answer`}>Réponse</FieldLabel>
                  <Textarea
                    {...field}
                    id={`${id}-answer`}
                    rows={5}
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
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form={id} disabled={saving}>
            {saving && <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function Improvements({
  projectId,
  data,
  onChanged,
}: {
  projectId: string;
  data: ImprovementData;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  // Handled items disappear at once instead of waiting for the server refresh.
  const [handled, setHandled] = useState<ReadonlySet<string>>(() => new Set());
  const [pending, startTransition] = useTransition();
  const markHandled = (kind: Draft["type"], id: string) =>
    setHandled((previous) => new Set(previous).add(`${kind}:${id}`));
  const gaps = data.gaps.filter((gap) => !handled.has(`gap:${gap.id}`));
  const corrections = data.corrections.filter((item) => !handled.has(`correction:${item.id}`));
  const total = data.ratings.up + data.ratings.down;
  const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

  function dismiss(kind: "gap" | "correction", id: string) {
    startTransition(async () => {
      const result =
        kind === "gap"
          ? await dismissGapAction({ projectId, gapId: id })
          : await dismissCorrectionAction({ projectId, feedbackId: id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      markHandled(kind, id);
      onChanged();
    });
  }

  return (
    <div className="space-y-8">
      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-2xl border bg-border">
        {[
          { label: "Réponses approuvées", value: data.ratings.up, icon: ThumbsUp },
          { label: "Réponses à revoir", value: data.ratings.down, icon: ThumbsDown },
          {
            label: "Satisfaction de l’équipe",
            value: total ? `${Math.round((data.ratings.up / total) * 100)} %` : "—",
            icon: null,
          },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col-reverse gap-1 bg-card p-4">
            <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {stat.icon && <stat.icon aria-hidden="true" className="size-3.5" />}
              {stat.label} · 30 j
            </dt>
            <dd className="font-heading text-2xl font-bold tracking-tight tabular-nums">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="improve-gaps">
        <h2 id="improve-gaps" className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-normal">
          <CircleHelp aria-hidden="true" className="size-4" />
          Questions sans réponse
          <span className="font-mono text-xs font-normal text-muted-foreground">· {gaps.length}</span>
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          L’assistant a signalé qu’il lui manquait une information pour répondre.
          Répondez une fois, il saura répondre la prochaine fois.
        </p>
        {gaps.length ? (
          <ul className="divide-y rounded-2xl border bg-card">
            {gaps.map((gap) => (
              <li key={gap.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">« {gap.question} »</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {gap.contactName && gap.contactId ? (
                      <Link
                        href={`/projects/${projectId}/chat?contactId=${encodeURIComponent(gap.contactId)}`}
                        className="underline-offset-4 hover:underline"
                      >
                        {gap.contactName}
                      </Link>
                    ) : (
                      "Contact supprimé"
                    )}{" "}
                    · {date.format(new Date(gap.createdAt))}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => dismiss("gap", gap.id)}>
                    Ignorer
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setDraft({ type: "gap", id: gap.id, question: gap.question, answer: "" })}
                  >
                    Répondre
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aucune question en attente. Bravo, l’assistant a tout ce qu’il lui faut.
          </p>
        )}
      </section>

      <section aria-labelledby="improve-corrections">
        <h2 id="improve-corrections" className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-normal">
          <MessageSquareWarning aria-hidden="true" className="size-4" />
          Corrections proposées par l’équipe
          <span className="font-mono text-xs font-normal text-muted-foreground">· {corrections.length}</span>
        </h2>
        {corrections.length ? (
          <ul className="space-y-3">
            {corrections.map((item) => (
              <li key={item.id} className="rounded-2xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">
                  {item.author} · conversation avec {item.contactName} · {date.format(new Date(item.updatedAt))}
                </p>
                {item.question && <p className="mt-2 text-sm">Client : « {item.question} »</p>}
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border bg-muted/30 p-3">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Réponse de l’IA</p>
                    <p className="mt-1 line-clamp-4 text-sm text-muted-foreground line-through decoration-foreground/30">
                      {item.original}
                    </p>
                  </div>
                  <div className="rounded-xl border p-3">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Réponse proposée</p>
                    <p className="mt-1 text-sm">{item.correction}</p>
                  </div>
                </div>
                <div className="mt-3 flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => dismiss("correction", item.id)}>
                    Ignorer
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      setDraft({ type: "correction", id: item.id, question: item.question, answer: item.correction })
                    }
                  >
                    Ajouter à la base
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aucune correction en attente. Dans la messagerie, cliquez sur 👎 sous
            une réponse de l’IA pour proposer une meilleure formulation.
          </p>
        )}
      </section>

      {draft && (
        <DraftDialog
          key={`${draft.type}-${draft.id}`}
          projectId={projectId}
          draft={draft}
          onClose={() => setDraft(null)}
          onSaved={() => {
            markHandled(draft.type, draft.id);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
