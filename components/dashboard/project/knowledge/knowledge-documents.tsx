"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CircleAlert, FileUp, Globe, Loader2, RotateCw, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  addKnowledgeUrlAction,
  deleteKnowledgeSourceAction,
  getKnowledgeSourceContentAction,
  retryKnowledgeSourceAction,
} from "@/app/actions/knowledge";
import {
  KNOWLEDGE_LIMITS,
  extractBlocks,
  sourceErrorLabel,
  wordsToPages,
} from "@/lib/knowledge-shared";
import type { KnowledgeSourceView, KnowledgeUsage } from "./types";

const UrlFormSchema = z.object({
  url: z
    .string()
    .trim()
    .min(1, "Saisissez l’adresse de la page.")
    .max(2000, "Adresse trop longue.")
    .refine((value) => {
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    }, "Saisissez une adresse complète en https://."),
});

function UrlForm({ projectId, disabled, onAdded }: { projectId: string; disabled: boolean; onAdded: () => void }) {
  const id = useId();
  const form = useForm<z.input<typeof UrlFormSchema>, unknown, z.output<typeof UrlFormSchema>>({
    resolver: zodResolver(UrlFormSchema),
    defaultValues: { url: "" },
  });
  const [saving, setSaving] = useState(false);
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async ({ url }) => {
        setSaving(true);
        const result = await addKnowledgeUrlAction({ projectId, url });
        setSaving(false);
        if (!result.success) {
          form.setError("url", { message: result.error });
          return;
        }
        toast.success("Page ajoutée. Son contenu sera lu dans quelques instants.");
        form.reset();
        onAdded();
      })}
    >
      <Controller
        name="url"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={id} className="sr-only">
              Page de votre site
            </FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <Globe aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                {...field}
                id={id}
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://maboutique.com/livraison"
                disabled={disabled || saving}
                aria-invalid={fieldState.invalid}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton type="submit" variant="secondary" disabled={disabled || saving}>
                  {saving && <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
                  Importer
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </form>
  );
}

function SourceStatus({ source }: { source: KnowledgeSourceView }) {
  if (source.status === "READY") {
    return source.truncated ? (
      <span className="text-xs">Import partiel</span>
    ) : null;
  }
  if (source.status === "FAILED") {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
        <CircleAlert aria-hidden="true" className="size-3.5" />
        {sourceErrorLabel(source.errorCode)}
      </span>
    );
  }
  return (
    <span role="status" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <Loader2 aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" />
      {source.status === "PROCESSING" ? "Lecture en cours…" : "En file d’attente"}
    </span>
  );
}

