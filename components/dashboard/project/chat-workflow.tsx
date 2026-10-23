"use client";

import { useRef, useState, type ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowUp,
  CircleCheck,
  Loader2,
  Lock,
  MessageSquare,
  Plus,
  RotateCcw,
  Tag,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addContactTagAction,
  removeContactTagAction,
} from "@/app/actions/conversation-workflow";
import {
  InternalNoteContentSchema,
  MAX_NOTE_LENGTH,
  TagFormSchema,
  tagKey,
} from "@/lib/conversation-workflow-schema";
import type { ChatTag } from "@/lib/chat";
import { cn } from "@/lib/utils";

export type ComposerMode = "reply" | "note";

export function ResolveConversationButton({
  resolved,
  busy,
  onToggle,
}: {
  resolved: boolean;
  busy: boolean;
  onToggle: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={resolved ? "outline" : "default"}
          disabled={busy}
          aria-busy={busy}
          aria-label={
            resolved ? "Rouvrir la conversation" : "Marquer comme résolue"
          }
          onClick={onToggle}
        >
          {busy ? (
            <Loader2
              aria-hidden="true"
              className="animate-spin motion-reduce:animate-none"
            />
          ) : resolved ? (
            <RotateCcw aria-hidden="true" />
          ) : (
            <CircleCheck aria-hidden="true" />
          )}
          <span className="hidden lg:inline">
            {resolved ? "Rouvrir" : "Résoudre"}
          </span>
        </Button>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">
        {resolved
          ? "Remettre la conversation dans les conversations ouvertes."
          : "Classer comme traitée. Elle revient automatiquement si le client réécrit."}
      </TooltipContent>
    </Tooltip>
  );
}

function TagForm({
  existing,
  pending,
  onAdd,
  onCancel,
  suggestions = [],
}: {
  existing: ChatTag[];
  pending: boolean;
  onAdd: (name: string) => Promise<boolean>;
  onCancel: () => void;
  /** Étiquettes déjà créées dans le projet, proposées à la sélection. */
  suggestions?: Array<ChatTag & { count?: number }>;
}) {
  const form = useForm<
    z.input<typeof TagFormSchema>,
    unknown,
    z.output<typeof TagFormSchema>
  >({
    resolver: zodResolver(TagFormSchema),
    defaultValues: { name: "" },
  });
  const typed = useWatch({ control: form.control, name: "name" }) ?? "";
  const query = tagKey(typed);
  // Étiquettes du projet pas encore posées sur ce contact, filtrées par la saisie.
  const available = suggestions
    .filter((tag) => !existing.some((item) => item.id === tag.id))
    .filter((tag) => !query || tagKey(tag.name).includes(query))
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.name.localeCompare(b.name, "fr"));
  const exactMatch = available.find((tag) => tagKey(tag.name) === query);

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async ({ name }) => {
        if (existing.some((tag) => tagKey(tag.name) === tagKey(name))) {
          form.setError("name", {
            message: "Cette étiquette est déjà ajoutée.",
          });
          return;
        }
        if (await onAdd(name)) form.reset();
      })}
    >
      {suggestions.some((tag) => !existing.some((item) => item.id === tag.id)) && (
        <div className="mb-3">
          <p id="chat-existing-tags" className="mb-1.5 text-xs font-medium">
            Étiquettes existantes
          </p>
          {available.length ? (
            <ul
              aria-labelledby="chat-existing-tags"
              className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto overscroll-contain"
            >
              {available.map((tag) => (
                <li key={tag.id}>
                  <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    disabled={pending}
                    aria-label={`Ajouter l’étiquette ${tag.name}`}
                    onClick={async () => {
                      if (await onAdd(tag.name)) form.reset();
                    }}
                  >
                    <Tag aria-hidden="true" />
                    {tag.name}
                    {typeof tag.count === "number" && (
                      <span className="tabular-nums text-muted-foreground">
                        {tag.count}
                      </span>
                    )}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              Aucune étiquette existante ne correspond.
            </p>
          )}
        </div>
      )}
      <Controller
        name="name"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="gap-1.5">
            <FieldLabel htmlFor="chat-new-tag" className="text-xs">
              {suggestions.length ? "Rechercher ou créer une étiquette" : "Nouvelle étiquette"}
            </FieldLabel>
            <InputGroup className="h-8">
              <InputGroupInput
                {...field}
                id="chat-new-tag"
                autoComplete="off"
                autoFocus
                maxLength={24}
                placeholder="ex. VIP, Relance…"
                disabled={pending}
                aria-invalid={fieldState.invalid}
                aria-describedby="chat-new-tag-help"
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.stopPropagation();
                    onCancel();
                  }
                }}
                className="text-xs"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  type="submit"
                  size="xs"
                  variant="secondary"
                  disabled={pending}
                >
                  {pending && (
                    <Loader2
                      aria-hidden="true"
                      className="animate-spin motion-reduce:animate-none"
                    />
                  )}
                  {exactMatch || !query ? "Ajouter" : "Créer"}
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            <FieldDescription id="chat-new-tag-help" className="text-xs">
              2 à 24 caractères : lettres, chiffres, espaces et tirets.
            </FieldDescription>
            {fieldState.invalid && (
              <FieldError errors={[fieldState.error]} className="text-xs" />
            )}
          </Field>
        )}
      />
    </form>
  );
}

