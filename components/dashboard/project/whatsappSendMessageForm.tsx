"use client";
import { getInitials } from "@/components/getInitials";
import {
  useChatContacts,
  useChatMessages,
  useChatRealtime,
} from "@/hooks/use-chat-data";
import { formatWaiting, useNow } from "@/hooks/use-now";
import { AiFeedbackControls } from "./ai-feedback-controls";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookUser,
  Hand,
  Hourglass,
  LibraryBig,
  Plug,
  SquareKanban,
  Bot,
  Check,
  CheckCheck,
  CircleAlert,
  CircleCheck,
  Download,
  Ellipsis,
  Clock3,
  Loader2,
  Lock,
  MessageCircle,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Search,
  Settings,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Kbd } from "@/components/ui/kbd";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ConversationListLoading,
  ConversationMessagesLoading,
} from "./chat-loading-content";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarGroup,
} from "@/components/ui/avatar";
import {
  Message,
  MessageContent,
  MessageHeader,
  MessageFooter,
} from "@/components/ui/message";
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton,
} from "@/components/ui/message-scroller";

import { sendWhatsAppMessage } from "@/app/actions/sendWhatsAppMessage";
import { setContactAiState } from "@/app/actions/setContactAiState";
import {
  addInternalNoteAction,
  setConversationResolvedAction,
} from "@/app/actions/conversation-workflow";
import {
  ComposerModeToggle,
  InternalNoteComposer,
  ResolveConversationButton,
  TagFilter,
  type ComposerMode,
} from "./chat-workflow";
import {
  normalizeChatStatus,
  type ChatClient,
  type ChatAgent,
  type ChatFilter,
  type ChatMessage,
  type ChatMessageStatus,
} from "@/lib/chat";
import { cn } from "@/lib/utils";
import { AiResponseText, AiThinking, useLiveAiResponses } from "./ai-response";
import { ChatComposer } from "./chat-composer";
import { ChatContactPanel } from "./chat-contact-panel";
import { downloadConversation } from "./export-conversation";
import { ConversationSummaryView } from "./conversation-summary";
import { useConversationRead } from "@/hooks/use-conversation-read";
import { createChatDateFormatters } from "@/lib/chat-dates";
import { SendChatMessageSchema } from "@/lib/message-schema";
import { type ChatAttachment, messageMediaPath } from "@/lib/chat-media";
import { ChatMedia } from "./chat-media";
import type { AudioTranscript } from "./audio-player";

type WorkspaceProps = {
  initialClient?: ChatClient;
  project: {
    id: string;
    name: string;
    automationPaused: boolean;
  };
  user: {
    id: string;
    name?: string | null;
    image?: string | null;
  };
  isSuccess: boolean;
  canManageAi: boolean;
  /** Propriétaire ou administrateur (vérifié à nouveau côté serveur). */
  canCopyPhone?: boolean;
  /** Offre Pro ou Business : étape et montant dans la fiche contact. */
  pipeline?: { enabled: boolean; currency: string };
};

type Filter = ChatFilter;

type LocalMessage = Omit<ChatMessage, "status"> & {
  localId: string;
  status: ChatMessageStatus | "sending" | "uncertain";
};

type DisplayMessage = ChatMessage | LocalMessage;

type SendResult = {
  success: boolean;
  uncertain: boolean;
  error?: string;
  id?: string;
  status: ChatMessageStatus;
};

// Stable server snapshot avoids hydration differences; then use the device timezone.
const subscribeTimezone = () => () => {};
const getLocalTimezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const getServerTimezone = () => "UTC";
function useChatDates() {
  const timeZone = useSyncExternalStore(
    subscribeTimezone,
    getLocalTimezone,
    getServerTimezone,
  );
  return useMemo(() => createChatDateFormatters(timeZone), [timeZone]);
}

function normalizeSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseSendResult(value: unknown): SendResult {
  if (!isRecord(value) || typeof value.success !== "boolean") {
    throw new Error("Réponse non confirmée.");
  }

  const message = isRecord(value.message) ? value.message : undefined;

  return {
    success: value.success,
    uncertain: value.uncertain === true,
    error: typeof value.error === "string" ? value.error : undefined,
    id: typeof message?.id === "string" ? message.id : undefined,
    status: normalizeChatStatus(message?.status),
  };
}

function AgentAvatar({
  agent,
  small = false,
}: {
  agent?: ChatAgent | null;
  small?: boolean;
}) {
  const name = agent?.name?.trim() || "Agent";
  return (
    <Avatar size={small ? "sm" : "default"} title={name} aria-label={name}>
      <AvatarImage src={agent?.image || undefined} alt="" />
      <AvatarFallback className="text-xs">
        {agent?.name?.trim() ? (
          getInitials(name)
        ) : (
          <UserRound aria-hidden="true" className="size-4" />
        )}
      </AvatarFallback>
    </Avatar>
  );
}

function ConversationParticipants({
  active,
  agents,
  loading,
}: {
  active: boolean;
  agents: ChatAgent[];
  loading: boolean;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      {active && (
        <span
          title="IA activée"
          className="relative flex size-6 shrink-0 items-center justify-center text-info"
        >
          <Bot aria-hidden="true" className="size-4" />
          <span
            aria-hidden="true"
            className="absolute -right-0.5 -top-0.5 flex size-2"
          >
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-info opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-2 rounded-full bg-info ring-2 ring-background" />
          </span>
          <span className="sr-only">IA activée</span>
        </span>
      )}
      {loading && !agents.length && (
        <Skeleton
          className="size-6 rounded-full"
          aria-label="Chargement des agents"
        />
      )}
      {!!agents.length && (
        <AvatarGroup
          aria-label="Agents ayant répondu"
          tabIndex={agents.length > 4 ? 0 : undefined}
          className="max-w-32 overflow-x-auto py-1 sm:max-w-48"
        >
          {agents.map((agent) => (
            <AgentAvatar key={agent.id} agent={agent} small />
          ))}
        </AvatarGroup>
      )}
    </span>
  );
}

/**
 * Temps d’attente d’un client sans réponse de l’équipe. Style distinct des
 * badges Instinct IA (pastille en pointillés, sablier, chiffres à chasse fixe) ;
 * passe en rouge au-delà d’une heure.
 */
function WaitingBadge({ since, now }: { since: string; now: number }) {
  const label = formatWaiting(since, now);
  const urgent = now - new Date(since).getTime() >= 60 * 60_000;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border border-dashed px-1.5 font-mono text-[10px] font-medium tabular-nums",
            urgent
              ? "border-destructive/50 bg-destructive/10 text-destructive"
              : "border-foreground/40 bg-background text-foreground",
          )}
        >
          <Hourglass aria-hidden="true" className="size-3" />
          <span className="sr-only">Client en attente de réponse depuis </span>
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">
        Client en attente de réponse depuis {label}. Disparaît dès qu’un membre
        de l’équipe répond.
      </TooltipContent>
    </Tooltip>
  );
}

function InstinctBadge({
  classification,
}: {
  classification: ChatClient["prospectClassification"];
}) {
  if (classification !== "interesting" && classification !== "follow_up") {
    return null;
  }
  const interesting = classification === "interesting";
  const Icon = interesting ? Sparkles : Clock3;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm text-[11px] outline-none focus-visible:ring-2 focus-visible:ring-ring",
            interesting
              ? "bg-primary px-1.5 py-px font-medium text-primary-foreground"
              : "border px-1.5 text-muted-foreground",
          )}
        >
          <Icon aria-hidden="true" className="size-3" />
          {interesting ? "Prospect intéressant" : "À suivre"}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">
        Instinct IA : analyse recalculée après chaque nouveau message, selon les
        objectifs de votre agent.
      </TooltipContent>
    </Tooltip>
  );
}

