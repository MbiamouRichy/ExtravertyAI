"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  CalendarDays,
  Copy,
  Download,
  Link2,
  MessagesSquare,
  Plus,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";

import { statusLabel, type Conversation } from "./data";
import { AgentStack, ContactAvatar, InstinctBadge } from "./shared";

const statusHint: Record<Conversation["status"], string> = {
  pending: "L’IA a transmis la main : un membre de l’équipe doit répondre.",
  ai: "L’assistant répond seul à ce contact.",
  human: "Un membre de l’équipe gère la conversation, l’IA est en pause.",
  resolved: "Conversation traitée. Elle redeviendra active si le client réécrit.",
};

const tagSchema = z.object({
  tag: z
    .string()
    .trim()
    .min(2, "2 caractères minimum.")
    .max(24, "24 caractères maximum.")
    .regex(/^[\p{L}\p{N} '’-]+$/u, "Lettres, chiffres et tirets uniquement."),
});

function TagForm({
  existing,
  onAdd,
  onDone,
}: {
  existing: string[];
  onAdd: (tag: string) => void;
  onDone: () => void;
}) {
  const form = useForm<z.infer<typeof tagSchema>>({
    resolver: zodResolver(tagSchema),
    defaultValues: { tag: "" },
  });

  function submit({ tag }: z.infer<typeof tagSchema>) {
    const value = tag.trim();
    if (existing.some((item) => item.toLocaleLowerCase("fr") === value.toLocaleLowerCase("fr"))) {
      form.setError("tag", { message: "Cette étiquette existe déjà." });
      return;
    }
    onAdd(value);
    form.reset();
    onDone();
  }

  return (
    <form noValidate onSubmit={form.handleSubmit(submit)} className="mt-2">
      <Controller
        name="tag"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="gap-1.5">
            <FieldLabel htmlFor="new-tag" className="sr-only">
              Nouvelle étiquette
            </FieldLabel>
            <InputGroup className="h-8">
              <InputGroupInput
                {...field}
                id="new-tag"
                autoFocus
                autoComplete="off"
                maxLength={24}
                placeholder="ex. VIP, Livraison…"
                aria-invalid={fieldState.invalid}
                onKeyDown={(event) => {
                  if (event.key === "Escape") onDone();
                }}
                className="text-xs"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupButton type="submit" size="xs" variant="secondary">
                  Ajouter
                </InputGroupButton>
              </InputGroupAddon>
            </InputGroup>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} className="text-xs" />}
          </Field>
        )}
      />
    </form>
  );
}

export function ContactPanel({
  conversation,
  onAddTag,
  onRemoveTag,
}: {
  conversation: Conversation;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}) {
  const [refreshing, setRefreshing] = useState(false);
  const [adding, setAdding] = useState(false);

  async function regenerate() {
    setRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1200));
    setRefreshing(false);
    toast.success("Résumé mis à jour");
  }

  const details = [
    { icon: CalendarDays, label: "Premier contact", value: conversation.firstContact },
    { icon: MessagesSquare, label: "Messages", value: String(conversation.messages.length) },
    { icon: Link2, label: "Source", value: conversation.source },
  ];

  return (
    <div className="flex flex-col gap-6 p-5">
      <div className="flex flex-col items-center text-center">
        <ContactAvatar name={conversation.name} size="lg" className="size-16 text-lg" />
        <p className="mt-3 font-heading text-lg font-semibold">{conversation.name}</p>
        <button
          type="button"
          onClick={() => toast("Maquette : numéro masqué non copié")}
          className="mt-0.5 inline-flex items-center gap-1.5 rounded text-xs text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {conversation.phone}
          <Copy aria-hidden="true" className="size-3" />
          <span className="sr-only">Copier le numéro</span>
        </button>
      </div>

      <section aria-labelledby="statut" className="space-y-3 rounded-xl border p-4">
        <div>
          <h2 id="statut" className="font-mono text-[11px] font-normal uppercase tracking-wider text-muted-foreground">
            Statut · {statusLabel[conversation.status]}
          </h2>
          <p className="mt-1 text-xs leading-relaxed">{statusHint[conversation.status]}</p>
        </div>
        <div className="border-t pt-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">Instinct IA</p>
          <InstinctBadge instinct={conversation.instinct} variant="full" className="mt-1.5" />
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Recalculé après chaque nouveau message, selon les objectifs de votre agent.
          </p>
        </div>
        {conversation.agents.length > 0 && (
          <div className="flex items-center justify-between border-t pt-3 text-xs">
            <span className="text-muted-foreground">Suivie par</span>
            <span className="flex items-center gap-2">
              <AgentStack agents={conversation.agents} />
              {conversation.agents.map((agent) => agent.name.split(" ")[0]).join(", ")}
            </span>
          </div>
        )}
      </section>

      <section aria-labelledby="resume-ia" className="rounded-xl border bg-muted/40 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="resume-ia" className="flex items-center gap-1.5 font-heading text-sm font-semibold tracking-normal">
            <Sparkles aria-hidden="true" className="size-3.5" />
            Résumé IA
          </h2>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={regenerate}
            disabled={refreshing}
            aria-label="Régénérer le résumé"
          >
            <RefreshCw className={refreshing ? "motion-safe:animate-spin" : undefined} />
          </Button>
        </div>
        <div aria-live="polite" aria-busy={refreshing}>
          {refreshing ? (
            <div className="space-y-2 py-1">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ) : (
            <ul className="space-y-1.5">
              {conversation.summary.map((line) => (
                <li key={line} className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                  <span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-full bg-foreground/60" />
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section aria-labelledby="etiquettes">
        <h2 id="etiquettes" className="font-mono text-[11px] font-normal uppercase tracking-wider text-muted-foreground">
          Étiquettes
        </h2>
        <p className="mb-2 mt-1 text-xs text-muted-foreground">
          Classez vos contacts pour les retrouver et les filtrer.
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {conversation.tags.map((tag) => (
            <li
              key={tag}
              className="inline-flex items-center gap-0.5 rounded-md border bg-background py-0.5 pl-2 pr-0.5 text-xs"
            >
              {tag}
              <Button
                variant="ghost"
                size="icon-xs"
                className="size-5"
                aria-label={`Retirer l’étiquette ${tag}`}
                onClick={() => onRemoveTag(tag)}
              >
                <X />
              </Button>
            </li>
          ))}
          {!adding && (
            <li>
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground"
                onClick={() => setAdding(true)}
              >
                <Plus />
                Ajouter
              </Button>
            </li>
          )}
        </ul>
        {adding && (
          <TagForm existing={conversation.tags} onAdd={onAddTag} onDone={() => setAdding(false)} />
        )}
      </section>

      <section aria-labelledby="details">
        <h2 id="details" className="mb-2 font-mono text-[11px] font-normal uppercase tracking-wider text-muted-foreground">
          Détails
        </h2>
        <dl className="divide-y rounded-xl border">
          {details.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
              <dt className="flex items-center gap-2 text-muted-foreground">
                <Icon aria-hidden="true" className="size-3.5" />
                {label}
              </dt>
              <dd className="truncate text-right">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Button variant="outline" size="sm" onClick={() => toast("Maquette : export simulé")}>
        <Download />
        Exporter la conversation
      </Button>
    </div>
  );
}