// Étiquettes du contact actif (fiche contact) : ajout et retrait validés côté serveur.
export function ContactTagsEditor({
  projectId,
  contactId,
  contactName,
  tags,
  onChanged,
  projectTags = [],
}: {
  projectId: string;
  contactId: string;
  contactName: string;
  tags: ChatTag[];
  onChanged: () => void;
  /** Étiquettes du projet, pour réutiliser une étiquette existante. */
  projectTags?: Array<ChatTag & { count: number }>;
}) {
  const [added, setAdded] = useState<ChatTag[]>([]);
  const [removed, setRemoved] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const lock = useRef(false);

  // Superposition locale jusqu'à la prochaine synchronisation du serveur.
  const display = [
    ...tags,
    ...added.filter((tag) => !tags.some((item) => item.id === tag.id)),
  ]
    .filter((tag) => !removed.includes(tag.id))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  async function add(name: string) {
    if (lock.current) return false;
    lock.current = true;
    setPending("add");
    try {
      const result = await addContactTagAction({ projectId, contactId, name });
      if (!result.success) {
        toast.error(result.error);
        return false;
      }
      setAdded((previous) => [...previous, result.tag]);
      setRemoved((previous) => previous.filter((id) => id !== result.tag.id));
      setAdding(false);
      onChanged();
      return true;
    } catch {
      toast.error("Étiquette non confirmée. Actualisez pour vérifier.");
      return false;
    } finally {
      lock.current = false;
      setPending(null);
    }
  }

  async function remove(tag: ChatTag) {
    if (lock.current) return;
    lock.current = true;
    setPending(tag.id);
    try {
      const result = await removeContactTagAction({
        projectId,
        contactId,
        tagId: tag.id,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setRemoved((previous) => [...previous, tag.id]);
      setAdded((previous) => previous.filter((item) => item.id !== tag.id));
      onChanged();
    } catch {
      toast.error("Retrait non confirmé. Actualisez pour vérifier.");
    } finally {
      lock.current = false;
      setPending(null);
    }
  }

  return (
    <section aria-labelledby={`tags-${contactId}`}>
      <h2
        id={`tags-${contactId}`}
        className="font-mono text-[11px] font-normal uppercase tracking-wider text-muted-foreground"
      >
        Étiquettes
      </h2>
      <p className="mb-2 mt-1 text-xs text-muted-foreground">
        Classez vos contacts pour les retrouver et les filtrer. Visible
        uniquement par votre équipe.
      </p>
      <ul
        aria-label={`Étiquettes de ${contactName}`}
        className="flex flex-wrap gap-1.5"
      >
        {display.map((tag) => (
          <li
            key={tag.id}
            className="inline-flex items-center gap-0.5 rounded-md border bg-background py-0.5 pl-2 pr-0.5 text-xs"
          >
            {tag.name}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="size-5"
              disabled={pending !== null}
              aria-label={`Retirer l’étiquette ${tag.name}`}
              onClick={() => void remove(tag)}
            >
              {pending === tag.id ? (
                <Loader2
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <X aria-hidden="true" />
              )}
            </Button>
          </li>
        ))}
        {!adding && (
          <li>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              disabled={pending !== null}
              onClick={() => setAdding(true)}
            >
              <Plus aria-hidden="true" />
              Ajouter
            </Button>
          </li>
        )}
      </ul>
      {adding && (
        <div className="mt-2">
          <TagForm
            existing={display}
            suggestions={projectTags}
            pending={pending === "add"}
            onAdd={add}
            onCancel={() => setAdding(false)}
          />
        </div>
      )}
    </section>
  );
}

const ALL_TAGS = "__all";

export function TagFilter({
  tags,
  value,
  onChange,
}: {
  tags: Array<ChatTag & { count: number }>;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  if (!tags.length && !value) return null;
  return (
    <Select
      value={value ?? ALL_TAGS}
      onValueChange={(next) => onChange(next === ALL_TAGS ? null : next)}
    >
      <SelectTrigger
        size="sm"
        aria-label="Filtrer par étiquette"
        className="h-7 w-full text-xs"
      >
        <Tag aria-hidden="true" className="size-3.5 text-muted-foreground" />
        <SelectValue placeholder="Toutes les étiquettes" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_TAGS}>Toutes les étiquettes</SelectItem>
        {tags.map((tag) => (
          <SelectItem key={tag.id} value={tag.id}>
            {tag.name}
            <span className="ml-1 text-muted-foreground tabular-nums">
              {tag.count}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ComposerModeToggle({
  mode,
  onChange,
  hint,
  showReply = true,
  onNoteClose,
  extra,
}: {
  /** Action supplémentaire placée juste après « Note interne » (ex. Résumé IA). */
  extra?: ReactNode;
  /**
   * Fermeture de la note par un second clic. Distincte de « Répondre » pour ne
   * pas mettre l’IA en pause en refermant simplement une note.
   */
  onNoteClose?: () => void;
  mode: ComposerMode;
  onChange: (mode: ComposerMode) => void;
  /** Short contextual hint shown on the right (e.g. AI takeover). */
  hint?: string;
  /**
   * « Répondre » sert à reprendre la main sur l’IA. Quand elle est déjà
   * désactivée, il est masqué et « Note interne » devient une bascule.
   */
  showReply?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label="Type de message"
      className="flex min-w-0 flex-1 items-center gap-1"
    >
      {showReply && (
        <Button
          type="button"
          size="xs"
          variant={mode === "reply" ? "secondary" : "ghost"}
          aria-pressed={mode === "reply"}
          onClick={() => onChange("reply")}
        >
          <MessageSquare aria-hidden="true" />
          Répondre
        </Button>
      )}
      <Button
        type="button"
        size="xs"
        variant={mode === "note" ? "secondary" : "ghost"}
        aria-pressed={mode === "note"}
        // Bascule : un clic ouvre la note interne, un second la referme.
        onClick={() => {
          if (mode !== "note") onChange("note");
          else if (onNoteClose) onNoteClose();
          else onChange("reply");
        }}
      >
        <Lock aria-hidden="true" />
        Note interne
      </Button>
      {extra}
      {hint && (
        <span className="ml-auto hidden min-w-0 truncate pr-1.5 text-[11px] text-muted-foreground sm:inline">
          {hint}
        </span>
      )}
    </div>
  );
}

const NoteFormSchema = z.object({ content: InternalNoteContentSchema });

export function InternalNoteComposer({
  contactName,
  draft,
  onDraftChange,
  onSubmit,
  header,
}: {
  contactName: string;
  /** Barre affichée en haut de la carte (ex. bascule Répondre / Note interne). */
  header?: ReactNode;
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: (content: string) => Promise<boolean>;
}) {
  const [saving, setSaving] = useState(false);
  const form = useForm<z.infer<typeof NoteFormSchema>>({
    resolver: zodResolver(NoteFormSchema),
    defaultValues: { content: "" },
    values: { content: draft },
  });

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async ({ content }) => {
        if (saving) return;
        setSaving(true);
        try {
          if (await onSubmit(content)) onDraftChange("");
        } finally {
          setSaving(false);
        }
      })}
    >
      <Controller
        name="content"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="gap-1.5">
            <FieldLabel htmlFor="chat-internal-note" className="sr-only">
              Note interne sur {contactName}
            </FieldLabel>
            <InputGroup
              className={cn(
                "rounded-xl border-dashed border-foreground/40 bg-muted/50",
              )}
            >
              {header && (
                <InputGroupAddon
                  align="block-start"
                  className="gap-1 border-b border-dashed border-foreground/20 px-1.5 py-1.5"
                >
                  {header}
                </InputGroupAddon>
              )}
              <InputGroupTextarea
                {...field}
                id="chat-internal-note"
                rows={1}
                autoFocus
                maxLength={MAX_NOTE_LENGTH}
                autoComplete="off"
                disabled={saving}
                aria-invalid={fieldState.invalid}
                aria-describedby="chat-internal-note-help"
                placeholder="Visible uniquement par votre équipe…"
                className="max-h-40 min-h-11 px-3"
                onChange={(event) => {
                  field.onChange(event);
                  onDraftChange(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    (event.ctrlKey || event.metaKey) &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }
                }}
              />
              <InputGroupAddon align="block-end" className="gap-2">
                <span
                  id="chat-internal-note-help"
                  className="flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground"
                >
                  <Lock aria-hidden="true" className="size-3 shrink-0" />
                  <span className="truncate">
                    Jamais envoyée à {contactName} ni lue par l’IA
                  </span>
                </span>
                <InputGroupButton
                  type="submit"
                  size="icon-sm"
                  variant="default"
                  className="ml-auto rounded-full"
                  disabled={saving || !draft.trim()}
                  aria-label={
                    saving ? "Ajout de la note en cours" : "Ajouter la note"
                  }
                  title="Ajouter · Ctrl / ⌘ + Entrée"
                >
                  {saving ? (
                    <Loader2
                      aria-hidden="true"
                      className="animate-spin motion-reduce:animate-none"
                    />
                  ) : (
                    <ArrowUp aria-hidden="true" />
                  )}
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
