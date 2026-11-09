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
  isChatImageType,
  isGenericPastedName,
  mediaFileError,
  mediaMimeForFile,
  pastedImageName,
} from "@/lib/chat-media";
import { clipboardFiles, clipboardPrefersText } from "@/lib/chat-paste";
// Même détection d’après les octets que pour les icônes (JPEG, PNG, WebP).
import { sniffLogoType as sniffImageType } from "@/lib/project-logo";
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

/** Pièce jointe en attente : importée dès l’ajout, envoyée avec le message. */
type PendingAttachment = {
  id: string;
  file: File;
  /** URL locale (image ou audio), révoquée dès que la pièce jointe disparaît. */
  preview: string | null;
  /** Ticket signé par le serveur ; absent tant que l’import est en cours. */
  attachment?: ChatAttachment;
};
type FileSource = "paste" | "picker" | "recorder";

const MAX_PENDING_ATTACHMENTS = 10;
const UploadResponse = z.object({
  token: z.string(),
  type: z.enum(["IMAGE", "AUDIO", "VIDEO", "DOCUMENT"]),
  requestId: z.string().uuid(),
});
/** Message renvoyé par le serveur : sûr à afficher tel quel. */
class UploadRefusedError extends Error {}

const pluralize = (count: number, one: string, many: string) =>
  count === 1 ? one : `${count} ${many}`;

