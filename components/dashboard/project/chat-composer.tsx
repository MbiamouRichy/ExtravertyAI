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
  Paperclip,
  Mic,
  Square,
  ChevronDown,
  Loader2,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
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
import { SendChatMessageSchema } from "@/lib/message-schema";
import {
  type ChatAttachment,
  MEDIA_TYPES,
  mediaFileError,
  mediaMimeForFile,
} from "@/lib/chat-media";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { AudioPlayer } from "./audio-player";
import { ChatEmojiPicker } from "./chat-emoji-picker";

const ComposerSchema = SendChatMessageSchema;
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
  onSend: (
    content: string,
    attachment?: ChatAttachment,
  ) => Promise<"accepted" | "uncertain" | void>;
}) {
  const [attachment, setAttachment] = useState<ChatAttachment | undefined>();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const uploadController = useRef<AbortController | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => uploadController.current?.abort(), []);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  async function uploadFile(selected: File | undefined) {
    if (!selected) return;
    const error = mediaFileError(selected);
    if (error) {
      setAttachment(undefined);
      setFile(null);
      form.setError("attachment", { message: error });
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    selected = new File([selected], selected.name, {
      type: mediaMimeForFile(selected),
    });
    uploadController.current?.abort();
    const controller = new AbortController();
    uploadController.current = controller;
    setAttachment(undefined);
    setFile(selected);
    setUploading(true);
    form.clearErrors("attachment");
    try {
      const response = await fetch(
        "/api/projects/" +
          encodeURIComponent(projectId) +
          "/chat/media?requestId=" +
          crypto.randomUUID(),
        {
          method: "POST",
          headers: {
            "Content-Type": mediaMimeForFile(selected),
            "X-File-Name": encodeURIComponent(selected.name),
          },
          body: selected,
          signal: controller.signal,
        },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          typeof data.error === "string"
            ? data.error
            : "Import du fichier impossible.",
        );
      const parsed = z
        .object({
          token: z.string(),
          type: z.enum(["IMAGE", "AUDIO", "VIDEO", "DOCUMENT"]),
          requestId: z.string().uuid(),
        })
        .parse(data);
      if (!controller.signal.aborted) setAttachment(parsed);
    } catch (error) {
      if (!controller.signal.aborted) {
        const message =
          error instanceof Error
            ? error.message
            : "Import du fichier impossible.";
        form.setError("attachment", { message });
        toast.error(message);
        setFile(null);
        if (fileRef.current) fileRef.current.value = "";
      }
    } finally {
      if (!controller.signal.aborted) setUploading(false);
    }
  }
  const audioRecorder = useAudioRecorder(
    (recorded) => void uploadFile(recorded),
    contactId,
  );
  const audioMode =
    audioRecorder.recording ||
    audioRecorder.preparing ||
    !!file?.type.startsWith("audio/") ||
    attachment?.type === "AUDIO";
  const recordingMode = audioRecorder.recording || audioRecorder.preparing;
  const [scrollEdges, setScrollEdges] = useState({ top: false, bottom: false });
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const updateEdges = () => {
      const top = textarea.scrollTop > 1;
      const bottom =
        textarea.scrollHeight - textarea.clientHeight - textarea.scrollTop > 1;
      setScrollEdges((previous) =>
        previous.top === top && previous.bottom === bottom
          ? previous
          : { top, bottom },
      );
    };
    const frame = requestAnimationFrame(updateEdges);
    const observer = new ResizeObserver(updateEdges);
    observer.observe(textarea);
    textarea.addEventListener("scroll", updateEdges, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      textarea.removeEventListener("scroll", updateEdges);
    };
  }, [draft, contactId, textareaRef, audioMode]);
  const form = useForm<ComposerValues>({
    resolver: zodResolver(ComposerSchema),
    defaultValues: { content: "", attachment: undefined },
    values: { content: audioMode ? "" : draft, attachment },
  });
  useEffect(() => {
    uploadController.current?.abort();
    setAttachment(undefined);
    setFile(null);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }, [contactId]);
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
  }, [contactId, assistanceEnabled, contextVersion, isSending, audioMode]);

  const generatePreview = useEffectEvent(() => {
    void requestAssistance("suggest", true);
  });
  useEffect(() => {
    if (!assistanceEnabled || !hasClientMessage || isSending || audioMode)
      return;
    const timer = setTimeout(() => generatePreview(), 800);
    return () => clearTimeout(timer);
  }, [
    contactId,
    assistanceEnabled,
    contextVersion,
    hasClientMessage,
    isSending,
    audioMode,
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
      className="relative min-w-0"
      onSubmit={form.handleSubmit(async ({ content, attachment: media }) => {
        if (
          uploading ||
          isSending ||
          audioRecorder.recording ||
          audioRecorder.preparing
        )
          return;
        const preservedDraft = draft;
        const result = await onSend(
          media?.type === "AUDIO" ? "" : content,
          media,
        );
        if (
          media?.type === "AUDIO" &&
          (result === "accepted" || result === "uncertain")
        )
          onDraftChange(preservedDraft);
        if (result === "accepted" || result === "uncertain") {
          setAttachment(undefined);
          setFile(null);
          if (fileRef.current) fileRef.current.value = "";
        }
      })}
      noValidate
    >
      {assistanceEnabled && !audioMode && (
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
      {(audioRecorder.recording || audioRecorder.preparing) && (
        <div className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
          <p
            role="status"
            className="flex items-center gap-3 text-sm font-medium tabular-nums"
          >
            <span aria-hidden="true" className="relative flex size-3">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive/60 motion-reduce:animate-none" />
              <span className="relative inline-flex size-3 rounded-full bg-destructive" />
            </span>
            {audioRecorder.preparing
              ? "Autorisation du microphone…"
              : "Enregistrement · " +
                Math.floor(audioRecorder.seconds / 60) +
                ":" +
                String(audioRecorder.seconds % 60).padStart(2, "0")}
          </p>
          <p className="text-xs text-muted-foreground">
            Message vocal · 2 minutes maximum. Écoutez votre enregistrement
            avant de l’envoyer.
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={audioRecorder.cancel}
            >
              Annuler
            </Button>
            {audioRecorder.recording && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={audioRecorder.stop}
              >
                <Square className="size-4" />
                Arrêter et écouter
              </Button>
            )}
          </div>
        </div>
      )}
      {!recordingMode && (
        <FieldGroup className="gap-2 rounded-2xl border border-input bg-muted/30 px-2 py-1 shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30">
          <Controller
            name="attachment"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid} className="gap-2">
                <FieldLabel htmlFor="chat-attachment" className="sr-only">
                  Joindre un fichier
                </FieldLabel>
                <Input
                  ref={(element) => {
                    field.ref(element);
                    fileRef.current = element;
                  }}
                  id="chat-attachment"
                  type="file"
                  className="sr-only"
                  tabIndex={-1}
                  accept={[
                    ...Object.keys(MEDIA_TYPES),
                    ...Object.values(MEDIA_TYPES).map((ext) => "." + ext),
                  ].join(",")}
                  disabled={
                    isSending ||
                    uploading ||
                    audioRecorder.recording ||
                    audioRecorder.preparing
                  }
                  aria-invalid={fieldState.invalid}
                  aria-describedby="chat-attachment-help chat-attachment-error"
                  onBlur={field.onBlur}
                  onChange={(event) => void uploadFile(event.target.files?.[0])}
                />
                <p
                  id="chat-attachment-help"
                  className={
                    file && !audioMode
                      ? "px-2 text-xs text-muted-foreground"
                      : "sr-only"
                  }
                >
                  4 Mo maximum par fichier. Légende : 1 024 caractères. L’audio
                  est envoyé seul.
                </p>
                {file && !audioMode && (
                  <div className="space-y-2 rounded-lg border bg-muted p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="min-w-0 truncate text-sm">{file.name}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={isSending}
                        onClick={() => {
                          uploadController.current?.abort();
                          setUploading(false);
                          setAttachment(undefined);
                          setFile(null);
                          form.clearErrors("attachment");
                          if (fileRef.current) fileRef.current.value = "";
                        }}
                      >
                        Retirer
                      </Button>
                    </div>
                    {uploading && (
                      <p
                        role="status"
                        className="text-sm text-muted-foreground"
                      >
                        Import en cours…
                      </p>
                    )}
                    {preview &&
                      (file.type.startsWith("image/") ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={preview}
                          alt="Aperçu de l’image à envoyer"
                          className="max-h-40 max-w-full rounded-lg object-contain"
                        />
                      ) : file.type.startsWith("audio/") ? (
                        <AudioPlayer key={preview} src={preview} />
                      ) : file.type.startsWith("video/") ? (
                        <video
                          src={preview}
                          controls
                          playsInline
                          preload="metadata"
                          className="max-h-48 max-w-full rounded-lg"
                          aria-label="Aperçu de la vidéo"
                        />
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Document joint ·{" "}
                          {(file.size / 1024).toLocaleString("fr-FR", {
                            maximumFractionDigits: 0,
                          })}{" "}
                          Ko
                        </p>
                      ))}
                  </div>
                )}
                {file && audioMode && (
                  <div className="flex min-w-0 items-center gap-1 py-2">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="shrink-0 rounded-full"
                      aria-label="Supprimer le message vocal"
                      disabled={isSending}
                      onClick={() => {
                        uploadController.current?.abort();
                        setUploading(false);
                        setAttachment(undefined);
                        setFile(null);
                        form.clearErrors("attachment");
                        if (fileRef.current) fileRef.current.value = "";
                      }}
                    >
                      <X aria-hidden="true" className="size-4" />
                    </Button>
                    <div className="min-w-0 flex-1">
                      {preview && (
                        <AudioPlayer
                          key={preview}
                          src={preview}
                          className="w-full border-0 bg-transparent px-0 py-0"
                        />
                      )}
                      {uploading && (
                        <p
                          role="status"
                          className="text-xs text-muted-foreground"
                        >
                          Préparation de l’audio…
                        </p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      size="icon"
                      className="shrink-0 rounded-full"
                      aria-label="Envoyer le message vocal"
                      disabled={!attachment || uploading || isSending}
                    >
                      {isSending ? (
                        <Loader2
                          aria-hidden="true"
                          className="size-4 animate-spin"
                        />
                      ) : (
                        <ArrowUp aria-hidden="true" className="size-4" />
                      )}
                    </Button>
                  </div>
                )}
                {fieldState.invalid && (
                  <FieldError
                    id="chat-attachment-error"
                    errors={[fieldState.error]}
                  />
                )}
              </Field>
            )}
          />
          {!audioMode && (
            <Controller
              name="content"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-2">
                  <FieldLabel
                    htmlFor="chat-message"
                    className="sr-only max-w-full"
                  >
                    Message pour {contactName}
                  </FieldLabel>
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="relative min-w-0">
                      <Textarea
                        {...field}
                        ref={(element) => {
                          field.ref(element);
                          textareaRef.current = element;
                        }}
                        id="chat-message"
                        rows={2}
                        autoComplete="off"
                        disabled={
                          isSending ||
                          audioRecorder.recording ||
                          audioRecorder.preparing
                        }
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
                        className="min-h-16 min-w-0 max-h-40 w-full resize-none rounded-none border-0 bg-transparent px-2 py-2 shadow-none focus-visible:ring-0 dark:bg-transparent"
                      />
                      <div
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-x-2 top-0 h-3 mask-b-from-0% mask-b-to-100% backdrop-blur-xs ${scrollEdges.top ? "opacity-100" : "opacity-0"}`}
                      />
                      <div
                        aria-hidden="true"
                        className={`pointer-events-none absolute inset-x-2 bottom-0 h-3 mask-t-from-0% mask-t-to-100% backdrop-blur-xs ${scrollEdges.bottom ? "opacity-100" : "opacity-0"}`}
                      />
                    </div>
                    <div className="flex min-w-0 flex-wrap items-center justify-between gap-1">
                      <div className="flex min-w-0 items-center gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-11 shrink-0 rounded-full"
                              aria-label="Joindre un fichier"
                              aria-controls="chat-attachment"
                              disabled={
                                isSending ||
                                uploading ||
                                audioRecorder.recording ||
                                audioRecorder.preparing
                              }
                              onClick={() => fileRef.current?.click()}
                            >
                              <Paperclip
                                className="size-5"
                                aria-hidden="true"
                              />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Images, vidéos, audio et documents · 4 Mo maximum
                          </TooltipContent>
                        </Tooltip>
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
                                onClick={() =>
                                  void requestAssistance("rewrite")
                                }
                              >
                                {busy === "rewrite" ? (
                                  <Loader2
                                    aria-hidden="true"
                                    className="size-4 animate-spin motion-reduce:animate-none"
                                  />
                                ) : (
                                  <WandSparkles
                                    aria-hidden="true"
                                    className="size-4"
                                  />
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
                      </div>
                      <div className="ml-auto flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-11 shrink-0 rounded-full"
                              aria-label="Enregistrer un message vocal"
                              disabled={
                                isSending ||
                                uploading ||
                                !!file ||
                                audioRecorder.recording ||
                                audioRecorder.preparing
                              }
                              onClick={() => void audioRecorder.start()}
                            >
                              {audioRecorder.preparing ? (
                                <Loader2 className="size-5 animate-spin" />
                              ) : (
                                <Mic className="size-5" aria-hidden="true" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Enregistrer un audio · 2 minutes maximum
                          </TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild className="cursor-pointer">
                            <Button
                              type="submit"
                              size="icon"
                              disabled={
                                (!draft.trim() && !attachment) ||
                                isSending ||
                                uploading ||
                                audioRecorder.recording ||
                                audioRecorder.preparing
                              }
                              aria-label={
                                isSending
                                  ? "Envoi en cours"
                                  : "Envoyer le message"
                              }
                              title="Envoyer · Ctrl / ⌘ + Entrée"
                              className="size-8 shrink-0 rounded-full"
                            >
                              {isSending ? (
                                <Loader2
                                  aria-hidden="true"
                                  className="size-4 animate-spin motion-reduce:animate-none"
                                />
                              ) : (
                                <ArrowUp
                                  aria-hidden="true"
                                  className="size-5"
                                />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Envoyer · Ctrl / ⌘ + Entrée</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </div>
                  <p id="chat-composer-help" className="sr-only max-w-full">
                    Entrée pour une nouvelle ligne. Ctrl ou Commande et Entrée
                    pour envoyer.
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
          )}
        </FieldGroup>
      )}
    </form>
  );
}