function DeliveryStatus({
  status,
  compact = false,
}: {
  status: DisplayMessage["status"];
  /** Icône seule (libellé pour lecteurs d’écran), dans une bulle. */
  compact?: boolean;
}) {
  const meta = {
    sending: {
      label: "Envoi en cours",
      icon: Loader2,
    },
    uncertain: {
      label: "Confirmation indisponible",
      icon: CircleAlert,
    },
    pending: {
      label: "En attente",
      icon: Clock3,
    },
    sent: {
      label: "Envoyé",
      icon: Check,
    },
    delivered: {
      label: "Distribué",
      icon: CheckCheck,
    },
    read: {
      label: "Lu",
      icon: CheckCheck,
    },
    failed: {
      label: "Échec",
      icon: CircleAlert,
    },
    unknown: {
      label: "Statut non disponible",
      icon: Clock3,
    },
  }[status];

  const Icon = meta.icon;

  return (
    <span
      title={compact ? meta.label : undefined}
      className={cn(
        "inline-flex items-center gap-1",
        !compact && status === "read" && "text-sky-700 dark:text-sky-400",
        compact && status === "read" && "opacity-100",
        status === "failed" && "text-destructive",
        !compact && status === "uncertain" && "text-foreground dark:text-foreground",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "size-3.5",
          status === "sending" && "animate-spin motion-reduce:animate-none",
        )}
      />
      <span className={compact ? "sr-only" : undefined}>{meta.label}</span>
    </span>
  );
}

/**
 * Dernier vrai message WhatsApp du fil : ignore les notes internes, les
 * événements du journal IA et les envois encore optimistes (sans identifiant
 * serveur), qui ne peuvent pas servir de repère côté serveur.
 */
function lastConversationMessage<
  T extends { id: string; senderType: string },
>(items: readonly T[]) {
  return items.findLast(
    (item) =>
      (item.senderType === "client" ||
        item.senderType === "bot" ||
        item.senderType === "agent") &&
      !item.id.startsWith("local-"),
  );
}

function ChatBubble({
  message,
  contactName,
  projectId,
  onRestore,
  animate = false,
  grouped = false,
}: {
  message: DisplayMessage;
  projectId: string;
  contactName: string;
  onRestore: (content: string) => void;
  animate?: boolean;
  /** Message consécutif du même auteur : nom masqué, espacement réduit. */
  grouped?: boolean;
}) {
  const { timeFormatter, dateFormatter, timeZone } = useChatDates();
  const incoming = message.senderType === "client";
  const isAi = message.senderType === "bot";
  const isNote = message.senderType === "note";
  const isAgent = message.senderType === "agent";
  const visualStatus: DisplayMessage["status"] =
    message.status === "read" || message.status === "delivered"
      ? message.status
      : message.outboundState === "UNCERTAIN"
        ? "uncertain"
        : message.outboundState === "DISPATCHING"
          ? "sending"
          : message.outboundState === "CANCELLED"
            ? "failed"
            : message.status;

  const failed = visualStatus === "failed";
  const uncertain = visualStatus === "uncertain";
  const author =
    message.senderType === "client"
      ? contactName
      : message.senderType === "bot"
        ? "Assistant IA"
        : message.senderType === "system"
          ? "Système"
          : isNote
            ? `Note interne · ${message.agent?.name?.trim() || "Équipe"}`
            : message.agent?.name?.trim() || "Agent";

  const date = new Date(message.timestamp);
  const isMedia =
    !!message.mediaUrl &&
    !!message.type &&
    ["IMAGE", "AUDIO", "VIDEO", "DOCUMENT"].includes(message.type);
  const insight = (): AudioTranscript | null =>
    message.extractionStatus === "COMPLETED" && message.extractedText
      ? { state: "ready", text: message.extractedText }
      : ["PENDING", "PROCESSING"].includes(message.extractionStatus ?? "")
        ? { state: "pending" }
        : message.extractionStatus === "FAILED"
          ? { state: "failed" }
          : null;

  const time = (
    <time
      dateTime={date.toISOString()}
      title={`${dateFormatter.format(date)} · ${timeZone}`}
    >
      {timeFormatter.format(date)}
    </time>
  );

  // Journal (activation / pause de l’IA) : pastille centrée, comme la maquette.
  if (message.senderType === "system") {
    return (
      <div role="note" className="my-1 flex w-full justify-center">
        <p className="flex max-w-full items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-center text-[11px] text-muted-foreground">
          <Sparkles aria-hidden="true" className="size-3 shrink-0" />
          <span className="min-w-0">{message.content}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{time}</span>
        </p>
      </div>
    );
  }

  // Les réponses de l’assistant IA conservent leur présentation dédiée.
  if (isAi) {
    return (
      <article aria-label={`Message de ${author}`} className="flex w-full justify-end">
        <Message align="end" className="w-4/5 max-w-prose py-2">
          <MessageContent className="gap-1.5">
            <MessageHeader className="justify-end gap-1.5 px-1 text-[11px]">
              <Bot aria-hidden="true" className="size-3.5" />
              {author}
            </MessageHeader>
            <AiResponseText content={message.content} animate={animate} />
            <MessageFooter className="flex-wrap justify-end gap-x-2 gap-y-1 px-1 text-[10px] font-normal">
              {!message.id.startsWith("local-") && (
                <AiFeedbackControls
                  projectId={projectId}
                  messageId={message.id}
                  feedback={"feedback" in message ? (message.feedback ?? null) : null}
                />
              )}
              {time}
              <DeliveryStatus status={visualStatus} />
            </MessageFooter>
          </MessageContent>
        </Message>
      </article>
    );
  }

  const outgoing = !incoming;
  const meta = (
    <span
      className={cn(
        "flex items-center justify-end gap-1 text-[10px] tabular-nums",
        isAgent && !failed ? "text-primary-foreground/70" : "text-muted-foreground",
      )}
    >
      {isNote && (
        <span className="mr-auto inline-flex items-center gap-1">
          <Lock aria-hidden="true" className="size-3" />
          Visible par l’équipe
        </span>
      )}
      {time}
      {isAgent && <DeliveryStatus status={visualStatus} compact />}
    </span>
  );

  return (
    <article
      aria-label={`Message de ${author}`}
      className={cn(
        "flex w-full items-end gap-2",
        outgoing ? "justify-end" : "justify-start",
        grouped ? "-mt-3" : "mt-1",
      )}
    >
      <div
        className={cn(
          "flex min-w-0 max-w-[85%] flex-col gap-1 sm:max-w-[72%]",
          outgoing ? "items-end" : "items-start",
        )}
      >
        {!grouped && (
          <span className="flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
            {isNote && <Lock aria-hidden="true" className="size-3" />}
            {author}
          </span>
        )}

        {isMedia ? (
          <ChatMedia
            type={message.type!}
            url={message.mediaUrl!}
            caption={message.content}
            outgoing={isAgent && !failed}
            transcript={message.type === "AUDIO" ? insight() : null}
            analysis={message.type === "IMAGE" ? insight() : null}
            footer={meta}
          />
        ) : (
          <div
            className={cn(
              "max-w-full rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-xs",
              incoming && "rounded-bl-md border bg-background",
              isAgent && !failed && "rounded-br-md bg-primary text-primary-foreground",
              isAgent && failed && "rounded-br-md border border-destructive/30 bg-destructive/10 text-destructive",
              isNote && "rounded-br-md border border-dashed border-foreground/30 bg-muted/60",
            )}
          >
            <p dir="auto" className="whitespace-pre-wrap wrap-anywhere">
              {message.content}
            </p>
            <div className="mt-0.5">{meta}</div>
          </div>
        )}

        {uncertain && (
          <p className="max-w-sm px-1 text-xs leading-relaxed">
            Actualisez avant de renvoyer : le message peut avoir été accepté
            malgré l’absence de confirmation.
          </p>
        )}

        {failed && !isMedia && (
          <Button
            type="button"
            variant="link"
            onClick={() => onRestore(message.content)}
            className="h-auto whitespace-normal p-0 px-1 text-xs text-destructive"
          >
            Remettre en brouillon
          </Button>
        )}
      </div>

      {(isAgent || isNote) && (
        <span className={cn("mb-0.5 shrink-0", grouped && "invisible")} aria-hidden={grouped || undefined}>
          <AgentAvatar agent={message.agent} small />
        </span>
      )}
    </article>
  );
}

