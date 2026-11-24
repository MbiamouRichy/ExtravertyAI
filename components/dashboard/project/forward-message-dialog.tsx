"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileText, Forward, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";

import { getInitials } from "@/components/getInitials";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  forwardMessageAction,
  searchForwardTargetsAction,
} from "@/app/actions/message-forwarding";
import {
  FORWARD_LIMITS,
  ForwardFormSchema,
  type ForwardFormValues,
  type ForwardTarget,
} from "@/lib/message-forwarding-shared";
import { formatScheduleDate } from "@/lib/scheduled-messages-shared";
import type { ChatMessage } from "@/lib/chat";
import { cn } from "@/lib/utils";

const MEDIA_LABEL: Record<string, string> = {
  IMAGE: "Image",
  AUDIO: "Audio",
  VIDEO: "Vidéo",
  DOCUMENT: "Document",
};

/** Le message peut-il être transféré ? Le serveur revérifie (fichier conservé, statut). */
export function canForwardMessage(message: {
  id: string;
  senderType: ChatMessage["senderType"];
  type?: string;
  status: string;
}) {
  if (message.id.startsWith("local-") || !["pending", "sent", "delivered", "read"].includes(message.status))
    return false;
  if (message.senderType === "agent") return true;
  if (message.senderType === "client" || message.senderType === "bot")
    return !message.type || message.type === "TEXT";
  return false;
}