async function sniffFile(file: File) {
  try {
    return sniffImageType(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
  } catch {
    return null;
  }
}

/**
 * Contrôles du navigateur (confort seulement, le serveur revérifie tout) :
 * type réel des images lu dans les octets, formats et taille de l’envoi,
 * nom sûr pour les images collées. Renvoie le fichier prêt ou un refus.
 */
async function prepareFile(
  file: File,
  source: FileSource,
  pastedAt: Date,
  rank: number,
): Promise<File | string> {
  const declared = mediaMimeForFile(file);
  const imageLike = declared.startsWith("image/");
  const label =
    source === "paste" || !file.name ? "L’image collée" : `« ${file.name} »`;
  if (source === "paste" && !imageLike)
    return "Seules les images JPEG, PNG ou WebP se collent. Utilisez le trombone pour les autres fichiers.";
  let mime = declared;
  if (imageLike) {
    const real = await sniffFile(file);
    if (!real || !isChatImageType(real))
      return isChatImageType(declared)
        ? `${label} n’est pas une image valide.`
        : "Format d’image non pris en charge : utilisez JPEG, PNG ou WebP.";
    mime = real;
  }
  const error = mediaFileError({ size: file.size, type: mime });
  if (error)
    return file.size > 0 && Object.hasOwn(MEDIA_TYPES, mime)
      ? `${label} dépasse 4 Mo.`
      : error;
  const name =
    source === "paste" && isGenericPastedName(file.name)
      ? pastedImageName(mime, pastedAt, rank)
      : file.name;
  return new File([file], name, { type: mime, lastModified: file.lastModified });
}

function releasePreview(item: PendingAttachment) {
  if (item.preview) URL.revokeObjectURL(item.preview);
}

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
  // `pendingRef` est la source de vérité (lue pendant les imports et l’envoi) ;
  // l’état ne sert qu’à l’affichage. Toute modification passe par updatePending.
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const pendingRef = useRef<PendingAttachment[]>([]);
  const uploads = useRef(new Map<string, AbortController>());
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [announcement, setAnnouncement] = useState("");

  function updatePending(
    change: (list: PendingAttachment[]) => PendingAttachment[],
  ) {
    pendingRef.current = change(pendingRef.current);
    setPending(pendingRef.current);
  }
  function discard(id: string) {
    uploads.current.get(id)?.abort();
    uploads.current.delete(id);
    pendingRef.current.filter((item) => item.id === id).forEach(releasePreview);
    updatePending((list) => list.filter((item) => item.id !== id));
  }
  function discardAll() {
    for (const controller of uploads.current.values()) controller.abort();
    uploads.current.clear();
    pendingRef.current.forEach(releasePreview);
    updatePending(() => []);
  }

  useEffect(() => {
    const controllers = uploads.current;
    const latest = pendingRef;
    return () => {
      for (const controller of controllers.values()) controller.abort();
      latest.current.forEach(releasePreview);
    };
  }, []);

  async function upload(item: PendingAttachment) {
    const controller = new AbortController();
    uploads.current.set(item.id, controller);
    try {
      const response = await fetch(
        "/api/projects/" +
          encodeURIComponent(projectId) +
          "/chat/media?requestId=" +
          crypto.randomUUID(),
        {
          method: "POST",
          headers: {
            "Content-Type": item.file.type,
            "X-File-Name": encodeURIComponent(item.file.name),
          },
          body: item.file,
          signal: controller.signal,
        },
      );
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const error =
          data && typeof data === "object" && "error" in data
            ? data.error
            : null;
        throw new UploadRefusedError(
          typeof error === "string" ? error : "Import du fichier impossible.",
        );
      }
      const attachment = UploadResponse.parse(data);
      if (controller.signal.aborted) return;
      updatePending((list) =>
        list.map((entry) =>
          entry.id === item.id ? { ...entry, attachment } : entry,
        ),
      );
      if (pendingRef.current.every((entry) => entry.attachment))
        setAnnouncement(
          pendingRef.current.length === 1
            ? "Pièce jointe prête à l’envoi."
            : "Pièces jointes prêtes à l’envoi.",
        );
    } catch (error) {
      if (controller.signal.aborted) return;
      const message =
        error instanceof UploadRefusedError
          ? error.message
          : "Import du fichier impossible. Vérifiez votre connexion et réessayez.";
      discard(item.id);
      form.setError("attachment", { message });
      toast.error(message);
    } finally {
      if (uploads.current.get(item.id) === controller)
        uploads.current.delete(item.id);
    }
  }

  /** Trombone, collage ou micro : mêmes contrôles, puis import immédiat. */
  async function addFiles(files: File[], source: FileSource) {
    if (!files.length) return;
    const pastedAt = new Date();
    const prepared = await Promise.all(
      files.map((file, rank) => prepareFile(file, source, pastedAt, rank)),
    );
    const refusals = prepared.filter(
      (entry): entry is string => typeof entry === "string",
    );
    const accepted: File[] = [];
    const current = pendingRef.current;
    for (const file of prepared) {
      if (typeof file === "string") continue;
      const audio = file.type.startsWith("audio/");
      if (
        (audio && (current.length || accepted.length)) ||
        current.some((entry) => entry.file.type.startsWith("audio/"))
      ) {
        refusals.push(
          "Un fichier audio s’envoie seul : retirez les autres pièces jointes d’abord.",
        );
        continue;
      }
      if (current.length + accepted.length >= MAX_PENDING_ATTACHMENTS) {
        refusals.push(
          `${MAX_PENDING_ATTACHMENTS} pièces jointes maximum par envoi.`,
        );
        break;
      }
      accepted.push(file);
      if (audio) break;
    }
    if (refusals.length)
      toast.error(refusals[0], {
        description:
          refusals.length > 1
            ? pluralize(
                refusals.length - 1,
                "1 autre fichier refusé.",
                "autres fichiers refusés.",
              )
            : undefined,
      });
    if (!accepted.length) return;
    const items: PendingAttachment[] = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      preview: /^(image|audio)\//.test(file.type)
        ? URL.createObjectURL(file)
        : null,
    }));
    updatePending((list) => [...list, ...items]);
    form.clearErrors("attachment");
    setAnnouncement(
      items.length === 1
        ? `Pièce jointe ajoutée : ${items[0].file.name}. Import en cours.`
        : `${items.length} pièces jointes ajoutées. Import en cours.`,
    );
    for (const item of items) void upload(item);
  }

  function removeAttachment(item: PendingAttachment) {
    discard(item.id);
    form.clearErrors("attachment");
    setAnnouncement(`${item.file.name} supprimé de l’envoi.`);
    // La vignette et son bouton disparaissent : le focus revient à la saisie.
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  const audioRecorder = useAudioRecorder(
    (recorded) => void addFiles([recorded], "recorder"),
    contactId,
  );
  const uploading = pending.some((item) => !item.attachment);
  const audioItem = pending.find((item) => item.file.type.startsWith("audio/"));
  const audioPreview = audioItem?.preview ?? null;
  const audioMode =
    audioRecorder.recording || audioRecorder.preparing || !!audioItem;
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
    // La légende accompagne la première pièce jointe : c’est elle qui est validée.
    values: {
      content: audioMode ? "" : draft,
      attachment: pending.find((item) => item.attachment)?.attachment,
    },
  });
  useEffect(() => {
    discardAll();
    if (fileRef.current) fileRef.current.value = "";
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seulement au changement de contact
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
      onSubmit={form.handleSubmit(async ({ content }) => {
        if (
          uploading ||
          isSending ||
          audioRecorder.recording ||
          audioRecorder.preparing
        )
          return;
        const queue = pendingRef.current.filter((item) => item.attachment);
        if (!queue.length) {
          await onSend(content);
          return;
        }
        // Un message WhatsApp par pièce jointe, dans l’ordre des vignettes ;
        // la légende part avec la première. Un échec ou une confirmation
        // incertaine arrête la suite, qui reste prête dans le compositeur.
        const preservedDraft = draft;
        const audio = queue[0].attachment?.type === "AUDIO";
        let sent = 0;
        for (const [index, item] of queue.entries()) {
          const result = await onSend(
            index === 0 && !audio ? content : "",
            item.attachment,
          );
          if (result !== "accepted" && result !== "uncertain") break;
          discard(item.id);
          sent += 1;
          if (result === "uncertain") break;
        }
        if (audio && sent) onDraftChange(preservedDraft);
        const left = queue.length - sent;
        if (sent && left)
          toast.warning(
            left === 1
              ? "1 pièce jointe n’a pas été envoyée : elle reste dans le compositeur."
              : `${left} pièces jointes n’ont pas été envoyées : elles restent dans le compositeur.`,
          );
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
                    multiple
                    disabled={
                      isSending ||
                      recordingMode ||
                      pending.length >= MAX_PENDING_ATTACHMENTS
                    }
                    aria-invalid={fieldState.invalid}
                    aria-describedby="chat-attachment-help chat-attachment-error"
                    onBlur={field.onBlur}
                    onChange={(event) => {
                      const files = Array.from(event.target.files ?? []);
                      // Permet de rechoisir le même fichier après l’avoir retiré.
                      event.target.value = "";
                      void addFiles(files, "picker");
                    }}
                  />
                  <p id="chat-attachment-help" className="sr-only">
                    Images, vidéos, audio et documents, 4 Mo maximum par
                    fichier, {MAX_PENDING_ATTACHMENTS} fichiers par envoi. Vous
                    pouvez aussi coller une image dans le message. Légende :
                    1 024 caractères, envoyée avec la première pièce jointe.
                    L’audio est envoyé seul.
                  </p>
                  {pending.length > 0 && !audioMode && (
                    <ul
                      aria-label={pluralize(
                        pending.length,
                        "1 pièce jointe",
                        "pièces jointes",
                      )}
                      className="flex flex-wrap gap-2.5 px-2.5 pt-2.5"
                    >
                      {pending.map((item) => (
                        <AttachmentThumbnail
                          key={item.id}
                          item={item}
                          disabled={isSending}
                          onRemove={() => removeAttachment(item)}
                        />
                      ))}
                    </ul>
                  )}
                  {audioItem && audioMode && (
                    <div className="flex min-w-0 items-center gap-1.5 p-1.5">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label="Supprimer le message vocal"
                        disabled={isSending}
                        onClick={() => removeAttachment(audioItem)}
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
                          audioPreview && (
                            <AudioPlayer
                              key={audioPreview}
                              src={audioPreview}
                              className="w-full rounded-none border-0 bg-transparent p-0 shadow-none"
                            />
                          )
                        )}
                      </div>
                      <SendButton
                        label="Envoyer le message vocal"
                        sending={isSending}
                        disabled={
                          !audioItem.attachment || uploading || isSending
                        }
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
                          // Import en cours : on attend, sans message d’erreur.
                          if (uploading) return;
                          event.currentTarget.form?.requestSubmit();
                        }}
                        onPaste={(event) => {
                          const data = event.clipboardData;
                          const files = clipboardFiles(data);
                          // Texte seul, ou texte riche (Word, Excel) : collage normal.
                          if (!files.length || clipboardPrefersText(data))
                            return;
                          event.preventDefault();
                          void addFiles(files, "paste");
                        }}
                        placeholder={
                          pending.length
                            ? "Ajouter une légende…"
                            : "Écrire un message…"
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
                            disabled={
                              isSending ||
                              pending.length >= MAX_PENDING_ATTACHMENTS
                            }
                            onClick={() => fileRef.current?.click()}
                          >
                            <Paperclip aria-hidden="true" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {pending.length >= MAX_PENDING_ATTACHMENTS
                            ? `${MAX_PENDING_ATTACHMENTS} pièces jointes maximum par envoi`
                            : "Images, vidéos, audio et documents · 4 Mo maximum · ou collez une image"}
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
                            disabled={isSending || pending.length > 0}
                            onClick={() => void audioRecorder.start()}
                          >
                            <Mic aria-hidden="true" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {pending.length
                            ? "Retirez les pièces jointes pour enregistrer un audio"
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
                          (!draft.trim() && !pending.length) ||
                          isSending ||
                          uploading
                        }
                      />
                    </div>
                    <p id="chat-composer-help" className="sr-only">
                      Entrée pour envoyer, Maj et Entrée pour une nouvelle
                      ligne. Sur mobile, utilisez le bouton Envoyer. Collez une
                      image pour la joindre au message.
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
      {/* Ajouts, imports terminés et retraits annoncés au lecteur d’écran. */}
      <p role="status" className="sr-only">
        {announcement}
      </p>
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

/**
 * Pièce jointe en attente : vignette carrée sans nom (aperçu pour les images,
 * icône et extension sinon), bouton de retrait en haut à droite. Le nom et le
 * poids restent lus par le lecteur d’écran.
 */
function AttachmentThumbnail({
  item,
  disabled,
  onRemove,
}: {
  item: PendingAttachment;
  disabled: boolean;
  onRemove: () => void;
}) {
  const { file, preview } = item;
  const uploading = !item.attachment;
  const image = file.type.startsWith("image/");
  const video = file.type.startsWith("video/");
  const Icon = video ? Film : FileText;
  const kind = image ? "Image" : video ? "Vidéo" : "Document";
  const dot = file.name.lastIndexOf(".");
  const extension = dot > 0 ? file.name.slice(dot + 1, dot + 5) : "";

  return (
    <li className="relative">
      <span
        aria-hidden="true"
        className="relative flex size-16 items-center justify-center overflow-hidden rounded-lg border bg-muted text-muted-foreground"
      >
        {image && preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            draggable={false}
            className="size-full object-cover"
          />
        ) : (
          <span className="flex flex-col items-center gap-1">
            <Icon className="size-5" />
            {extension && (
              <span className="text-[10px] leading-none font-medium uppercase">
                {extension}
              </span>
            )}
          </span>
        )}
        {uploading && (
          <span className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="size-4 animate-spin text-foreground motion-reduce:animate-none" />
          </span>
        )}
      </span>
      <span className="sr-only">
        {kind} {file.name}, {formatFileSize(file.size)}
        {uploading ? ", import en cours" : ""}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            className="absolute -top-2 -right-2 rounded-full text-muted-foreground shadow-xs hover:text-foreground"
            aria-label={`Supprimer ${file.name}`}
            disabled={disabled}
            onClick={onRemove}
          >
            <X aria-hidden="true" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Supprimer {file.name}</TooltipContent>
      </Tooltip>
    </li>
  );
}
