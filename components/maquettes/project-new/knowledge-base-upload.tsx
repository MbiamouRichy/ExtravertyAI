"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { AnimatePresence, m } from "motion/react";
import { Check, FileText, FileUp, Globe, Plus, X } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { EASE_OUT } from "@/components/website/vitrine/motion";

import { SETUP_LIMITS } from "./data";
import {
  PROCESSING_MS,
  createPdfSources,
  createUrlSource,
} from "./knowledge-sources";
import type { KnowledgeSource, ProjectWizardValues } from "./schema";

export function KnowledgeBaseUpload() {
  const { control, getValues, setValue, setError, clearErrors, setFocus } =
    useFormContext<ProjectWizardValues>();
  const sources = useWatch({ control, name: "sources" });
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const dragDepth = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const full = sources.length >= SETUP_LIMITS.sources;

  function commit(next: KnowledgeSource[], message: string) {
    setValue("sources", next, { shouldDirty: true, shouldValidate: true });
    setAnnouncement(message);
  }

  async function addFiles(files: File[]) {
    if (!files.length || reading) return;
    setReading(true);
    try {
      const current = getValues("sources");
      const { added, errors } = await createPdfSources(files, current);
      if (added.length) {
        commit(
          [...current, ...added],
          added.length > 1
            ? `${added.length} documents ajoutés.`
            : `${added[0].label} ajouté.`,
        );
      }
      if (errors.length) {
        toast.error(
          errors.length > 1 ? `${errors.length} fichiers ignorés` : "Fichier ignoré",
          { description: errors.slice(0, 3).join(" ") },
        );
      }
    } finally {
      setReading(false);
    }
  }

  function addUrl() {
    const raw = getValues("sourceUrl").trim();
    if (!raw) {
      setError("sourceUrl", { type: "manual", message: "Saisissez l’adresse d’une page." });
      setFocus("sourceUrl");
      return;
    }
    const current = getValues("sources");
    const result = createUrlSource(raw, current);
    if (!result.ok) {
      setError("sourceUrl", { type: "manual", message: result.message });
      setFocus("sourceUrl");
      return;
    }
    clearErrors("sourceUrl");
    setValue("sourceUrl", "");
    commit([...current, result.source], `${result.source.label} ajoutée.`);
  }

  function remove(source: KnowledgeSource) {
    commit(
      getValues("sources").filter((item) => item.id !== source.id),
      `${source.label} retiré.`,
    );
  }

  function onDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!event.dataTransfer.types.includes("Files")) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }

  function onDragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    if (full) {
      toast.error(`${SETUP_LIMITS.sources} documents maximum pendant la configuration.`);
      return;
    }
    void addFiles(Array.from(event.dataTransfer.files));
  }

  return (
    <div className="space-y-5">
      <div
        onDragEnter={onDragEnter}
        onDragOver={(event) => {
          if (event.dataTransfer.types.includes("Files")) event.preventDefault();
        }}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        data-dragging={dragging}
        data-disabled={full}
        className={cn(
          "relative isolate overflow-hidden rounded-xl border border-dashed px-5 py-8 text-center transition-colors duration-200",
          "data-[dragging=true]:border-solid data-[dragging=true]:border-foreground data-[dragging=true]:bg-muted/60",
          "data-[disabled=true]:bg-muted/30",
        )}
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--border)_1px,transparent_1px),linear-gradient(to_bottom,var(--border)_1px,transparent_1px)] bg-size-[24px_24px] opacity-40 mask-[radial-gradient(ellipse_at_center,black,transparent_75%)]"
        />
        <m.span
          aria-hidden="true"
          animate={dragging ? { y: -4, scale: 1.06 } : { y: 0, scale: 1 }}
          transition={{ duration: 0.25, ease: EASE_OUT }}
          className="mx-auto flex size-11 items-center justify-center rounded-xl border bg-background shadow-xs"
        >
          <FileUp className="size-5" />
        </m.span>
        <p className="mt-4 text-sm font-medium">
          {full
            ? "Limite de documents atteinte"
            : dragging
              ? "Déposez pour ajouter"
              : "Glissez vos PDF ici"}
        </p>
        <p id="knowledge-files-help" className="mt-1 font-mono text-[11px] text-muted-foreground">
          PDF · {SETUP_LIMITS.pdfMaxMb} Mo max par fichier · {SETUP_LIMITS.sources} documents
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            void addFiles(files);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={full || reading}
          aria-describedby="knowledge-files-help"
          onClick={() => fileInput.current?.click()}
          className="mt-4"
        >
          <Plus data-icon="inline-start" />
          {reading ? "Vérification…" : "Choisir des fichiers"}
        </Button>
      </div>

      <Controller
        name="sourceUrl"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="knowledge-url">Ou importez une page de votre site</FieldLabel>
            <InputGroup className="h-11">
              <InputGroupAddon>
                <Globe aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                {...field}
                id="knowledge-url"
                type="url"
                inputMode="url"
                autoComplete="url"
                spellCheck={false}
                maxLength={SETUP_LIMITS.urlMaxLength}
                disabled={full}
                placeholder="https://maboutique.com/livraison"
                aria-invalid={fieldState.invalid}
                aria-describedby="knowledge-url-help"
                onChange={(event) => {
                  field.onChange(event);
                  if (fieldState.invalid) clearErrors("sourceUrl");
                }}
                onKeyDown={(event) => {
                  // Enter adds the page instead of submitting the wizard step.
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addUrl();
                  }
                }}
                className="text-base sm:text-sm"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  variant="secondary"
                  size="sm"
                  disabled={full}
                  onClick={addUrl}
                  className="h-8 px-3"
                >
                  Ajouter
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {fieldState.invalid ? (
              <FieldError id="knowledge-url-help" errors={[fieldState.error]} />
            ) : (
              <FieldDescription id="knowledge-url-help">
                Une page publique en https:// : FAQ, livraison, tarifs…
              </FieldDescription>
            )}
          </Field>
        )}
      />

      <div>
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <p id="knowledge-list-title" className="text-sm font-medium">
            Sources ajoutées
          </p>
          <p className="font-mono text-[11px] text-muted-foreground tabular-nums">
            <span className="sr-only">Documents utilisés : </span>
            {sources.length}/{SETUP_LIMITS.sources}
          </p>
        </div>

        {sources.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-4 text-xs leading-relaxed text-muted-foreground">
            Aucune source pour l’instant. Sans document, l’agent s’appuie sur la description
            de votre activité et reconnaît ce qu’il ne sait pas.
          </p>
        ) : (
          <ul aria-labelledby="knowledge-list-title" className="divide-y overflow-hidden rounded-lg border">
            <AnimatePresence initial={false}>
              {sources.map((source) => (
                <SourceRow key={source.id} source={source} onRemove={() => remove(source)} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </div>
  );
}

function SourceRow({
  source,
  onRemove,
}: {
  source: KnowledgeSource;
  onRemove: () => void;
}) {
  const [ready, setReady] = useState(false);
  const Icon = source.kind === "pdf" ? FileText : Globe;

  useEffect(() => {
    // Simulated indexing; a row remounted later resumes where it was.
    const remaining = source.addedAt + PROCESSING_MS[source.kind] - Date.now();
    const timer = setTimeout(() => setReady(true), Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [source.addedAt, source.kind]);

  return (
    <m.li
      layout="position"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      className="overflow-hidden bg-card"
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-background">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm" title={source.label}>
            {source.label}
          </p>
          <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
            <span className="shrink-0">{source.detail}</span>
            <span aria-hidden="true">·</span>
            {ready ? (
              <span className="flex items-center gap-1 text-foreground">
                <Check aria-hidden="true" className="size-3" strokeWidth={2.5} />
                Prêt
              </span>
            ) : (
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <span className="ai-thinking-shimmer shrink-0">Analyse…</span>
                <span className="relative h-0.5 max-w-24 flex-1 overflow-hidden rounded-full bg-border">
                  <span className="loading-bar absolute inset-y-0 left-0 w-1/3 rounded-full bg-foreground/60" />
                </span>
              </span>
            )}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={`Retirer ${source.label}`}
        >
          <X />
        </Button>
      </div>
    </m.li>
  );
}