export function ForwardMessageDialog({
  projectId,
  sourceContactId,
  message,
  author,
  timeZone,
  onOpenChange,
  onForwarded,
}: {
  projectId: string;
  sourceContactId: string;
  /** Message à transférer ; null : fenêtre fermée. */
  message: ChatMessage | null;
  author: string;
  timeZone: string;
  onOpenChange: (open: boolean) => void;
  onForwarded: () => void;
}) {
  const id = useId();
  const open = !!message;
  const [query, setQuery] = useState("");
  // Les conversations cochées restent affichées même hors des résultats de recherche.
  const [known, setKnown] = useState<Record<string, ForwardTarget>>({});
  // Dernier résultat reçu, rattaché à la recherche qui l'a produit.
  const [loaded, setLoaded] = useState<{ key: string; targets: ForwardTarget[]; error: string } | null>(null);
  const [openedFor, setOpenedFor] = useState<string | null>(null);
  // Une demande par ouverture : un nouvel essai après une coupure ne double rien.
  const requestId = useRef<string | null>(null);
  const search = useRef(0);

  const form = useForm<ForwardFormValues>({
    resolver: zodResolver(ForwardFormSchema),
    defaultValues: { contactIds: [] },
  });

  // Chaque ouverture repart de zéro : nouvelle demande, aucune sélection.
  if ((message?.id ?? null) !== openedFor) {
    setOpenedFor(message?.id ?? null);
    setQuery("");
    setKnown({});
  }
  useEffect(() => {
    if (!open) return;
    form.reset({ contactIds: [] });
    requestId.current = null;
  }, [open, message?.id, form]);

  const searchKey = `${message?.id ?? ""}|${query}`;
  const state = loaded?.key !== searchKey ? "loading" : loaded.error ? "error" : "ready";
  const targets = loaded?.targets ?? [];
  const loadError = loaded?.error ?? "";

  useEffect(() => {
    if (!open) return;
    const current = ++search.current;
    const timer = setTimeout(async () => {
      try {
        const result = await searchForwardTargetsAction({
          projectId,
          excludeContactId: sourceContactId,
          query,
        });
        if (current !== search.current) return;
        setLoaded(
          result.success
            ? { key: searchKey, targets: result.targets, error: "" }
            : { key: searchKey, targets: [], error: result.error },
        );
      } catch {
        if (current !== search.current) return;
        setLoaded({
          key: searchKey,
          targets: [],
          error: "Impossible de charger les conversations. Vérifiez votre connexion.",
        });
      }
    }, query ? 250 : 0);
    return () => clearTimeout(timer);
  }, [open, query, searchKey, projectId, sourceContactId]);

  const submitting = form.formState.isSubmitting;
  const selected = useWatch({ control: form.control, name: "contactIds" });

  async function submit(values: ForwardFormValues) {
    if (!message) return;
    try {
      const result = await forwardMessageAction({
        projectId,
        messageId: message.id,
        requestId: (requestId.current ??= crypto.randomUUID()),
        contactIds: values.contactIds,
      });
      if (!result.success) {
        form.setError("contactIds", { message: result.error });
        toast.error(result.error);
        return;
      }
      toast.success(
        result.forwarded === 1
          ? "Message transféré à 1 conversation."
          : `Message transféré à ${result.forwarded} conversations.`,
      );
      onForwarded();
      onOpenChange(false);
    } catch {
      toast.error("Transfert non confirmé. Vérifiez votre connexion et réessayez.");
    }
  }

  const media = message?.type && message.type !== "TEXT" ? MEDIA_LABEL[message.type] : null;
  const caption = message && !/^\[[A-Z]+\]$/.test(message.content) ? message.content : "";

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      {/* minmax(0,1fr) : un contenu insécable n'élargit plus la fenêtre ; pr-8 :
          le titre ne passe plus sous la croix de fermeture. */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] gap-5 overflow-x-hidden overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-8">Transférer le message</DialogTitle>
          <DialogDescription>
            Envoyé en votre nom dans chaque conversation choisie, {FORWARD_LIMITS.maxTargets} au plus.
            WhatsApp n’accepte un message que dans les 24 h qui suivent le dernier message du client.
          </DialogDescription>
        </DialogHeader>

        {message && (
          <figure className="rounded-lg border bg-muted/50 px-3 py-2">
            <figcaption className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Forward aria-hidden="true" className="size-3" />
              {author}
            </figcaption>
            {media && (
              <p className="mt-1 flex items-center gap-1.5 text-xs font-medium">
                <FileText aria-hidden="true" className="size-3.5" />
                {media}
              </p>
            )}
            {caption && (
              <p dir="auto" className="mt-1 line-clamp-3 whitespace-pre-wrap text-sm wrap-anywhere">
                {caption}
              </p>
            )}
          </figure>
        )}

        <form id={`${id}-form`} noValidate onSubmit={(event) => void form.handleSubmit(submit)(event)}>
          <Controller
            name="contactIds"
            control={form.control}
            render={({ field, fieldState }) => {
              const toggle = (target: ForwardTarget, checked: boolean) => {
                if (checked) setKnown((previous) => ({ ...previous, [target.id]: target }));
                field.onChange(
                  checked
                    ? [...field.value, target.id]
                    : field.value.filter((value) => value !== target.id),
                );
                if (fieldState.invalid) void form.trigger("contactIds");
              };
              const full = field.value.length >= FORWARD_LIMITS.maxTargets;
              return (
                <FieldSet data-invalid={fieldState.invalid} className="gap-3">
                  <FieldLegend variant="label">Conversations</FieldLegend>
                  <InputGroup>
                    <InputGroupAddon>
                      <Search aria-hidden="true" />
                    </InputGroupAddon>
                    <InputGroupInput
                      type="search"
                      aria-label="Rechercher une conversation par nom"
                      placeholder="Nom du client"
                      autoComplete="off"
                      value={query}
                      maxLength={100}
                      disabled={submitting}
                      onChange={(event) => setQuery(event.target.value)}
                    />
                  </InputGroup>

                  {field.value.length > 0 && (
                    <ul aria-label="Conversations choisies" className="flex flex-wrap gap-1.5">
                      {field.value.map((value) => {
                        const target = known[value];
                        return (
                          <li key={value}>
                            <Button
                              type="button"
                              size="xs"
                              variant="secondary"
                              disabled={submitting}
                              aria-label={`Retirer ${target?.name ?? "cette conversation"}`}
                              onClick={() => target && toggle(target, false)}
                            >
                              {target?.name ?? "Conversation"}
                              <X aria-hidden="true" />
                            </Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  <div
                    aria-busy={state === "loading"}
                    className="max-h-72 min-h-32 overflow-y-auto rounded-lg border"
                  >
                    {state === "loading" && !targets.length ? (
                      <ul aria-hidden="true" className="divide-y">
                        {[0, 1, 2].map((row) => (
                          <li key={row} className="flex items-center gap-3 px-3 py-2.5">
                            <span className="size-4 rounded bg-muted" />
                            <span className="size-8 animate-pulse rounded-full bg-muted motion-reduce:animate-none" />
                            <span className="h-3 w-32 animate-pulse rounded bg-muted motion-reduce:animate-none" />
                          </li>
                        ))}
                      </ul>
                    ) : state === "error" ? (
                      <p role="alert" className="px-3 py-6 text-center text-sm text-destructive">
                        {loadError}
                      </p>
                    ) : !targets.length ? (
                      <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                        {query ? "Aucune conversation ne correspond à cette recherche." : "Aucune autre conversation dans ce projet."}
                      </p>
                    ) : (
                      <ul className="divide-y">
                        {targets.map((target) => {
                          const checked = field.value.includes(target.id);
                          const closed = !target.windowClosesAt;
                          const disabled = submitting || closed || (full && !checked);
                          const inputId = `${id}-target-${target.id}`;
                          return (
                            <li key={target.id}>
                              <Field
                                orientation="horizontal"
                                data-disabled={disabled || undefined}
                                className={cn(
                                  "items-center gap-3 px-3 py-2.5",
                                  !disabled && "hover:bg-muted/50",
                                )}
                              >
                                <Checkbox
                                  id={inputId}
                                  checked={checked}
                                  disabled={disabled}
                                  aria-invalid={fieldState.invalid}
                                  aria-describedby={`${inputId}-hint`}
                                  onCheckedChange={(value) => toggle(target, value === true)}
                                />
                                <Avatar size="sm" className="shrink-0">
                                  <AvatarImage src={target.avatarUrl ?? undefined} alt="" />
                                  <AvatarFallback className="text-[9px] font-semibold">
                                    {getInitials(target.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <FieldLabel
                                  htmlFor={inputId}
                                  className={cn(
                                    "min-w-0 flex-1 flex-col items-start gap-0.5 font-normal",
                                    disabled ? "cursor-not-allowed" : "cursor-pointer",
                                  )}
                                >
                                  <span className="w-full truncate text-sm font-medium">{target.name}</span>
                                  <span id={`${inputId}-hint`} className="text-xs text-muted-foreground">
                                    {closed
                                      ? "Fenêtre de 24 h fermée : le client n’a pas écrit récemment"
                                      : `Joignable jusqu’à ${formatScheduleDate(target.windowClosesAt!, timeZone)}`}
                                  </span>
                                </FieldLabel>
                              </Field>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </FieldSet>
              );
            }}
          />
        </form>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={submitting}>
              Annuler
            </Button>
          </DialogClose>
          <Button type="submit" form={`${id}-form`} disabled={submitting || !selected.length}>
            {submitting ? (
              <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Forward aria-hidden="true" />
            )}
            {selected.length > 1 ? `Transférer à ${selected.length} conversations` : "Transférer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
