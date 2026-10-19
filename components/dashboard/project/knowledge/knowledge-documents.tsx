"use client";

import { useId, useRef, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  CircleAlert,
  CircleCheck,
  FileSpreadsheet,
  FileText,
  FileUp,
  Globe,
  Loader2,
  RotateCw,
  Trash2,
} from "lucide-react";

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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  addKnowledgeUrlAction,
  deleteKnowledgeSourceAction,
  retryKnowledgeSourceAction,
} from "@/app/actions/knowledge";
import { KNOWLEDGE_LIMITS, sourceErrorLabel } from "@/lib/knowledge-shared";
import { cn } from "@/lib/utils";
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
            <FieldLabel htmlFor={id}>Page de votre site</FieldLabel>
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
                aria-describedby={`${id}-help`}
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton type="submit" variant="secondary" disabled={disabled || saving}>
                  {saving && <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
                  Importer
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription id={`${id}-help`}>
              Livraison, retours, FAQ… Seul le texte principal de la page est conservé.
            </FieldDescription>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
    </form>
  );
}

function SourceStatus({ source }: { source: KnowledgeSourceView }) {
  if (source.status === "READY") {
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs", source.truncated && "text-foreground")}>
        {source.truncated ? (
          <CircleAlert aria-hidden="true" className="size-3.5" />
        ) : (
          <CircleCheck aria-hidden="true" className="size-3.5" />
        )}
        {source.entryCount.toLocaleString("fr-FR")} {source.type === "CSV" ? "produit(s)" : "extrait(s)"}
        {source.truncated && " · import partiel"}
      </span>
    );
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
  const full = usage.documents >= usage.documentLimit;

  async function upload(file: File) {
    if (file.size > KNOWLEDGE_LIMITS.pdfMaxBytes) {
      toast.error("Le PDF dépasse 10 Mo.");
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
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <UrlForm projectId={projectId} disabled={full} onAdded={onChanged} />
        <div className="space-y-2 lg:pt-6">
          <Button
            type="button"
            variant="outline"
            className="w-full lg:w-auto"
            disabled={full || uploading}
            onClick={() => fileInput.current?.click()}
          >
            {uploading ? (
              <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />
            ) : (
              <FileUp data-icon="inline-start" />
            )}
            {uploading ? "Envoi du PDF…" : "Importer un PDF"}
          </Button>
          <p className="text-xs text-muted-foreground">10 Mo et 200 pages maximum.</p>
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
          Vous avez atteint la limite de {usage.documentLimit} documents de votre offre.
          Supprimez une source ou changez d’offre pour en ajouter.
        </p>
      )}

      <section aria-labelledby="knowledge-sources">
        <h2
          id="knowledge-sources"
          className="mb-3 font-mono text-[11px] font-normal uppercase tracking-wider text-muted-foreground"
        >
          Sources importées · {sources.length}
        </h2>
        {sources.length ? (
          <ul className="divide-y rounded-2xl border bg-card">
            {sources.map((source) => {
              const Icon = source.type === "PDF" ? FileText : source.type === "URL" ? Globe : FileSpreadsheet;
              return (
                <li key={source.id} className="flex items-center gap-3 p-4">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{source.name}</p>
                    {source.url && (
                      <p className="truncate font-mono text-[11px] text-muted-foreground">{source.url}</p>
                    )}
                    <div className="mt-1">
                      <SourceStatus source={source} />
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
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aucune source pour l’instant. Importez une page de votre site ou un PDF
            (catalogue, conditions de vente, menu…).
          </p>
        )}
      </section>
    </div>
  );
}
