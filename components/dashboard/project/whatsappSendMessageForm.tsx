"use client";
import {
  useChatContacts,
  useChatMessages,
  useChatRealtime,
} from "@/hooks/use-chat-data";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ArrowLeft,
  Bot,
  Check,
  CheckCheck,
  CircleAlert,
  Clock3,
  Loader2,
  MessageCircle,
  Pause,
  RefreshCw,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageHeader,
  MessageFooter,
} from "@/components/ui/message";
import { Bubble, BubbleContent } from "@/components/ui/bubble";
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
  normalizeChatStatus,
  type ChatClient,
  type ChatAgent,
  type ChatMessage,
  type ChatMessageStatus,
} from "@/lib/chat";
import { cn } from "@/lib/utils";
import { AiResponseText, AiThinking, useLiveAiResponses } from "./ai-response";
import { ChatComposer } from "./chat-composer";
import { ConversationSummaryButton } from "./conversation-summary";
import { useConversationRead } from "@/hooks/use-conversation-read";
import { createChatDateFormatters } from "@/lib/chat-dates";
import { MessageContentSchema } from "@/lib/message-schema";

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
};

type Filter = "all" | "ai" | "manual";

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

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
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
          initials(name)
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
          className="flex size-6 items-center justify-center text-primary"
        >
          <Bot aria-hidden="true" className="size-4" />
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
        <AvatarGroup aria-label="Agents ayant répondu" className="shrink-0">
          {agents.slice(0, 2).map((agent) => (
            <AgentAvatar key={agent.id} agent={agent} small />
          ))}
          {agents.length > 2 && (
            <AvatarGroupCount
              className="size-6 text-xs"
              title={agents
                .slice(2)
                .map((agent) => agent.name || "Agent")
                .join(", ")}
            >
              <span aria-hidden="true">+{agents.length - 2}</span>
              <span className="sr-only">{agents.length - 2} autres agents</span>
            </AvatarGroupCount>
          )}
        </AvatarGroup>
      )}
    </span>
  );
}

function DeliveryStatus({ status }: { status: DisplayMessage["status"] }) {
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
      className={cn(
        "inline-flex items-center gap-1",
        status === "read" && "text-sky-700 dark:text-sky-400",
        status === "failed" && "text-destructive",
        status === "uncertain" && "text-foreground dark:text-foreground",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "size-3.5",
          status === "sending" && "animate-spin motion-reduce:animate-none",
        )}
      />
      <span>{meta.label}</span>
    </span>
  );
}

function ChatBubble({
  message,
  contactName,
  onRestore,
  animate = false,
}: {
  message: DisplayMessage;
  contactName: string;
  onRestore: (content: string) => void;
  animate?: boolean;
}) {
  const { timeFormatter, dateFormatter, timeZone } = useChatDates();
  const incoming = message.senderType === "client";
  const isAi = message.senderType === "bot";
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
          : message.agent?.name?.trim() || "Agent";

  const date = new Date(message.timestamp);

  return (
    <article
      aria-label={`Message de ${author}`}
      className={cn("flex w-full", incoming ? "justify-start" : "justify-end")}
    >
      <Message
        align={incoming ? "start" : "end"}
        className={cn(
          isAi ? "w-4/5 max-w-prose py-2" : "w-fit max-w-[92%] sm:max-w-[78%]",
        )}
      >
        {message.senderType === "agent" && (
          <MessageAvatar>
            <AgentAvatar agent={message.agent} />
          </MessageAvatar>
        )}
        <MessageContent className="gap-1.5">
          <MessageHeader
            className={cn(
              "gap-1.5 px-1 text-[11px]",
              !incoming && "justify-end",
            )}
          >
            {message.senderType === "bot" && (
              <Bot aria-hidden="true" className="size-3.5" />
            )}
            {author}
          </MessageHeader>

          {isAi ? (
            <AiResponseText content={message.content} animate={animate} />
          ) : (
            <Bubble
              align={incoming ? "start" : "end"}
              variant={failed ? "destructive" : incoming ? "muted" : "default"}
              className="max-w-full"
            >
              <BubbleContent className="rounded-2xl px-4 py-2.5">
                <p dir="auto" className="whitespace-pre-wrap wrap-anywhere">
                  {message.content}
                </p>
              </BubbleContent>
            </Bubble>
          )}

          <MessageFooter
            className={cn(
              "flex-wrap gap-x-2 gap-y-1 px-1 text-[10px] font-normal",
              !incoming && "justify-end",
            )}
          >
            <time
              dateTime={date.toISOString()}
              title={`${dateFormatter.format(date)} · ${timeZone}`}
            >
              {timeFormatter.format(date)}
            </time>

            {!incoming && <DeliveryStatus status={visualStatus} />}
          </MessageFooter>

          {uncertain && (
            <p className="mt-2 max-w-sm text-xs leading-relaxed text-foreground dark:text-foreground">
              Actualisez avant de renvoyer : le message peut avoir été accepté
              malgré l’absence de confirmation.
            </p>
          )}

          {failed && (
            <Button
              type="button"
              variant="link"
              onClick={() => onRestore(message.content)}
              className="h-auto self-start whitespace-normal p-0 text-xs text-destructive"
            >
              Remettre en brouillon
            </Button>
          )}
        </MessageContent>
      </Message>
    </article>
  );
}