export default function WhatsappWorkspace({
  project,
  user,
  isSuccess,
  canManageAi,
  canCopyPhone = false,
  pipeline,
  initialClient,
}: WorkspaceProps) {
  const { dateFormatter, previewDateFormatter, timeZone } = useChatDates();
  const [activeId, setActiveId] = useState<string | null>(
    initialClient?.id || null,
  );
  const [selectedClient, setSelectedClient] = useState<ChatClient | null>(
    initialClient || null,
  );
  const [mobileChat, setMobileChat] = useState(!!initialClient);
  // Fiche contact : colonne à droite sur grand écran, panneau latéral sinon.
  const [panelOpen, setPanelOpen] = useState(true);
  // Résumé IA affiché à la place des messages, pour un contact donné.
  const [summaryFor, setSummaryFor] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const now = useNow();

  const contactsQuery = useChatContacts(project.id, search, filter, tagFilter);
  const historyQuery = useChatMessages(project.id, activeId);
  const animatedAiIds = useLiveAiResponses(
    activeId,
    historyQuery.items,
    !!historyQuery.data,
  );

  const readMarker = useConversationRead({
    projectId: project.id,
    contactId: activeId,
    // Notes internes et événements IA ne sont pas des messages : on lit jusqu'au dernier message.
    messageId: lastConversationMessage(historyQuery.items)?.id,
    enabled: !historyQuery.error,
    onRead: () => {
      void contactsQuery.mutate();
    },
  });

  const clients = contactsQuery.items;

  const messages = useMemo<Record<string, ChatMessage[]>>(
    () => (activeId ? { [activeId]: historyQuery.items } : {}),
    [activeId, historyQuery.items],
  );

  function refresh() {
    void contactsQuery.mutate();
    void historyQuery.mutate();
  }

  useChatRealtime(project.id, refresh);

  const refreshing = contactsQuery.isValidating || historyQuery.isValidating;

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [localMessages, setLocalMessages] = useState<
    Record<string, LocalMessage[]>
  >({});
  const [sendingIds, setSendingIds] = useState<string[]>([]);

  const [aiOverrides, setAiOverrides] = useState<Record<string, boolean>>({});
  const [aiBusyId, setAiBusyId] = useState<string | null>(null);
  const [resolvedOverrides, setResolvedOverrides] = useState<
    Record<string, string | null>
  >({});
  const [resolveBusyId, setResolveBusyId] = useState<string | null>(null);
  const resolveLock = useRef(false);
  const [composerMode, setComposerMode] = useState<ComposerMode>("reply");
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [showWelcome, setShowWelcome] = useState(isSuccess);

  const sendLocks = useRef(new Set<string>());
  const aiLock = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const contactButtonRefs = useRef(new Map<string, HTMLButtonElement>());

  const [announcement, setAnnouncement] = useState("");

  // Retire les substitutions IA dès que le serveur les a confirmées.
  useEffect(() => {
    setAiOverrides((previous) => {
      const next = { ...previous };
      let changed = false;

      for (const client of clients) {
        if (
          Object.prototype.hasOwnProperty.call(next, client.id) &&
          next[client.id] === client.aiActive
        ) {
          delete next[client.id];
          changed = true;
        }
      }

      return changed ? next : previous;
    });
    setResolvedOverrides((previous) => {
      const next = { ...previous };
      let changed = false;

      for (const client of clients) {
        if (
          Object.prototype.hasOwnProperty.call(next, client.id) &&
          !!next[client.id] === !!client.resolvedAt
        ) {
          delete next[client.id];
          changed = true;
        }
      }

      return changed ? next : previous;
    });
  }, [clients]);

  // Retire les messages locaux dès que leur ID apparaît côté serveur.
  useEffect(() => {
    setLocalMessages((previous) => {
      let changed = false;
      const next = { ...previous };

      for (const [contactId, entries] of Object.entries(previous)) {
        const serverIds = new Set(
          (messages[contactId] ?? []).map((message) => message.id),
        );

        const serverRequests = new Set(
          (messages[contactId] ?? [])
            .map((message) => message.clientRequestId)
            .filter(Boolean),
        );
        const remaining = entries.filter(
          (message) =>
            !serverIds.has(message.id) &&
            !(
              message.clientRequestId &&
              serverRequests.has(message.clientRequestId)
            ),
        );

        if (remaining.length !== entries.length) {
          next[contactId] = remaining;
          changed = true;
        }
      }

      return changed ? next : previous;
    });
  }, [messages]);

  useEffect(() => {
    if (activeId || clients.length === 0) return;

    setActiveId(clients[0].id);
    setSelectedClient(clients[0]);
  }, [activeId, clients]);

  useEffect(() => {
    if (!activeId) return;

    const updated = clients.find((client) => client.id === activeId);

    if (updated) {
      setSelectedClient(updated);
    }
  }, [activeId, clients]);
  const visibleClients = useMemo(() => {
    const textQuery = normalizeSearch(search);

    return clients
      .map((client) => {
        // Une note interne ne remplace jamais l'aperçu du dernier message.
        const local = (localMessages[client.id] ?? []).filter(
          (message) => message.senderType !== "note",
        );
        const latest = local[local.length - 1];

        const useLocal =
          latest &&
          new Date(latest.timestamp).getTime() >=
            new Date(client.lastActivityAt).getTime();

        return {
          ...client,
          aiActive: aiOverrides[client.id] ?? client.aiActive,
          resolvedAt: Object.prototype.hasOwnProperty.call(
            resolvedOverrides,
            client.id,
          )
            ? resolvedOverrides[client.id]
            : (client.resolvedAt ?? null),
          lastMessage: useLocal
            ? latest.content ||
              (latest.type === "IMAGE"
                ? "Image"
                : latest.type === "AUDIO"
                  ? "Message audio"
                  : latest.type === "VIDEO"
                    ? "Vidéo"
                    : latest.type === "DOCUMENT"
                      ? "Document"
                      : "")
            : client.lastMessage,
          lastActivityAt: useLocal ? latest.timestamp : client.lastActivityAt,
        };
      })
      .filter((client) => {
        const matchesFilter =
          filter === "all" ||
          (filter === "resolved" && !!client.resolvedAt) ||
          (filter === "ai" && !client.resolvedAt && client.aiActive) ||
          (filter === "manual" && !client.resolvedAt && !client.aiActive) ||
          (filter === "mine" &&
            !client.resolvedAt &&
            client.assignee?.id === user.id) ||
          (filter === "unassigned" && !client.resolvedAt && !client.assignee);
        const matchesTag =
          !tagFilter || !!client.tags?.some((tag) => tag.id === tagFilter);

        const matchesSearch =
          !textQuery || normalizeSearch(client.name).includes(textQuery);

        return matchesFilter && matchesTag && matchesSearch;
      })
      .sort(
        (a, b) =>
          new Date(b.lastActivityAt).getTime() -
            new Date(a.lastActivityAt).getTime() || a.id.localeCompare(b.id),
      );
  }, [
    clients,
    search,
    filter,
    tagFilter,
    aiOverrides,
    resolvedOverrides,
    localMessages,
    user.id,
  ]);

  const activeClient =
    clients.find((client) => client.id === activeId) ??
    (selectedClient?.id === activeId ? selectedClient : undefined);
  const aiActive = activeClient
    ? (aiOverrides[activeClient.id] ?? activeClient.aiActive)
    : false;
  const activeResolved = activeClient
    ? Object.prototype.hasOwnProperty.call(resolvedOverrides, activeClient.id)
      ? !!resolvedOverrides[activeClient.id]
      : !!activeClient.resolvedAt
    : false;
  const noteDraft = activeId ? (noteDrafts[activeId] ?? "") : "";

  const draft = activeId ? (drafts[activeId] ?? "") : "";
  const isSending = !!activeId && sendingIds.includes(activeId);

  const activeMessages = useMemo<DisplayMessage[]>(() => {
    if (!activeId) return [];

    const serverMessages = messages[activeId] ?? [];
    const serverIds = new Set(serverMessages.map((message) => message.id));
    const serverRequests = new Set(
      serverMessages.map((message) => message.clientRequestId).filter(Boolean),
    );

    const pendingMessages = (localMessages[activeId] ?? []).filter(
      (message) =>
        !serverIds.has(message.id) &&
        !(
          message.clientRequestId && serverRequests.has(message.clientRequestId)
        ),
    );

    return [...serverMessages, ...pendingMessages].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime() ||
        a.id.localeCompare(b.id),
    );
  }, [activeId, messages, localMessages]);

  const conversationAgents = useMemo(() => {
    const authors = new Map<string, ChatAgent>();
    for (const agent of historyQuery.agents ?? []) authors.set(agent.id, agent);
    for (const message of activeMessages) {
      if (
        message.senderType === "agent" &&
        message.agent &&
        ["sent", "delivered", "read"].includes(message.status)
      ) {
        authors.set(message.agent.id, message.agent);
      }
    }
    return [...authors.values()].sort(
      (a, b) =>
        (a.name || "").localeCompare(b.name || "") || a.id.localeCompare(b.id),
    );
  }, [historyQuery.agents, activeMessages]);

  useEffect(() => {
    const element = textareaRef.current;
    if (!element) return;

    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
  }, [draft, activeId, mobileChat]);

  const selectClientRef = useRef(selectClient);
  useEffect(() => {
    selectClientRef.current = selectClient;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (
        (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) ||
        (event.key === "/" && !typing)
      ) {
        event.preventDefault();
        setMobileChat(false);
        searchRef.current?.focus();
        return;
      }
      if (
        event.altKey &&
        (event.key === "ArrowDown" || event.key === "ArrowUp")
      ) {
        event.preventDefault();
        const index = visibleClients.findIndex(
          (client) => client.id === activeId,
        );
        const next =
          visibleClients[index + (event.key === "ArrowDown" ? 1 : -1)];
        if (next) {
          selectClientRef.current(next.id);
          contactButtonRefs.current.get(next.id)?.scrollIntoView({
            block: "nearest",
          });
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [visibleClients, activeId]);

  function selectClient(id: string) {
    setComposerMode("reply");
    const client = clients.find((item) => item.id === id);

    if (!client) return;

    setSelectedClient(client);
    setActiveId(id);
    setMobileChat(true);

    if (window.matchMedia("(min-width: 768px)").matches) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }

  function openContact() {
    if (window.matchMedia("(min-width: 80rem)").matches) setPanelOpen(true);
    else setSheetOpen(true);
  }

  // « Répondre » signifie reprendre la main : l’IA se met en pause pour ce contact.
  function changeComposerMode(mode: ComposerMode) {
    setComposerMode(mode);
    if (mode === "reply" && aiActive && canManageAi && aiBusyId === null) {
      void toggleAi();
    }
    if (mode === "reply") requestAnimationFrame(() => textareaRef.current?.focus());
  }

  const summaryOpen = !!activeClient && summaryFor === activeClient.id;
  // Résumé IA : sans fiche contact visible (mobile, écran réduit, fiche fermée),
  // placé juste après « Note interne ».
  const summaryButton = activeClient ? (
    <Button
      type="button"
      size="xs"
      variant={summaryOpen ? "default" : "ghost"}
      aria-pressed={summaryOpen}
      onClick={() =>
        setSummaryFor((current) =>
          current === activeClient.id ? null : activeClient.id,
        )
      }
      className={cn("shrink-0", panelOpen && "xl:hidden")}
    >
      <Sparkles aria-hidden="true" />
      Résumé IA
    </Button>
  ) : null;
  const composerToggle = (
    <ComposerModeToggle
      mode={composerMode}
      onChange={changeComposerMode}
      showReply={aiActive}
      extra={summaryButton}
      onNoteClose={() => {
        // Refermer une note revient à la saisie sans toucher à l’IA.
        setComposerMode("reply");
        requestAnimationFrame(() => textareaRef.current?.focus());
      }}
      hint={
        aiActive && composerMode === "reply"
          ? canManageAi
            ? "Cliquer sur « Répondre » met l’IA en pause"
            : "L’IA peut aussi répondre à ce contact"
          : undefined
      }
    />
  );

  function goBack() {
    setMobileChat(false);

    requestAnimationFrame(() => {
      if (activeId) {
        contactButtonRefs.current.get(activeId)?.focus();
      }
    });
  }

  function updateLocalMessage(
    contactId: string,
    localId: string,
    patch: Partial<
      Pick<LocalMessage, "id" | "status" | "mediaUrl" | "content">
    >,
  ) {
    setLocalMessages((previous) => ({
      ...previous,
      [contactId]: (previous[contactId] ?? []).map((message) =>
        message.localId === localId ? { ...message, ...patch } : message,
      ),
    }));
  }

  async function handleSend(content: string, attachment?: ChatAttachment) {
    if (!activeClient) return;

    const contactId = activeClient.id;
    const requestId = attachment?.requestId ?? crypto.randomUUID();
    const localId = `local-${requestId}`;
    if (
      !SendChatMessageSchema.safeParse({ content, attachment }).success ||
      sendLocks.current.has(contactId)
    ) {
      return;
    }

    if (!navigator.onLine) {
      toast.error("Vous êtes hors ligne. Votre brouillon est conservé.");
      return;
    }

    sendLocks.current.add(contactId);
    setSendingIds((previous) => [...previous, contactId]);

    const optimisticMessage: LocalMessage = {
      id: localId,
      localId,
      clientRequestId: requestId,
      senderType: "agent",
      agent: {
        id: user.id,
        name: user.name ?? null,
        image: user.image ?? null,
      },
      content:
        content ||
        (attachment?.type === "IMAGE"
          ? "Image en cours d’envoi…"
          : attachment?.type === "AUDIO"
            ? "Audio en cours d’envoi…"
            : attachment?.type === "VIDEO"
              ? "Vidéo en cours d’envoi…"
              : attachment?.type === "DOCUMENT"
                ? "Document en cours d’envoi…"
                : ""),
      type: attachment?.type,
      timestamp: new Date().toISOString(),
      status: "sending",
    };

    setDrafts((previous) => ({
      ...previous,
      [contactId]: "",
    }));

    setLocalMessages((previous) => ({
      ...previous,
      [contactId]: [...(previous[contactId] ?? []), optimisticMessage],
    }));

    setAnnouncement("Envoi du message en cours.");

    try {
      const rawResult = await sendWhatsAppMessage({
        projectId: project.id,
        contactId,
        requestId,
        content,
        attachment,
      });

      const result = parseSendResult(rawResult);
      if (result.uncertain) {
        updateLocalMessage(contactId, localId, {
          status: "uncertain",
        });

        setAnnouncement(
          "Confirmation indisponible. Le message peut avoir été envoyé.",
        );

        refresh();
        return "uncertain" as const;
      }
      if (!result.success) {
        updateLocalMessage(contactId, localId, {
          ...(result.id ? { id: result.id } : {}),
          status: "failed",
        });

        const reason = result.error || "Le message n’a pas pu être envoyé.";
        setAnnouncement(reason);
        toast.error(reason);
        // Un refus confirmé ne doit pas faire perdre le texte saisi.
        // Préserver aussi un éventuel nouveau brouillon écrit pendant l’envoi.
        setDrafts((previous) => ({
          ...previous,
          [contactId]: previous[contactId] || content,
        }));
        return;
      }

      if (!result.id) {
        // Ne pas conclure à un échec : le serveur a peut-être envoyé.
        updateLocalMessage(contactId, localId, {
          status: "uncertain",
        });

        setAnnouncement("Confirmation d’envoi indisponible.");
        refresh();
        return "uncertain" as const;
      }
      updateLocalMessage(contactId, localId, {
        id: result.id,
        // On n'invente pas de statut « distribué ».
        status: result.status,
        mediaUrl: attachment ? messageMediaPath(project.id, result.id) : null,
        content,
      });

      setAnnouncement("Réponse du serveur reçue.");
      refresh();
      return "accepted" as const;
    } catch {
      // Une rupture réseau n'est pas la preuve que l'envoi a échoué.
      updateLocalMessage(contactId, localId, {
        status: "uncertain",
      });

      setAnnouncement("Confirmation indisponible. Vérifiez avant de renvoyer.");

      toast.error("Confirmation indisponible. Actualisez avant de renvoyer.");
      return "uncertain" as const;
    } finally {
      sendLocks.current.delete(contactId);
      setSendingIds((previous) => previous.filter((id) => id !== contactId));
    }
  }

  async function toggleAi() {
    if (!activeClient || !canManageAi || aiLock.current) return;

    const contactId = activeClient.id;
    const nextState = !aiActive;

    aiLock.current = true;
    setAiBusyId(contactId);

    try {
      const result = await setContactAiState({
        projectId: project.id,
        contactId,
        enabled: nextState,
      });

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setAiOverrides((previous) => ({
        ...previous,
        [contactId]: result.enabled,
      }));

      toast.success(result.enabled ? "IA activée." : "IA désactivée.");
      refresh();
    } catch {
      toast.error(
        "Modification non confirmée. Actualisez pour vérifier le réglage.",
      );
    } finally {
      aiLock.current = false;
      setAiBusyId(null);
    }
  }

  async function toggleResolved() {
    if (!activeClient || resolveLock.current) return;

    const contactId = activeClient.id;
    const resolved = !activeResolved;
    // Dernier message réellement chargé : refus côté serveur si le client a réécrit depuis.
    const seenMessageId = lastConversationMessage(historyQuery.items)?.id;

    resolveLock.current = true;
    setResolveBusyId(contactId);

    try {
      const result = await setConversationResolvedAction({
        projectId: project.id,
        contactId,
        resolved,
        ...(resolved && seenMessageId ? { seenMessageId } : {}),
      });

      if (!result.success) {
        toast.error(result.error);
        refresh();
        return;
      }

      setResolvedOverrides((previous) => ({
        ...previous,
        [contactId]: result.resolvedAt,
      }));
      setAnnouncement(
        resolved
          ? "Conversation marquée comme résolue."
          : "Conversation rouverte.",
      );
      toast.success(
        resolved ? "Conversation résolue" : "Conversation rouverte",
        {
          description: resolved
            ? result.surveySent
              ? "Questionnaire de satisfaction envoyé au client."
              : "Elle reviendra automatiquement si le client réécrit."
            : undefined,
        },
      );
      refresh();
    } catch {
      toast.error("Modification non confirmée. Actualisez pour vérifier.");
    } finally {
      resolveLock.current = false;
      setResolveBusyId(null);
    }
  }

  async function handleAddNote(content: string) {
    if (!activeClient) return false;

    const contactId = activeClient.id;

    try {
      const result = await addInternalNoteAction({
        projectId: project.id,
        contactId,
        content,
      });

      if (!result.success) {
        toast.error(result.error);
        return false;
      }

      const note: LocalMessage = {
        ...result.note,
        localId: `note-${result.note.id}`,
        senderType: "note",
        type: "TEXT",
        status: "sent",
      };
      setLocalMessages((previous) => ({
        ...previous,
        [contactId]: [...(previous[contactId] ?? []), note],
      }));
      setAnnouncement("Note interne ajoutée.");
      void historyQuery.mutate();
      return true;
    } catch {
      toast.error("Note non confirmée. Actualisez avant de la réécrire.");
      return false;
    }
  }

  function restoreDraft(content: string) {
    if (!activeId) return;

    if ((drafts[activeId] ?? "").trim()) {
      toast.info("Un brouillon existe déjà. Il a été conservé.");
      return;
    }

    setDrafts((previous) => ({
      ...previous,
      [activeId]: content,
    }));

    textareaRef.current?.focus();
  }

  return (
    <div className="flex h-[calc(100dvh-var(--spacing)*14)] min-h-0 w-full flex-col overflow-hidden bg-background md:h-[calc(100dvh-var(--spacing)*18)]">
      {project.automationPaused && (
        <div
          role="status"
          className="flex shrink-0 items-start gap-2 border-b bg-muted px-4 py-2.5 text-sm"
        >
          <Pause aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>
            Projet en pause : l’IA ne répond à aucun contact, même si son
            réglage individuel est activé. La réactivation globale se fait dans
            les paramètres du projet.
          </p>
        </div>
      )}
      <div className="flex min-h-0 w-full flex-1 overflow-hidden">
        {/* Liste des conversations */}
        <aside
          aria-label="Conversations"
          className={cn(
            "w-full min-h-0 shrink-0 flex-col overflow-hidden border-r bg-background md:w-80 lg:w-[22rem]",
            mobileChat ? "hidden md:flex" : "flex",
          )}
        >
          <header className="space-y-3 border-b px-3 pb-3 pt-4">
            <div className="px-1">
              <p className="truncate text-xs text-muted-foreground">
                {project.name}
              </p>
              <h1 className="font-heading text-xl font-bold tracking-tight">
                Messagerie
              </h1>
              <p aria-live="polite" className="text-xs text-muted-foreground">
                {contactsQuery.unreadConversations
                  ? `${contactsQuery.unreadConversations} discussion${contactsQuery.unreadConversations > 1 ? "s" : ""} non lue${contactsQuery.unreadConversations > 1 ? "s" : ""}`
                  : "Tout est lu"}
              </p>
            </div>

            <InputGroup>
              <InputGroupInput
                ref={searchRef}
                id="chat-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setSearch("");
                }}
                placeholder="Rechercher un contact…"
                aria-label="Rechercher un contact par nom"
                autoComplete="off"
                maxLength={100}
              />
              <InputGroupAddon align="inline-start">
                <Search />
              </InputGroupAddon>
              <InputGroupAddon align="inline-end">
                {search ? (
                  <InputGroupButton
                    size="icon-xs"
                    aria-label="Effacer la recherche"
                    onClick={() => {
                      setSearch("");
                      searchRef.current?.focus();
                    }}
                  >
                    <X />
                  </InputGroupButton>
                ) : (
                  <Kbd aria-hidden="true">/</Kbd>
                )}
              </InputGroupAddon>
            </InputGroup>

            <div
              role="group"
              aria-label="Filtrer les conversations"
              className="flex flex-wrap gap-1"
            >
              {(
                [
                  ["all", "Toutes", "Toutes les conversations"],
                  [
                    "ai",
                    "Assistant IA",
                    "L’assistant répond seul à ces contacts",
                  ],
                  [
                    "manual",
                    "Équipe",
                    "Un membre de l’équipe a repris la main",
                  ],
                  [
                    "resolved",
                    "Résolues",
                    "Traitées. Elles reviennent si le client réécrit",
                  ],
                  [
                    "mine",
                    "À moi",
                    "Conversations ouvertes qui vous sont assignées",
                  ],
                  [
                    "unassigned",
                    "Non assignées",
                    "Conversations ouvertes sans responsable",
                  ],
                ] as const
              ).map(([value, label, hint]) => (
                <Tooltip key={value}>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="xs"
                      variant={filter === value ? "secondary" : "ghost"}
                      aria-pressed={filter === value}
                      onClick={() => setFilter(value)}
                      className={cn(
                        "rounded-full px-2.5",
                        filter === value
                          ? "text-foreground"
                          : "text-muted-foreground",
                      )}
                    >
                      {label}
                      {contactsQuery.filterCounts && (
                        <span
                          className={cn(
                            "ml-1 tabular-nums",
                            filter === value ? "text-foreground/70" : "text-muted-foreground/70",
                          )}
                        >
                          {contactsQuery.filterCounts[value]}
                          <span className="sr-only"> conversations</span>
                        </span>
                      )}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{hint}</TooltipContent>
                </Tooltip>
              ))}
            </div>
            <TagFilter
              tags={contactsQuery.projectTags}
              value={tagFilter}
              onChange={setTagFilter}
            />
          </header>

          <nav
            aria-label="Liste des contacts"
            aria-busy={contactsQuery.isLoading}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 pb-4"
          >
            {contactsQuery.isLoading && !visibleClients.length ? (
              <ConversationListLoading />
            ) : visibleClients.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Search
                  aria-hidden="true"
                  className="mx-auto mb-3 size-6 text-muted-foreground"
                />
                <p className="text-sm font-medium">
                  {search || filter !== "all" || tagFilter
                    ? "Aucune correspondance"
                    : "Aucune conversation"}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {search || filter !== "all" || tagFilter
                    ? "Essayez un autre nom, un numéro ou un autre filtre."
                    : "Vos contacts apparaîtront après les premiers échanges."}
                </p>
                {(search || filter !== "all" || tagFilter) && (
                  <Button
                    variant="link"
                    className="mt-3"
                    onClick={() => {
                      setSearch("");
                      setFilter("all");
                      setTagFilter(null);
                    }}
                  >
                    Voir toutes les conversations
                  </Button>
                )}
              </div>
            ) : (
              <ul className="space-y-0.5">
                {visibleClients.map((client) => {
                  const selected = activeId === client.id;
                  const hasDraft = !!drafts[client.id]?.trim();

                  return (
                    <li key={client.id}>
                      <Button
                        variant="ghost"
                        ref={(element) => {
                          if (element) {
                            contactButtonRefs.current.set(client.id, element);
                          } else {
                            contactButtonRefs.current.delete(client.id);
                          }
                        }}
                        type="button"
                        aria-current={selected ? "true" : undefined}
                        onClick={() => selectClient(client.id)}
                        className={cn(
                          "relative flex h-auto w-full items-start justify-start gap-3 whitespace-normal rounded-lg px-2.5 py-2.5 text-left font-normal",
                          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                          selected
                            ? "bg-muted hover:bg-muted"
                            : "hover:bg-muted/60",
                        )}
                      >
                        {selected && (
                          <span
                            aria-hidden="true"
                            className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-foreground"
                          />
                        )}
                        <Avatar className="size-9 shrink-0">
                          <AvatarFallback className="bg-muted font-heading text-xs font-semibold">
                            {getInitials(client.name)}
                          </AvatarFallback>
                        </Avatar>

                        <span className="min-w-0 flex-1">
                          <span className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span
                                className={cn(
                                  "truncate text-sm",
                                  client.unreadCount
                                    ? "font-semibold"
                                    : "font-medium",
                                )}
                              >
                                {client.name}
                              </span>
                              <ConversationParticipants
                                active={client.aiActive}
                                agents={client.agents ?? []}
                                loading={false}
                              />
                            </span>
                            <time
                              dateTime={client.lastActivityAt}
                              title={`${dateFormatter.format(new Date(client.lastActivityAt))} · ${timeZone}`}
                              className={cn(
                                "shrink-0 text-[11px] tabular-nums",
                                client.unreadCount
                                  ? "text-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {previewDateFormatter.format(
                                new Date(client.lastActivityAt),
                              )}
                            </time>
                          </span>

                          <span className="mt-0.5 flex items-center gap-2">
                            <span
                              className={cn(
                                "min-w-0 flex-1 truncate text-xs",
                                client.unreadCount
                                  ? "text-foreground"
                                  : "text-muted-foreground",
                              )}
                            >
                              {hasDraft ? (
                                <>
                                  <span className="font-medium text-foreground">
                                    Brouillon :{" "}
                                  </span>
                                  {drafts[client.id]}
                                </>
                              ) : (
                                client.lastMessage ||
                                "Aucun message pour le moment"
                              )}
                            </span>
                            {!!client.unreadCount && (
                              <span className="flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] tabular-nums text-primary-foreground">
                                <span aria-hidden="true">
                                  {client.unreadCount > 99
                                    ? "99+"
                                    : client.unreadCount}
                                </span>
                                <span className="sr-only">
                                  {client.unreadCount} messages non lus
                                </span>
                              </span>
                            )}
                          </span>

                          {/* Ligne de statut toujours réservée : toutes les lignes ont la même hauteur. */}
                          <span className="mt-1.5 flex h-5 min-w-0 items-center gap-1.5 overflow-hidden text-[11px] text-muted-foreground">
                              {client.waitingSince && now && (
                                <WaitingBadge since={client.waitingSince} now={now} />
                              )}
                              {client.assignee && (
                                <span
                                  className="inline-flex shrink-0 items-center gap-1"
                                  title={`Assignée à ${client.assignee.name ?? "un membre"}`}
                                >
                                  <Avatar className="size-4">
                                    <AvatarImage src={client.assignee.image || undefined} alt="" />
                                    <AvatarFallback className="text-[8px] font-semibold">
                                      {getInitials(client.assignee.name?.trim() || "Membre")}
                                    </AvatarFallback>
                                  </Avatar>
                                  <span className="sr-only">
                                    Assignée à {client.assignee.name ?? "un membre"}
                                  </span>
                                  {client.assignee.id === user.id && (
                                    <span aria-hidden="true">Vous</span>
                                  )}
                                </span>
                              )}
                              {(client.prospectClassification ===
                                "interesting" ||
                                client.prospectClassification ===
                                  "follow_up") && (
                                <InstinctBadge
                                  classification={client.prospectClassification}
                                />
                              )}
                              {client.resolvedAt && (
                                <span className="inline-flex shrink-0 items-center gap-1">
                                  <CircleCheck
                                    aria-hidden="true"
                                    className="size-3"
                                  />
                                  Résolue
                                </span>
                              )}
                              {client.tags?.[0] && (
                                <span className="min-w-0 truncate rounded-md border px-1.5 py-px">
                                  <span className="sr-only">Étiquette : </span>
                                  {client.tags[0].name}
                                  {client.tags.length > 1 && (
                                    <span className="text-muted-foreground">
                                      {" "}
                                      +{client.tags.length - 1}
                                    </span>
                                  )}
                                </span>
                              )}
                          </span>
                        </span>
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
            {contactsQuery.hasMore && (
              <Button
                type="button"
                variant="ghost"
                className="my-3 h-10 w-full rounded-xl text-xs"
                disabled={contactsQuery.isValidating}
                onClick={() => void contactsQuery.loadMore()}
              >
                {contactsQuery.isValidating
                  ? "Chargement…"
                  : "Afficher plus de contacts"}
              </Button>
            )}
          </nav>

          {(contactsQuery.error || historyQuery.error) && (
            <p
              role="status"
              className="px-4 py-3 text-xs text-muted-foreground"
            >
              Synchronisation temporairement interrompue. Les données déjà
              chargées restent affichées.
            </p>
          )}
        </aside>

        {/* Conversation active */}
        <section
          aria-label="Conversation active"
          className={cn(
            "relative min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
            mobileChat ? "flex" : "hidden md:flex",
          )}
        >
          {activeClient ? (
            <>
              <header className="chat-floating-header relative z-10 flex shrink-0 items-center gap-2 border-b border-border bg-background px-2 py-3 sm:gap-3 sm:px-5">
                <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 md:hidden"
                    onClick={goBack}
                    aria-label="Revenir aux conversations"
                  >
                    <ArrowLeft aria-hidden="true" />
                  </Button>

                  <button
                    type="button"
                    onClick={openContact}
                    aria-label={`Voir la fiche de ${activeClient.name}`}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-lg p-1 text-left outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 sm:gap-3"
                  >
                  <Avatar className="hidden size-9 shrink-0 sm:flex">
                    <AvatarFallback className="font-heading text-xs font-semibold">
                      {getInitials(activeClient.name)}
                    </AvatarFallback>
                  </Avatar>

                  <span className="block min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <h2 className="truncate text-sm font-semibold sm:text-base">
                        {activeClient.name}
                      </h2>
                      <ConversationParticipants
                        active={aiActive}
                        agents={conversationAgents}
                        loading={historyQuery.isLoading}
                      />
                    </span>
                    <span className="mt-0.5 hidden sm:flex">
                      <InstinctBadge
                        classification={activeClient.prospectClassification}
                      />
                    </span>
                  </span>
                  </button>
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
                  {canManageAi ? (
                    <div className="flex shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5">
                      {aiBusyId === activeClient.id ? (
                        <Loader2
                          aria-hidden="true"
                          className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none"
                        />
                      ) : (
                        <Bot
                          aria-hidden="true"
                          className="size-4 text-muted-foreground"
                        />
                      )}
                      <Label
                        htmlFor="chat-ai-toggle"
                        className="hidden cursor-pointer text-xs sm:block"
                      >
                        Assistant IA
                      </Label>
                      <Switch
                        id="chat-ai-toggle"
                        size="sm"
                        checked={aiActive}
                        disabled={aiBusyId !== null}
                        aria-busy={aiBusyId === activeClient.id}
                        onCheckedChange={() => void toggleAi()}
                        aria-label={
                          aiActive
                            ? "Désactiver l’IA et prendre la main sur cette conversation"
                            : "Activer l’IA pour ce contact"
                        }
                      />
                    </div>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs text-muted-foreground">
                      <Bot aria-hidden="true" className="size-3.5" />
                      {aiActive ? "IA active" : "IA en pause"}
                    </span>
                  )}
                  <ResolveConversationButton
                    resolved={activeResolved}
                    busy={resolveBusyId === activeClient.id}
                    onToggle={() => void toggleResolved()}
                  />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Plus d’actions"
                      >
                        <Ellipsis aria-hidden="true" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      {/* Grand écran : bascule la colonne ; sinon ouvre le panneau latéral. */}
                      <DropdownMenuItem
                        className="hidden xl:flex"
                        onSelect={() => setPanelOpen((value) => !value)}
                      >
                        {panelOpen ? <PanelRightClose /> : <PanelRightOpen />}
                        {panelOpen
                          ? "Masquer la fiche contact"
                          : "Afficher la fiche contact"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="xl:hidden"
                        onSelect={() => setSheetOpen(true)}
                      >
                        <UserRound />
                        Fiche contact
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() => changeComposerMode("note")}
                      >
                        <Lock />
                        Ajouter une note interne
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onSelect={() =>
                          void downloadConversation(project.id, activeClient.id)
                        }
                      >
                        <Download />
                        Exporter la conversation
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {[
                        { href: "pipeline", label: "Pipeline", icon: SquareKanban },
                        { href: "knowledge", label: "Base de connaissances de l’IA", icon: LibraryBig },
                        { href: "integrations", label: "Intégrations", icon: Plug },
                        { href: "contacts", label: "Liste de contacts", icon: BookUser },
                        { href: "team", label: "Équipe", icon: Users },
                        { href: "settings", label: "Paramètres", icon: Settings },
                      ].map(({ href, label, icon: Icon }) => (
                        <DropdownMenuItem key={href} asChild>
                          <Link href={`/projects/${project.id}/${href}`}>
                            <Icon />
                            {label}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="hidden xl:inline-flex"
                        aria-pressed={panelOpen}
                        aria-label={
                          panelOpen
                            ? "Masquer la fiche contact"
                            : "Afficher la fiche contact"
                        }
                        onClick={() => setPanelOpen((value) => !value)}
                      >
                        {panelOpen ? (
                          <PanelRightClose aria-hidden="true" />
                        ) : (
                          <PanelRightOpen aria-hidden="true" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Fiche contact</TooltipContent>
                  </Tooltip>
                </div>
              </header>

              {!summaryOpen && !activeResolved && (!aiActive || project.automationPaused) && (
                <div
                  role="status"
                  className="flex shrink-0 items-center gap-2 bg-foreground px-4 py-2 text-xs text-background"
                >
                  <Hand aria-hidden="true" className="size-3.5 shrink-0" />
                  <span className="min-w-0 flex-1">
                    {project.automationPaused
                      ? "Projet en pause : l’assistant IA ne répond à aucun contact."
                      : "Assistant IA désactivé : votre équipe répond à ce contact."}
                  </span>
                  {!project.automationPaused && canManageAi && (
                    <Button
                      type="button"
                      size="xs"
                      variant="secondary"
                      className="shrink-0"
                      disabled={aiBusyId !== null}
                      onClick={() => void toggleAi()}
                    >
                      <Bot data-icon="inline-start" />
                      Réactiver
                    </Button>
                  )}
                </div>
              )}

              {showWelcome && (
                <div className="flex items-center justify-between gap-3 border-b bg-primary/5 px-4 py-3 text-xs">
                  <span>Votre espace de conversation est prêt.</span>
                  <button
                    type="button"
                    aria-label="Fermer le message de bienvenue"
                    onClick={() => setShowWelcome(false)}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </div>
              )}

              <div className="relative min-h-0 flex-1 bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[20px_20px]">
                {summaryOpen && (
                  <ConversationSummaryView
                    key={activeClient.id}
                    projectId={project.id}
                    contactId={activeClient.id}
                    contactName={activeClient.name}
                    enabled={historyQuery.hasClientMessage}
                    onClose={() => setSummaryFor(null)}
                  />
                )}
                <MessageScrollerProvider
                  key={activeClient.id}
                  autoScroll
                  defaultScrollPosition="end"
                >
                  <MessageScroller className="h-full">
                    <MessageScrollerViewport className="px-3 py-8 sm:px-6">
                      {historyQuery.hasMore && (
                        <div className="flex justify-center">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="rounded-full text-xs"
                            disabled={historyQuery.isValidating}
                            onClick={() => void historyQuery.loadMore()}
                          >
                            {historyQuery.isValidating
                              ? "Chargement…"
                              : "Afficher les messages précédents"}
                          </Button>
                        </div>
                      )}
                      <MessageScrollerContent className="mx-auto min-h-full w-full max-w-4xl justify-end gap-5">
                        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                          Jusqu’à 50 messages récents chargés · Heure locale (
                          {timeZone})
                        </p>

                        {historyQuery.isLoading ? (
                          <ConversationMessagesLoading />
                        ) : activeMessages.length === 0 ? (
                          <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
                            <MessageCircle
                              aria-hidden="true"
                              className="mb-4 size-8 text-muted-foreground"
                            />
                            <h3 className="text-sm font-semibold">
                              Aucun message à afficher
                            </h3>
                            <p className="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
                              Envoyez un message à ce contact ou actualisez pour
                              charger les derniers échanges.
                            </p>
                          </div>
                        ) : (
                          activeMessages.map((message, index) => {
                            const day = dateFormatter.format(
                              new Date(message.timestamp),
                            );
                            const previousMessage = activeMessages[index - 1];
                            const previousDay = previousMessage
                              ? dateFormatter.format(
                                  new Date(previousMessage.timestamp),
                                )
                              : undefined;

                            return (
                              <MessageScrollerItem
                                key={
                                  "localId" in message
                                    ? message.localId
                                    : message.id
                                }
                                messageId={message.id}
                              >
                                {day !== previousDay && (
                                  <div className="mb-5 mt-2 flex justify-center">
                                    <span className="rounded-full border bg-background/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-xs backdrop-blur">
                                      {dateFormatter.format(
                                        new Date(message.timestamp),
                                      )}
                                    </span>
                                  </div>
                                )}

                                <ChatBubble
                                  message={message}
                                  grouped={
                                    day === previousDay &&
                                    !!previousMessage &&
                                    message.senderType !== "bot" &&
                                    message.senderType !== "system" &&
                                    previousMessage.senderType === message.senderType &&
                                    (previousMessage.agent?.id ?? null) ===
                                      (message.agent?.id ?? null)
                                  }
                                  animate={animatedAiIds.has(message.id)}
                                  contactName={activeClient.name}
                                  projectId={project.id}
                                  onRestore={restoreDraft}
                                />
                              </MessageScrollerItem>
                            );
                          })
                        )}
                        {aiActive &&
                          !project.automationPaused &&
                          historyQuery.generation && (
                            <MessageScrollerItem>
                              <AiThinking
                                generation={historyQuery.generation}
                              />
                            </MessageScrollerItem>
                          )}
                        <div
                          ref={readMarker}
                          aria-hidden="true"
                          className="h-1 w-full"
                        />
                      </MessageScrollerContent>
                    </MessageScrollerViewport>

                    <MessageScrollerButton
                      direction="end"
                      aria-label="Aller aux derniers messages"
                    />
                  </MessageScroller>
                </MessageScrollerProvider>
              </div>

              {/* Résumé ouvert : il occupe toute la hauteur ; le compositeur reste monté
                  (brouillon et pièce jointe conservés) mais masqué. */}
              <footer
                hidden={summaryOpen}
                className="chat-floating-composer relative z-10 shrink-0 bg-background px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pt-4"
              >
                <div className="mx-auto max-w-4xl">
                  {composerMode === "note" && (
                    <InternalNoteComposer
                      key={`note-${activeClient.id}`}
                      contactName={activeClient.name}
                      draft={noteDraft}
                      onDraftChange={(value) => {
                        setNoteDrafts((previous) => ({
                          ...previous,
                          [activeClient.id]: value,
                        }));
                      }}
                      onSubmit={handleAddNote}
                      header={composerToggle}
                    />
                  )}
                  {/* Gardé monté en mode note : pièce jointe et brouillon restent intacts. */}
                  <div hidden={composerMode === "note"}>
                    <ChatComposer
                      key={activeClient.id}
                      projectId={project.id}
                      contactId={activeClient.id}
                      assistanceEnabled={!aiActive || project.automationPaused}
                      contextVersion={
                        lastConversationMessage(activeMessages)?.id ?? ""
                      }
                      hasClientMessage={historyQuery.hasClientMessage}
                      draft={draft}
                      contactName={activeClient.name}
                      isSending={isSending}
                      textareaRef={textareaRef}
                      onDraftChange={(value) => {
                        setDrafts((previous) => ({
                          ...previous,
                          [activeClient.id]: value,
                        }));
                      }}
                      onSend={handleSend}
                      header={composerToggle}
                    />
                  </div>
                </div>
              </footer>
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <div className="mb-5 rounded-2xl border bg-muted/30 p-5">
                <MessageCircle
                  aria-hidden="true"
                  className="size-8 text-muted-foreground"
                  strokeWidth={1.5}
                />
              </div>

              <h2 className="text-xl font-semibold tracking-tight">
                Votre espace de conversation
              </h2>

              <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Consultez vos échanges, répondez à vos contacts et gérez
                l’activation de l’IA au même endroit.
              </p>
            </div>
          )}
        </section>

        {activeClient && panelOpen && (
          <aside
            aria-label="Fiche contact"
            className="hidden w-80 shrink-0 overflow-y-auto border-l bg-background xl:block"
          >
            <ChatContactPanel
              projectId={project.id}
              client={activeClient}
              aiActive={aiActive}
              resolved={activeResolved}
              automationPaused={project.automationPaused}
              agents={conversationAgents}
              hasClientMessage={historyQuery.hasClientMessage}
              lastActivityLabel={dateFormatter.format(
                new Date(activeClient.lastActivityAt),
              )}
              details={historyQuery.contact}
              canCopyPhone={canCopyPhone}
              formatDate={(iso) => dateFormatter.format(new Date(iso))}
              currentUserId={user.id}
              pipeline={pipeline}
              onContactChanged={() => void contactsQuery.mutate()}
            />
          </aside>
        )}
      </div>

      {activeClient && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent
            side="right"
            className="w-full overflow-y-auto sm:max-w-sm xl:hidden"
          >
            <SheetHeader className="sr-only">
              <SheetTitle>Fiche de {activeClient.name}</SheetTitle>
              <SheetDescription>
                Statut, Instinct IA, résumé et étiquettes du contact
              </SheetDescription>
            </SheetHeader>
            <ChatContactPanel
              projectId={project.id}
              client={activeClient}
              aiActive={aiActive}
              resolved={activeResolved}
              automationPaused={project.automationPaused}
              agents={conversationAgents}
              hasClientMessage={historyQuery.hasClientMessage}
              lastActivityLabel={dateFormatter.format(
                new Date(activeClient.lastActivityAt),
              )}
              details={historyQuery.contact}
              canCopyPhone={canCopyPhone}
              formatDate={(iso) => dateFormatter.format(new Date(iso))}
              currentUserId={user.id}
              pipeline={pipeline}
              onContactChanged={() => void contactsQuery.mutate()}
            />
          </SheetContent>
        </Sheet>
      )}

      <p
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {refreshing ? "Actualisation des conversations." : announcement}
      </p>
    </div>
  );
}
