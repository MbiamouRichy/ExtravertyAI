"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ArrowUp,
  Paperclip,
  Mic,
  CornerDownLeft,
  FileText,
  Film,
  Loader2,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { toast } from "sonner";
import { assistWriting } from "@/app/actions/assistWriting";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
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

import { AudioRecording } from "./audio-recording";
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
  header,
}: {
  projectId: string;
  contactId: string;
  assistanceEnabled: boolean;
  contextVersion: string;
  hasClientMessage: boolean;
  /** Barre affichée en haut de la carte (ex. bascule Répondre / Note interne). */
  header?: ReactNode;
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
    return () => {
      requestId.current += 1;
    };
  }, [contactId, assistanceEnabled, contextVersion, isSending, audioMode]);

  function removeAttachment() {
    uploadController.current?.abort();
    setUploading(false);
    setAttachment(undefined);
    setFile(null);
    form.clearErrors("attachment");
    if (fileRef.current) fileRef.current.value = "";
  }

  // Les suggestions IA ne sont générées qu’à la demande (« Proposer des réponses »).
  async function requestAssistance(mode: "suggest" | "rewrite") {
    if (requestLock.current || isSending || !assistanceEnabled) return;
    requestLock.current = true;
    const id = ++requestId.current;
    setBusy(mode);
    setProposal(null);
    try {
      const result = await assistWriting({
        projectId,
        contactId,
        mode,
        ...(mode === "rewrite" ? { draft } : {}),
      });
      if (id !== requestId.current) return;
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setProposal({ mode, replies: result.replies, draft });
    } catch {
      if (id === requestId.current)
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
          aria-labelledby={`chat-ai-proposals-title-${contactId}`}
          className="mb-2"
        >
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p
              id={`chat-ai-proposals-title-${contactId}`}
              className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground"
            >
              {busy ? (
                <Loader2
                  aria-hidden="true"
                  className="size-3 shrink-0 animate-spin motion-reduce:animate-none"
                />
              ) : (
                <Sparkles aria-hidden="true" className="size-3 shrink-0" />
              )}
              <span className="truncate">
                {busy === "suggest"
                  ? "Suggestions IA en cours…"
                  : busy === "rewrite"
                    ? "Reformulation en cours…"
                    : proposal?.mode === "rewrite"
                      ? "Reformulation · cliquez pour l’utiliser, puis relisez"
                      : proposal
                        ? "Suggestions IA · cliquez pour insérer, puis relisez avant d’envoyer"
                        : hasClientMessage
                          ? "Suggestions IA"
                          : "Les suggestions apparaîtront après un message du client"}
              </span>
            </p>
            {proposal ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Masquer les propositions"
                onClick={() => setProposal(null)}
              >
                <X aria-hidden="true" />
              </Button>
            ) : (
              hasClientMessage &&
              !busy && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  disabled={isSending}
                  onClick={() => void requestAssistance("suggest")}
                >
                  Proposer des réponses
                </Button>
              )
            )}
          </div>
          <div aria-live="polite" aria-busy={!!busy}>
            {busy === "suggest" && (
              <div aria-hidden="true" className="grid gap-1.5 sm:grid-cols-2">
                <div className="h-14 animate-pulse rounded-xl border bg-muted/50 motion-reduce:animate-none" />
                <div className="h-14 animate-pulse rounded-xl border bg-muted/50 motion-reduce:animate-none" />
              </div>
            )}
            {!busy &&
              proposal &&
              (proposal.mode === "suggest" || proposal.draft === draft) && (
                <ul className="grid max-h-44 gap-1.5 overflow-y-auto sm:grid-cols-2">
                  {proposal.replies.map((reply, index) => (
                    <li key={index} className="min-w-0">
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isSending}
                        className="group h-full w-full items-start justify-between gap-2 whitespace-normal rounded-xl px-3 py-2 text-left font-normal"
                        onClick={() => {
                          form.setValue("content", reply, {
                            shouldValidate: true,
                          });
                          onDraftChange(reply);
                          setProposal(null);
                          textareaRef.current?.focus();
                        }}
                      >
                        <span
                          dir="auto"
                          className="whitespace-pre-wrap text-xs leading-relaxed wrap-anywhere"
                        >
                          {reply}
                        </span>
                        <CornerDownLeft
                          aria-hidden="true"
                          className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                        />
                        <span className="sr-only">
                          {draft.trim()
                            ? "Remplacer le brouillon par cette proposition"
                            : "Insérer cette proposition"}
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
          </div>
        </section>
      )}
      <div className="relative min-w-0 overflow-hidden rounded-xl border border-input bg-background shadow-xs transition-[color,box-shadow] focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50">
        {header && (
          <div className="flex min-w-0 items-center gap-1 border-b px-1.5 py-1.5">
            {header}
          </div>
        )}
        {recordingMode ? (
          <AudioRecording
            stream={audioRecorder.microphone}
            preparing={audioRecorder.preparing}
            seconds={audioRecorder.seconds}
            onCancel={audioRecorder.cancel}
            onStop={audioRecorder.stop}
          />
        ) : (
          <FieldGroup className="gap-0">
            <Controller
              name="attachment"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="gap-0">
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
                    disabled={isSending || uploading || recordingMode}
                    aria-invalid={fieldState.invalid}
                    aria-describedby="chat-attachment-help chat-attachment-error"
                    onBlur={field.onBlur}
                    onChange={(event) =>
                      void uploadFile(event.target.files?.[0])
                    }
                  />
                  <p id="chat-attachment-help" className="sr-only">
                    Images, vidéos, audio et documents, 4 Mo maximum. Légende :
                    1 024 caractères. L’audio est envoyé seul.
                  </p>
                  {file && !audioMode && (
                    <div className="px-2 pt-2">
                      <AttachmentChip
                        file={file}
                        preview={preview}
                        uploading={uploading}
                        disabled={isSending}
                        onRemove={removeAttachment}
                      />
                    </div>
                  )}
                  {file && audioMode && (
                    <div className="flex min-w-0 items-center gap-1.5 p-1.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label="Supprimer le message vocal"
                        disabled={isSending}
                        onClick={removeAttachment}
                      >
                        <X aria-hidden="true" />
                      </Button>
                      <div className="min-w-0 flex-1">
                        {uploading ? (
                          <p
                            role="status"
                            className="flex items-center gap-2 text-xs text-muted-foreground"
                          >
                            <Loader2
                              aria-hidden="true"
                              className="size-3.5 animate-spin motion-reduce:animate-none"
                            />
                            Préparation de l’audio…
                          </p>
                        ) : (
                          preview && (
                            <AudioPlayer
                              key={preview}
                              src={preview}
                              className="w-full rounded-none border-0 bg-transparent p-0 shadow-none"
                            />
                          )
                        )}
                      </div>
                      <SendButton
                        label="Envoyer le message vocal"
                        sending={isSending}
                        disabled={!attachment || uploading || isSending}
                      />
                    </div>
                  )}
                  {fieldState.invalid && (
                    <FieldError
                      id="chat-attachment-error"
                      className="px-3 pt-2 text-xs"
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
                  <Field data-invalid={fieldState.invalid} className="gap-0">
                    <FieldLabel htmlFor="chat-message" className="sr-only">
                      Message pour {contactName}
                    </FieldLabel>
                    <div className="relative min-w-0">
                      <Textarea
                        {...field}
                        ref={(element) => {
                          field.ref(element);
                          textareaRef.current = element;
                        }}
                        id="chat-message"
                        rows={1}
                        autoComplete="off"
                        disabled={isSending}
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
                            event.key !== "Enter" ||
                            event.nativeEvent.isComposing
                          )
                            return;
                          // Entrée envoie au clavier physique ; sur mobile elle
                          // garde son rôle de retour à la ligne.
                          const send =
                            event.ctrlKey ||
                            event.metaKey ||
                            (!event.shiftKey &&
                              !window.matchMedia("(pointer: coarse)").matches);
                          if (!send) return;
                          event.preventDefault();
                          event.currentTarget.form?.requestSubmit();
                        }}
                        placeholder={
                          file ? "Ajouter une légende…" : "Écrire un message…"
                        }
                        className="max-h-40 min-h-11 w-full min-w-0 resize-none rounded-none border-0 bg-transparent px-3 py-2.5 shadow-none focus-visible:ring-0 aria-invalid:ring-0 dark:bg-transparent"
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
                    <div className="flex min-w-0 items-center gap-0.5 px-1.5 pb-1.5">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className={toolClass}
                            aria-label="Joindre un fichier"
                            aria-controls="chat-attachment"
                            disabled={isSending || uploading}
                            onClick={() => fileRef.current?.click()}
                          >
                            <Paperclip aria-hidden="true" />
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className={toolClass}
                            aria-label="Enregistrer un message vocal"
                            disabled={isSending || uploading || !!file}
                            onClick={() => void audioRecorder.start()}
                          >
                            <Mic aria-hidden="true" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {file
                            ? "Retirez la pièce jointe pour enregistrer un audio"
                            : "Enregistrer un audio · 2 minutes maximum"}
                        </TooltipContent>
                      </Tooltip>
                      {assistanceEnabled && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="ml-0.5 h-9 gap-1.5 px-2 text-muted-foreground hover:text-foreground sm:h-8"
                              aria-label="Améliorer le message avec l’IA"
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
                                  className="animate-spin motion-reduce:animate-none"
                                />
                              ) : (
                                <WandSparkles aria-hidden="true" />
                              )}
                              <span className="hidden sm:inline">Améliorer</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {draft.trim().length > 6000
                              ? "Reformulation limitée à 6 000 caractères"
                              : "Reformuler avec l’IA"}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      <span
                        aria-hidden="true"
                        className="ml-auto mr-1.5 hidden items-center gap-1 text-[11px] text-muted-foreground lg:flex"
                      >
                        <Kbd>Shift</Kbd>+<Kbd>Entrée</Kbd> nouvelle ligne
                      </span>
                      <SendButton
                        className="max-lg:ml-auto"
                        label={isSending ? "Envoi en cours" : "Envoyer le message"}
                        sending={isSending}
                        disabled={
                          (!draft.trim() && !attachment) ||
                          isSending ||
                          uploading
                        }
                      />
                    </div>
                    <p id="chat-composer-help" className="sr-only">
                      Entrée pour envoyer, Maj et Entrée pour une nouvelle
                      ligne. Sur mobile, utilisez le bouton Envoyer.
                    </p>
                    {fieldState.invalid && (
                      <FieldError
                        id="chat-composer-error"
                        className="px-3 pb-2 text-xs"
                        errors={[fieldState.error]}
                      />
                    )}
                  </Field>
                )}
              />
            )}
          </FieldGroup>
        )}
      </div>
    </form>
  );
}

