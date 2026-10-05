"use client";

import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowUp,
  ChevronDown,
  Loader2,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { assistWriting } from "@/app/actions/assistWriting";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { MessageContentSchema } from "@/lib/message-schema";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { ChatEmojiPicker } from "./chat-emoji-picker";

const ComposerSchema = z.object({ content: MessageContentSchema });
type ComposerValues = z.infer<typeof ComposerSchema>;

export function ChatComposer({
  draft,
  contactName,
  isSending,
  textareaRef,
  onDraftChange,
  onSend,
  projectId,
  contactId,
  assistanceEnabled,
  contextVersion,
  hasClientMessage,
}: {
  projectId: string;
  contactId: string;
  assistanceEnabled: boolean;
  contextVersion: string;
  hasClientMessage: boolean;
  draft: string;
  contactName: string;
  isSending: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onDraftChange: (value: string) => void;
  onSend: (content: string) => Promise<void>;
}) {
  const form = useForm<ComposerValues>({
    resolver: zodResolver(ComposerSchema),
    defaultValues: { content: "" },
    values: { content: draft },
  });
  const [busy, setBusy] = useState<"suggest" | "rewrite" | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [proposal, setProposal] = useState<{
    mode: "suggest" | "rewrite";
    replies: string[];
    draft: string;
  } | null>(null);
  const requestId = useRef(0);
  const requestLock = useRef(false);
  useEffect(() => {
    requestId.current += 1;
    requestLock.current = false;
    setBusy(null);
    setProposal(null);
    setExpanded(false);
    return () => {
      requestId.current += 1;
    };
  }, [contactId, assistanceEnabled, contextVersion, isSending]);

  const generatePreview = useEffectEvent(() => {
    void requestAssistance("suggest", true);
  });
  useEffect(() => {
    if (!assistanceEnabled || !hasClientMessage || isSending) return;
    const timer = setTimeout(() => generatePreview(), 800);
    return () => clearTimeout(timer);
  }, [
    contactId,
    assistanceEnabled,
    contextVersion,
    hasClientMessage,
    isSending,
  ]);

  async function requestAssistance(
    mode: "suggest" | "rewrite",
    automatic = false,
  ) {
    if (requestLock.current || isSending || !assistanceEnabled) return;
    requestLock.current = true;
    const id = ++requestId.current;
    setBusy(mode);
    setProposal(null);
    if (!automatic) setExpanded(true);
    try {
      const result = await assistWriting({
        projectId,
        contactId,
        mode,
        ...(mode === "rewrite" ? { draft } : {}),
      });
      if (id !== requestId.current) return;
      if (!result.success) {
        if (!automatic) toast.error(result.error);
        return;
      }
      setProposal({ mode, replies: result.replies, draft });
    } catch {
      if (id === requestId.current && !automatic)
        toast.error("L’assistance IA est indisponible. Réessayez.");
    } finally {
      if (id === requestId.current) {
        requestLock.current = false;
        setBusy(null);
      }
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(({ content }) => onSend(content))}
      noValidate
    >
      {assistanceEnabled && (
        <section
          aria-label="Assistance à la rédaction"
          className="mb-2 space-y-2"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full min-w-0 justify-start"
            aria-expanded={expanded}
            aria-controls="chat-ai-proposals"
            disabled={!!busy || isSending || !hasClientMessage}
            onClick={() =>
              proposal?.mode === "suggest"
                ? setExpanded(!expanded)
                : void requestAssistance("suggest")
            }
          >
            {busy === "suggest" ? (
              <Loader2
                aria-hidden="true"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
            ) : (
              <Sparkles aria-hidden="true" className="size-4" />
            )}
            {busy === "suggest" ? "Suggestions en cours…" : "Suggestions IA"}
            <ChevronDown
              aria-hidden="true"
              className={`size-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
            <span className="min-w-0 truncate text-xs font-normal text-muted-foreground">
              {proposal?.mode === "suggest"
                ? proposal.replies[0]
                : busy === "suggest"
                  ? "Analyse de la discussion…"
                  : "Afficher des réponses adaptées…"}
            </span>
          </Button>
          <div id="chat-ai-proposals" aria-live="polite" aria-busy={!!busy}>
            {expanded &&
              proposal &&
              (proposal.mode === "suggest" || proposal.draft === draft) && (
                <div className="max-h-60 space-y-2 overflow-y-auto rounded-lg border bg-muted p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      {proposal.mode === "rewrite"
                        ? "Reformulation professionnelle"
                        : "Réponses suggérées"}{" "}
                      · À relire avant envoi
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Fermer les propositions"
                      onClick={() => setExpanded(false)}
                    >
                      <X aria-hidden="true" className="size-4" />
                    </Button>
                  </div>
                  {proposal.replies.map((reply, index) => (
                    <div key={index} className="space-y-2 border-t pt-2">
                      <p
                        dir="auto"
                        className="whitespace-pre-wrap wrap-anywhere text-sm"
                      >
                        {reply}
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isSending}
                        onClick={() => {
                          form.setValue("content", reply, {
                            shouldValidate: true,
                          });
                          onDraftChange(reply);
                          setProposal(null);
                          textareaRef.current?.focus();
                        }}
                      >
                        {draft.trim()
                          ? "Remplacer le brouillon"
                          : "Insérer dans le brouillon"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </section>
      )}
      <FieldGroup>
        <Controller
          name="content"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="gap-2">
              <FieldLabel htmlFor="chat-message" className="sr-only">
                Message pour {contactName}
              </FieldLabel>
              <div className="flex items-end gap-2 rounded-xl border border-input bg-background p-2 shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/50">
                <ChatEmojiPicker
                  draft={field.value}
                  textareaRef={textareaRef}
                  disabled={isSending}
                  onChange={(value) => {
                    field.onChange(value);
                    onDraftChange(value);
                  }}
                />
                {assistanceEnabled && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-11 shrink-0"
                        aria-label="Reformuler avec l’IA"
                        disabled={
                          !!busy ||
                          isSending ||
                          !draft.trim() ||
                          draft.trim().length > 6000
                        }
                        onClick={() => void requestAssistance("rewrite")}
                      >
                        {busy === "rewrite" ? (
                          <Loader2
                            aria-hidden="true"
                            className="size-4 animate-spin motion-reduce:animate-none"
                          />
                        ) : (
                          <WandSparkles aria-hidden="true" className="size-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {draft.trim().length > 6000
                        ? "Reformulation limitée à 6 000 caractères"
                        : "Reformuler avec l’IA"}
                    </TooltipContent>
                  </Tooltip>
                )}
                <Textarea
                  {...field}
                  ref={(element) => {
                    field.ref(element);
                    textareaRef.current = element;
                  }}
                  id="chat-message"
                  rows={1}
                  autoComplete="off"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid
                      ? "chat-composer-help chat-composer-error"
                      : "chat-composer-help"
                  }
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
                  placeholder="Écrire un message…"
                  className="min-h-11 min-w-0 max-h-40 flex-1 resize-none rounded-none border-0 bg-transparent px-2 py-3 shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
                <Tooltip>
                  <TooltipTrigger asChild className="cursor-pointer">
                    <Button
                      type="submit"
                      size="icon"
                      disabled={!draft.trim() || isSending}
                      aria-label={
                        isSending ? "Envoi en cours" : "Envoyer le message"
                      }
                      title="Envoyer · Ctrl / ⌘ + Entrée"
                      className="my-1 size-9 shrink-0 rounded-full"
                    >
                      {isSending ? (
                        <Loader2
                          aria-hidden="true"
                          className="size-4 animate-spin motion-reduce:animate-none"
                        />
                      ) : (
                        <ArrowUp aria-hidden="true" className="size-5" />
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Envoyer · Ctrl / ⌘ + Entrée</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p id="chat-composer-help" className="sr-only">
                Entrée pour une nouvelle ligne. Ctrl ou Commande et Entrée pour
                envoyer.
              </p>
              {fieldState.invalid && (
                <FieldError
                  id="chat-composer-error"
                  errors={[fieldState.error]}
                />
              )}
            </Field>
          )}
        />
      </FieldGroup>
    </form>
  );
}