/** Le texte tel que l’assistant le lit : c’est ce qui a été extrait de la source. */
function SourceContentDialog({
  projectId,
  source,
}: {
  projectId: string;
  source: KnowledgeSourceView;
}) {
  const [state, setState] = useState<
    | { status: "idle" | "loading" }
    | { status: "ready"; passages: { id: string; content: string }[] }
    | { status: "error"; message: string }
  >({ status: "idle" });

  async function load() {
    setState({ status: "loading" });
    try {
      const result = await getKnowledgeSourceContentAction({ projectId, sourceId: source.id });
      setState(
        result.success
          ? { status: "ready", passages: result.passages }
          : { status: "error", message: result.error },
      );
    } catch {
      setState({ status: "error", message: "Connexion interrompue. Réessayez." });
    }
  }

  return (
    <Dialog onOpenChange={(open) => open && void load()}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="link"
          className="h-auto p-0 text-xs font-normal text-muted-foreground"
        >
          Voir le contenu extrait
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-4 sm:max-w-2xl">
        <DialogHeader className="min-w-0 pr-6">
          <DialogTitle className="truncate">{source.name}</DialogTitle>
          <DialogDescription>Le texte que votre assistant utilise.</DialogDescription>
        </DialogHeader>
        <div className="min-h-32 flex-1 overflow-y-auto overscroll-contain" tabIndex={0}>
          {state.status === "ready" ? (
            <div className="pr-2 text-sm leading-relaxed wrap-anywhere">
              {state.passages.length ? (
                extractBlocks(state.passages.map((passage) => passage.content)).map((block, index) =>
                  block.type === "heading" ? (
                    <h3
                      key={index}
                      className="mt-5 font-heading text-sm font-semibold tracking-normal first:mt-0 [h3+&]:mt-0.5"
                    >
                      {block.text}
                    </h3>
                  ) : (
                    <p key={index} className="mt-1 text-muted-foreground">
                      {block.text}
                    </p>
                  ),
                )
              ) : (
                <p className="text-muted-foreground">Aucun texte conservé.</p>
              )}
            </div>
          ) : state.status === "error" ? (
            <p role="alert" className="text-sm text-destructive">
              {state.message}
            </p>
          ) : (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
              Chargement…
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function KnowledgeDocuments({
  projectId,
  usage,
  sources,
  onChanged,
}: {
  projectId: string;
  usage: KnowledgeUsage;
  sources: KnowledgeSourceView[];
  onChanged: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  // Confort uniquement : le serveur revérifie les deux limites.
  const baseFull = usage.words >= usage.wordLimit;
  const full = baseFull || usage.documents >= usage.documentLimit;

  async function upload(file: File) {
    // Confort uniquement : la limite de l’offre est vérifiée par le serveur.
    if (file.size > Math.min(KNOWLEDGE_LIMITS.pdfMaxBytes, usage.pdfMaxMb * 1024 * 1024)) {
      toast.error(`Le PDF dépasse ${usage.pdfMaxMb} Mo, la limite de votre offre.`);
      return;
    }
    setUploading(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/knowledge/upload`, {
        method: "POST",
        headers: { "content-type": "application/pdf", "x-file-name": encodeURIComponent(file.name) },
        body: file,
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) toast.error(payload.error ?? "Impossible d’importer ce PDF.");
      else {
        toast.success("PDF ajouté. Son contenu sera lu dans quelques instants.");
        onChanged();
      }
    } catch {
      toast.error("Connexion interrompue pendant l’envoi. Réessayez.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <UrlForm projectId={projectId} disabled={full} onAdded={onChanged} />
        <div>
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={full || uploading}
            onClick={() => fileInput.current?.click()}
            title={`PDF de ${usage.pdfMaxMb} Mo et ${KNOWLEDGE_LIMITS.pdfMaxPages} pages maximum`}
          >
            {uploading ? (
              <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />
            ) : (
              <FileUp data-icon="inline-start" />
            )}
            {uploading ? "Envoi du PDF…" : "Importer un PDF"}
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
        </div>
      </div>
      {full && (
        <p role="status" className="rounded-xl border bg-muted/40 p-3 text-sm">
          {baseFull ? (
            <>
              Votre base de connaissances est pleine :{" "}
              {usage.wordLimit.toLocaleString("fr-FR")} mots (≈{" "}
              {wordsToPages(usage.wordLimit).toLocaleString("fr-FR")} pages) avec votre
              offre. Supprimez des contenus ou changez d’offre pour importer d’autres
              documents.
            </>
          ) : (
            <>
              Vous avez atteint la limite de {usage.documentLimit} documents de votre
              offre. Supprimez une source ou changez d’offre pour en ajouter.
            </>
          )}
        </p>
      )}

      <section aria-label="Sources importées">
        {sources.length ? (
          <ul className="divide-y rounded-xl border">
            {sources.map((source) => {
              return (
                <li key={source.id} className="flex items-start gap-2 px-4 py-3 sm:items-center sm:gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{source.name}</p>
                    {source.url && (
                      <p className="truncate text-xs text-muted-foreground">{source.url}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-x-3">
                      <SourceStatus source={source} />
                      {source.type !== "CSV" && source.status === "READY" && (
                        <SourceContentDialog projectId={projectId} source={source} />
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {source.type !== "CSV" && (source.status === "FAILED" || source.status === "READY") && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={pending}
                        aria-label={`Relire « ${source.name} »`}
                        onClick={() =>
                          startTransition(async () => {
                            const result = await retryKnowledgeSourceAction({ projectId, sourceId: source.id });
                            if (!result.success) toast.error(result.error);
                            else onChanged();
                          })
                        }
                      >
                        <RotateCw aria-hidden="true" />
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Supprimer « ${source.name} »`}>
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Supprimer cette source ?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Les {source.entryCount.toLocaleString("fr-FR")} entrée(s) issues de « {source.name} »
                            seront retirées de la base de connaissances.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction
                            variant="destructive"
                            onClick={() =>
                              startTransition(async () => {
                                const result = await deleteKnowledgeSourceAction({ projectId, sourceId: source.id });
                                if (!result.success) toast.error(result.error);
                                else {
                                  toast.success("Source supprimée");
                                  onChanged();
                                }
                              })
                            }
                          >
                            Supprimer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Ajoutez une page de votre site ou un PDF.
          </p>
        )}
      </section>
    </div>
  );
}