const toolClass =
  "size-9 shrink-0 text-muted-foreground hover:text-foreground sm:size-8";

function SendButton({
  label,
  sending,
  disabled,
  className,
}: {
  label: string;
  sending: boolean;
  disabled: boolean;
  className?: string;
}) {
  return (
    <Button
      type="submit"
      size="icon-sm"
      disabled={disabled}
      aria-label={label}
      className={cn("size-9 shrink-0 sm:size-8", className)}
    >
      {sending ? (
        <Loader2
          aria-hidden="true"
          className="animate-spin motion-reduce:animate-none"
        />
      ) : (
        <ArrowUp aria-hidden="true" />
      )}
    </Button>
  );
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024)
    return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("fr-FR")} Ko`;
  return `${(bytes / 1024 / 1024).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

/** Pièce jointe en attente d’envoi : vignette compacte, nom, poids, retrait. */
function AttachmentChip({
  file,
  preview,
  uploading,
  disabled,
  onRemove,
}: {
  file: File;
  preview: string | null;
  uploading: boolean;
  disabled: boolean;
  onRemove: () => void;
}) {
  const image = file.type.startsWith("image/");
  const Icon = file.type.startsWith("video/") ? Film : FileText;
  const kind = image
    ? "Image"
    : file.type.startsWith("video/")
      ? "Vidéo"
      : "Document";

  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg border bg-muted/40 p-1.5">
      <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-background text-muted-foreground">
        {image && preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="size-full object-cover"
          />
        ) : (
          <Icon aria-hidden="true" className="size-4" />
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2
              aria-hidden="true"
              className="size-4 animate-spin text-foreground motion-reduce:animate-none"
            />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{file.name}</span>
        <span
          role={uploading ? "status" : undefined}
          className="block truncate text-xs text-muted-foreground"
        >
          {uploading ? "Import en cours…" : `${kind} · ${formatFileSize(file.size)}`}
        </span>
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="size-9 shrink-0 text-muted-foreground hover:text-foreground sm:size-8"
        aria-label={`Retirer ${file.name}`}
        disabled={disabled}
        onClick={onRemove}
      >
        <X aria-hidden="true" />
      </Button>
    </div>
  );
}