export default function WhatsappWorkspace({
  project,
  user,
  isSuccess,
  canManageAi,
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
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [conversationElement, setConversationElement] =
    useState<HTMLElement | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const contactsQuery = useChatContacts(project.id, search, filter);
  const historyQuery = useChatMessages(project.id, activeId);
  const animatedAiIds = useLiveAiResponses(
    activeId,
    historyQuery.items,
    !!historyQuery.data,
  );

  const readMarker = useConversationRead({
    projectId: project.id,
    contactId: activeId,
    messageId: historyQuery.items.at(-1)?.id,
    enabled: !summaryOpen && !historyQuery.error,
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

        const remaining = entries.filter(
          (message) => !serverIds.has(message.id),
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
    const phoneQuery = search.replace(/\D/g, "");

    return clients
      .map((client) => {
        const local = localMessages[client.id] ?? [];
        const latest = local[local.length - 1];

        const useLocal =
          latest &&
          new Date(latest.timestamp).getTime() >=
            new Date(client.lastActivityAt).getTime();

        return {
          ...client,
          aiActive: aiOverrides[client.id] ?? client.aiActive,
          lastMessage: useLocal ? latest.content : client.lastMessage,
          lastActivityAt: useLocal ? latest.timestamp : client.lastActivityAt,
        };
      })
      .filter((client) => {
        const matchesFilter =
          filter === "all" ||
          (filter === "ai" && client.aiActive) ||
          (filter === "manual" && !client.aiActive);

        const matchesSearch =
          !textQuery ||
          normalizeSearch(client.name).includes(textQuery) ||
          normalizeSearch(client.phone).includes(textQuery) ||
          (phoneQuery.length > 0 &&
            client.phone.replace(/\D/g, "").includes(phoneQuery));

        return matchesFilter && matchesSearch;
      })
      .sort(
        (a, b) =>
          new Date(b.lastActivityAt).getTime() -
            new Date(a.lastActivityAt).getTime() || a.id.localeCompare(b.id),
      );
  }, [clients, search, filter, aiOverrides, localMessages]);

  const activeClient =
    clients.find((client) => client.id === activeId) ??
    (selectedClient?.id === activeId ? selectedClient : undefined);
  const aiActive = activeClient
    ? (aiOverrides[activeClient.id] ?? activeClient.aiActive)
    : false;

  const draft = activeId ? (drafts[activeId] ?? "") : "";
  const isSending = !!activeId && sendingIds.includes(activeId);

  const activeMessages = useMemo<DisplayMessage[]>(() => {
    if (!activeId) return [];

    const serverMessages = messages[activeId] ?? [];
    const serverIds = new Set(serverMessages.map((message) => message.id));

    const pendingMessages = (localMessages[activeId] ?? []).filter(
      (message) => !serverIds.has(message.id),
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

  function selectClient(id: string) {
    setSummaryOpen(false);
    const client = clients.find((item) => item.id === id);

    if (!client) return;

    setSelectedClient(client);
    setActiveId(id);
    setMobileChat(true);

    if (window.matchMedia("(min-width: 768px)").matches) {
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  }

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
    patch: Partial<Pick<LocalMessage, "id" | "status">>,
  ) {
    setLocalMessages((previous) => ({
      ...previous,
      [contactId]: (previous[contactId] ?? []).map((message) =>
        message.localId === localId ? { ...message, ...patch } : message,
      ),
    }));
  }

  async function handleSend(content: string) {
    if (!activeClient) return;

    const contactId = activeClient.id;
    const requestId = crypto.randomUUID();
    const localId = `local-${requestId}`;
    if (
      !MessageContentSchema.safeParse(content).success ||
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
      senderType: "agent",
      agent: {
        id: user.id,
        name: user.name ?? null,
        image: user.image ?? null,
      },
      content,
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
        return;
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
        return;
      }

      updateLocalMessage(contactId, localId, {
        id: result.id,
        // On n'invente pas de statut « distribué ».
        status: result.status,
      });

      setAnnouncement("Réponse du serveur reçue.");
      refresh();
    } catch {
      // Une rupture réseau n'est pas la preuve que l'envoi a échoué.
      updateLocalMessage(contactId, localId, {
        status: "uncertain",
      });

      setAnnouncement("Confirmation indisponible. Vérifiez avant de renvoyer.");

      toast.error("Confirmation indisponible. Actualisez avant de renvoyer.");
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
          className="mb-3 flex shrink-0 items-start gap-2 rounded-xl border bg-muted p-3 text-sm"
        >
          <Pause aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>
            Projet en pause : l’IA ne répond à aucun contact, même si son
            réglage individuel est activé. La réactivation globale se fait dans
            les paramètres du projet.
          </p>
        </div>
      )}
      <div className="flex min-h-0 w-full flex-1 gap-3 overflow-hidden p-3">
        {/* Liste des conversations */}
        <aside
          aria-label="Conversations"
          className={cn(
            "w-full min-h-0 shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card md:w-80 xl:w-96",
            mobileChat ? "hidden md:flex" : "flex",
          )}
        >
          <header className="space-y-4 border-b border-border/70 p-4 xl:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-muted-foreground">
                  {project.name}
                </p>
                <h1 className="mt-1 text-xl font-semibold tracking-tight">
                  Conversations
                </h1>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 shrink-0 rounded-xl"
                disabled={refreshing}
                aria-label="Actualiser les conversations"
                onClick={refresh}
              >
                <RefreshCw
                  aria-hidden="true"
                  className={cn(
                    "size-4",
                    refreshing && "animate-spin motion-reduce:animate-none",
                  )}
                />
              </Button>
            </div>

            <div className="relative">
              <label htmlFor="chat-search" className="sr-only">
                Rechercher par nom ou téléphone
              </label>

              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground"
              />

              <Input
                ref={searchRef}
                id="chat-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nom ou téléphone…"
                className="h-10 rounded-xl bg-muted/30 pl-9 pr-10 shadow-none"
                autoComplete="off"
              />

              {search && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Effacer la recherche"
                  onClick={() => {
                    setSearch("");
                    searchRef.current?.focus();
                  }}
                  className="absolute right-0 top-0 flex size-10 items-center justify-center rounded-xl text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X aria-hidden="true" className="size-4" />
                </Button>
              )}
            </div>

            <div
              role="group"
              aria-label="Filtrer les conversations"
              className="flex gap-1 rounded-xl bg-muted/50 p-1"
            >
              {(
                [
                  ["all", "Toutes"],
                  ["ai", "Assistant IA"],
                  ["manual", "Équipe"],
                ] as const
              ).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant="ghost"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={cn(
                    "min-h-9 flex-1 rounded-lg px-2 text-xs font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                    filter === value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {label}
                </Button>
              ))}
            </div>
          </header>

          <div className="flex items-center justify-between px-4 py-3 text-xs text-muted-foreground">
            <span className="font-medium">Discussions récentes</span>
            <span aria-live="polite">
              {visibleClients.length} conversation
              {visibleClients.length > 1 ? "s" : ""}
            </span>
          </div>

          <nav
            aria-label="Liste des contacts"
            aria-busy={contactsQuery.isLoading}
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-4"
          >
            {contactsQuery.isLoading && !visibleClients.length ? (
              <div role="status" className="space-y-3 p-2">
                <span className="sr-only">Chargement des conversations…</span>
                {[0, 1, 2].map((index) => (
                  <div key={index} className="flex items-center gap-3 py-2">
                    <Skeleton className="size-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-2/3" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : visibleClients.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <Search
                  aria-hidden="true"
                  className="mx-auto mb-3 size-6 text-muted-foreground"
                />
                <p className="text-sm font-medium">
                  {search || filter !== "all"
                    ? "Aucune correspondance"
                    : "Aucune conversation"}
                </p>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {search || filter !== "all"
                    ? "Essayez un autre nom, un numéro ou un autre filtre."
                    : "Vos contacts apparaîtront après les premiers échanges."}
                </p>
                {(search || filter !== "all") && (
                  <Button
                    variant="link"
                    className="mt-3"
                    onClick={() => {
                      setSearch("");
                      setFilter("all");
                    }}
                  >
                    Voir toutes les conversations
                  </Button>
                )}
              </div>
            ) : (
              <ul className="space-y-2">
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
                          "flex h-auto w-full items-start justify-start gap-3 whitespace-normal rounded-lg border border-l-2 p-3 text-left",
                          "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                          selected
                            ? "border-border border-l-primary bg-accent text-accent-foreground hover:bg-accent"
                            : "border-transparent hover:border-border hover:bg-muted/50",
                        )}
                      >
                        <div className="relative shrink-0">
                          <Avatar className="size-10 border border-border/60">
                            <AvatarFallback className="bg-muted text-xs font-semibold">
                              {initials(client.name)}
                            </AvatarFallback>
                          </Avatar>
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-1.5">
                              <span className="truncate text-sm font-semibold">
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
                              title={`${new Date(client.lastActivityAt).toISOString()} (UTC)`}
                              className="shrink-0 text-[10px] tabular-nums text-muted-foreground"
                            >
                              {previewDateFormatter.format(
                                new Date(client.lastActivityAt),
                              )}
                            </time>
                          </div>

                          <span className="mt-1 flex items-center gap-2">
                            <span className="line-clamp-2 min-w-0 flex-1 wrap-anywhere text-xs font-normal leading-relaxed text-muted-foreground">
                              {hasDraft ? (
                                <>
                                  <span className="font-medium text-foreground dark:text-foreground">
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
                              <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground">
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
                        </div>
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
          ref={setConversationElement}
          aria-label="Conversation active"
          className={cn(
            "relative min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border",
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
                    className="size-11 shrink-0 md:hidden"
                    onClick={goBack}
                    aria-label="Revenir aux conversations"
                  >
                    <ArrowLeft aria-hidden="true" className="size-5" />
                  </Button>

                  <Avatar className="hidden size-10 shrink-0 border sm:flex">
                    <AvatarFallback className="text-xs font-semibold">
                      {initials(activeClient.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <h2 className="truncate text-sm font-semibold sm:text-base">
                        {activeClient.name}
                      </h2>
                      <ConversationParticipants
                        active={aiActive}
                        agents={conversationAgents}
                        loading={historyQuery.isLoading}
                      />
                    </div>

                    <p className="mt-1 truncate text-xs tabular-nums text-muted-foreground">
                      {activeClient.phone}
                    </p>
                  </div>
                </div>

                <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
                  <ConversationSummaryButton
                    onOpenChange={setSummaryOpen}
                    key={activeClient.id}
                    projectId={project.id}
                    contactId={activeClient.id}
                    contactName={activeClient.name}
                    enabled={historyQuery.hasClientMessage}
                    container={conversationElement}
                  />
                  {canManageAi && (
                    <Button
                      type="button"
                      variant={aiActive ? "secondary" : "outline"}
                      aria-pressed={aiActive}
                      title={aiActive ? "Prendre la main" : "Activer l’IA"}
                      disabled={aiBusyId !== null}
                      aria-busy={aiBusyId === activeClient.id}
                      onClick={toggleAi}
                      className="size-11 gap-2 p-0 text-sm font-medium xl:w-auto xl:px-3"
                      aria-label={
                        aiActive
                          ? "Prendre la main sur cette conversation"
                          : "Activer l’IA pour ce contact"
                      }
                    >
                      <span className="hidden xl:inline">
                        {aiActive ? "Prendre la main" : "Activer l’IA"}
                      </span>
                      {aiBusyId === activeClient.id ? (
                        <Loader2
                          aria-hidden="true"
                          className="size-4 animate-spin motion-reduce:animate-none"
                        />
                      ) : aiActive ? (
                        <Pause aria-hidden="true" className="size-4" />
                      ) : (
                        <Bot aria-hidden="true" className="size-4" />
                      )}
                    </Button>
                  )}
                </div>
              </header>

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

              <div className="min-h-0 flex-1 bg-background">
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
                          <div
                            role="status"
                            className="py-12 text-center text-sm text-muted-foreground"
                          >
                            Chargement de la conversation…
                          </div>
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
                                    <span className="rounded-full border border-border/60 bg-background px-3 py-1 text-[10px] font-medium text-muted-foreground">
                                      {dateFormatter.format(
                                        new Date(message.timestamp),
                                      )}
                                    </span>
                                  </div>
                                )}

                                <ChatBubble
                                  message={message}
                                  animate={animatedAiIds.has(message.id)}
                                  contactName={activeClient.name}
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

              <footer className="chat-floating-composer relative z-10 shrink-0 bg-background px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pt-4">
                <div className="mx-auto max-w-4xl">
                  {aiActive && (
                    <div className="mb-3 flex items-start gap-2 rounded-xl border border-border/20 bg-primary/5 px-3 py-2">
                      <Bot
                        aria-hidden="true"
                        className="mt-0.5 size-4 shrink-0 text-foreground dark:text-foreground"
                      />
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        L’IA est activée et peut également répondre à ce
                        contact.
                        {canManageAi &&
                          " Cliquez sur « Prendre la main » pour répondre."}
                      </p>
                    </div>
                  )}

                  <ChatComposer
                    key={activeClient.id}
                    projectId={project.id}
                    contactId={activeClient.id}
                    assistanceEnabled={!aiActive || project.automationPaused}
                    contextVersion={activeMessages.at(-1)?.id ?? ""}
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
                  />
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
      </div>

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
