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
    useTransition,
    type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
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
    Play,
    RefreshCw,
    Search,
    Send,
    UserRound,
    X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
    type ChatMessage,
    type ChatMessageStatus,
} from "@/lib/chat";
import { cn } from "@/lib/utils";

type WorkspaceProps = {
    project: {
        id: string;
        name: string;
    };
    user: {
        id: string;
        name?: string | null;
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
    id?: string;
    status: ChatMessageStatus;
};

const MAX_MESSAGE_LENGTH = 4096;

// UTC explicite pour éviter des différences SSR/hydratation.
// Tu peux remplacer ceci par le fuseau configuré pour le projet.
const timeFormatter = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    hour: "2-digit",
    minute: "2-digit",
});

const dateFormatter = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
});

const previewDateFormatter = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
});

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
        id: typeof message?.id === "string" ? message.id : undefined,
        status: normalizeChatStatus(message?.status),
    };
}

function AiLabel({ active }: { active: boolean }) {
    const Icon = active ? Bot : UserRound;

    return (
        <span
            className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
                active
                    ? "border-primary/20 bg-primary/5 text-primary"
                    : "border-border bg-muted/50 text-muted-foreground",
            )}
        >
            <Icon aria-hidden="true" className="size-3.5" />
            {active ? "IA activée" : "IA désactivée"}
        </span>
    );
}

function DeliveryStatus({
    status,
}: {
    status: DisplayMessage["status"];
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
            className={cn(
                "inline-flex items-center gap-1",
                status === "read" && "text-sky-700 dark:text-sky-400",
                status === "failed" && "text-destructive",
                status === "uncertain" &&
                "text-amber-700 dark:text-amber-400",
            )}
        >
            <Icon
                aria-hidden="true"
                className={cn(
                    "size-3.5",
                    status === "sending" &&
                    "animate-spin motion-reduce:animate-none",
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
}: {
    message: DisplayMessage;
    contactName: string;
    onRestore: (content: string) => void;
}) {
    const incoming = message.senderType === "client";
    const failed = message.status === "failed";
    const uncertain = message.status === "uncertain";

    // Les données ne contiennent pas l'identité de l'agent :
    // on n'attribue pas tous les anciens messages à l'utilisateur courant.
    const author =
        message.senderType === "client"
            ? contactName
            : message.senderType === "bot"
                ? "Assistant IA"
                : message.senderType === "system"
                    ? "Système"
                    : "Agent";

    const date = new Date(message.timestamp);

    return (
        <article
            aria-label={`Message de ${author}`}
            className={cn(
                "flex w-full",
                incoming ? "justify-start" : "justify-end",
            )}
        >
            <div className="min-w-0 max-w-[92%] sm:max-w-[78%]">
                <div
                    className={cn(
                        "mb-1.5 flex items-center gap-1.5 px-1 text-[11px] font-medium text-muted-foreground",
                        !incoming && "justify-end",
                    )}
                >
                    {message.senderType === "bot" && (
                        <Bot aria-hidden="true" className="size-3.5" />
                    )}
                    {author}
                </div>

                <div
                    className={cn(
                        "rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
                        incoming
                            ? "rounded-tl-md border-border/70 bg-card"
                            : message.senderType === "bot"
                                ? "rounded-tr-md border-violet-500/20 bg-violet-500/5"
                                : "rounded-tr-md border-primary/15 bg-primary/5",
                        failed && "border-destructive/30 bg-destructive/5",
                        uncertain && "border-amber-500/30",
                    )}
                >
                    {/* React échappe le texte : aucun HTML brut ni faux streaming. */}
                    <p
                        dir="auto"
                        className="whitespace-pre-wrap wrap-anywhere"
                    >
                        {message.content}
                    </p>
                </div>

                <div
                    className={cn(
                        "mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 px-1 text-[10px] text-muted-foreground",
                        !incoming && "justify-end",
                    )}
                >
                    <time
                        dateTime={date.toISOString()}
                        title={`${dateFormatter.format(date)} · UTC`}
                    >
                        {timeFormatter.format(date)}
                    </time>

                    {!incoming && <DeliveryStatus status={message.status} />}
                </div>

                {uncertain && (
                    <p className="mt-2 max-w-sm text-xs leading-relaxed text-amber-700 dark:text-amber-400">
                        Actualisez avant de renvoyer : le message peut avoir
                        été accepté malgré l’absence de confirmation.
                    </p>
                )}

                {failed && (
                    <button
                        type="button"
                        onClick={() => onRestore(message.content)}
                        className="mt-2 rounded text-xs font-medium text-destructive underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        Remettre en brouillon
                    </button>
                )}
            </div>
        </article>
    );
}


export default function WhatsappWorkspace({
    project,
    user,
    isSuccess,
    canManageAi,
}: WorkspaceProps) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [selectedClient, setSelectedClient] = useState<ChatClient | null>(null);
    const [mobileChat, setMobileChat] = useState(false);

    const [search, setSearch] = useState("");
    const [filter, setFilter] = useState<Filter>("all");

    const contactsQuery = useChatContacts(project.id, search, filter);
    const historyQuery = useChatMessages(project.id, activeId);

    const clients = contactsQuery.items;

    const messages = useMemo<Record<string, ChatMessage[]>>(
        () => (activeId ? { [activeId]: historyQuery.items } : {}),
        [activeId, historyQuery.items],
    );

    function refresh() {
        void contactsQuery.mutate();
        void historyQuery.mutate();
    }

    const { connected: realtimeConnected } = useChatRealtime(
        project.id,
        refresh,
    );

    const refreshing =
        contactsQuery.isValidating || historyQuery.isValidating;

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
    const contactButtonRefs = useRef(
        new Map<string, HTMLButtonElement>(),
    );

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
                    lastMessage: useLocal
                        ? latest.content
                        : client.lastMessage,
                    lastActivityAt: useLocal
                        ? latest.timestamp
                        : client.lastActivityAt,
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
                        client.phone
                            .replace(/\D/g, "")
                            .includes(phoneQuery));

                return matchesFilter && matchesSearch;
            })
            .sort(
                (a, b) =>
                    new Date(b.lastActivityAt).getTime() -
                    new Date(a.lastActivityAt).getTime() ||
                    a.id.localeCompare(b.id),
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
        const serverIds = new Set(
            serverMessages.map((message) => message.id),
        );

        const pendingMessages = (localMessages[activeId] ?? []).filter(
            (message) => !serverIds.has(message.id),
        );

        return [...serverMessages, ...pendingMessages].sort(
            (a, b) =>
                new Date(a.timestamp).getTime() -
                new Date(b.timestamp).getTime() ||
                a.id.localeCompare(b.id),
        );
    }, [activeId, messages, localMessages]);

    useEffect(() => {
        const element = textareaRef.current;
        if (!element) return;

        element.style.height = "auto";
        element.style.height = `${Math.min(element.scrollHeight, 160)}px`;
    }, [draft, activeId, mobileChat]);

    function selectClient(id: string) {
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
                message.localId === localId
                    ? { ...message, ...patch }
                    : message,
            ),
        }));
    }

    async function handleSend(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!activeClient) return;

        const contactId = activeClient.id;
        const content = (drafts[contactId] ?? "").trim();

        if (
            !content ||
            content.length > MAX_MESSAGE_LENGTH ||
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

        const localId = `local-${crypto.randomUUID()}`;

        const optimisticMessage: LocalMessage = {
            id: localId,
            localId,
            senderType: "agent",
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
            [contactId]: [
                ...(previous[contactId] ?? []),
                optimisticMessage,
            ],
        }));

        setAnnouncement("Envoi du message en cours.");

        try {
            const rawResult: unknown = await sendWhatsAppMessage({
                projectId: project.id,
                contactId,
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

                setAnnouncement("L’envoi a échoué.");
                toast.error("Le message n’a pas pu être envoyé.");
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

            setAnnouncement(
                "Confirmation indisponible. Vérifiez avant de renvoyer.",
            );

            toast.error(
                "Confirmation indisponible. Actualisez avant de renvoyer.",
            );
        } finally {
            sendLocks.current.delete(contactId);
            setSendingIds((previous) =>
                previous.filter((id) => id !== contactId),
            );
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

            toast.success(
                result.enabled ? "IA activée." : "IA désactivée.",
            );
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
            toast.info(
                "Un brouillon existe déjà. Il a été conservé.",
            );
            return;
        }

        setDrafts((previous) => ({
            ...previous,
            [activeId]: content,
        }));

        textareaRef.current?.focus();
    }

    return (
        <div className="h-[calc(100dvh-var(--app-header-height,4rem))] min-h-0 w-full overflow-hidden bg-muted/20 p-0 sm:p-3 xl:p-5">
            <div className="mx-auto flex h-full min-h-0 w-full max-w-450 overflow-hidden border-border/70 bg-background sm:rounded-2xl sm:border sm:shadow-sm">
                {/* Liste des conversations */}
                <aside
                    aria-label="Conversations"
                    className={cn(
                        "w-full min-h-0 shrink-0 flex-col border-r border-border/70 bg-card md:w-80 xl:w-96",
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
                                        refreshing &&
                                        "animate-spin motion-reduce:animate-none",
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
                                onChange={(event) =>
                                    setSearch(event.target.value)
                                }
                                placeholder="Nom ou téléphone…"
                                className="h-10 rounded-xl bg-muted/30 pl-9 pr-10 shadow-none"
                                autoComplete="off"
                            />

                            {search && (
                                <button
                                    type="button"
                                    aria-label="Effacer la recherche"
                                    onClick={() => {
                                        setSearch("");
                                        searchRef.current?.focus();
                                    }}
                                    className="absolute right-0 top-0 flex size-10 items-center justify-center rounded-xl text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <X aria-hidden="true" className="size-4" />
                                </button>
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
                                    ["ai", "IA activée"],
                                    ["manual", "IA désactivée"],
                                ] as const
                            ).map(([value, label]) => (
                                <button
                                    key={value}
                                    type="button"
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
                                </button>
                            ))}
                        </div>
                    </header>

                    <div className="flex items-center justify-between px-5 py-3 text-[11px] text-muted-foreground">
                        <span>
                            {visibleClients.length} conversation
                            {visibleClients.length > 1 ? "s" : ""}
                        </span>
                        <span>Heures en UTC</span>
                    </div>

                    <nav
                        aria-label="Liste des contacts"
                        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3"
                    >
                        {visibleClients.length === 0 ? (
                            <div className="px-6 py-12 text-center">
                                <Search
                                    aria-hidden="true"
                                    className="mx-auto mb-3 size-6 text-muted-foreground"
                                />
                                <p className="text-sm font-medium">
                                    {clients.length === 0
                                        ? "Aucune conversation"
                                        : "Aucun résultat"}
                                </p>
                                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                                    {clients.length === 0
                                        ? "Vos contacts apparaîtront après les premiers échanges."
                                        : "Essayez un autre nom, un numéro ou un autre filtre."}
                                </p>
                            </div>
                        ) : (
                            <ul className="space-y-1">
                                {visibleClients.map((client) => {
                                    const selected = activeId === client.id;
                                    const hasDraft = !!drafts[client.id]?.trim();

                                    return (
                                        <li key={client.id}>
                                            <button
                                                ref={(element) => {
                                                    if (element) {
                                                        contactButtonRefs.current.set(
                                                            client.id,
                                                            element,
                                                        );
                                                    } else {
                                                        contactButtonRefs.current.delete(
                                                            client.id,
                                                        );
                                                    }
                                                }}
                                                type="button"
                                                aria-current={
                                                    selected ? "true" : undefined
                                                }
                                                onClick={() =>
                                                    selectClient(client.id)
                                                }
                                                className={cn(
                                                    "flex w-full items-start gap-3 rounded-xl border p-3 text-left",
                                                    "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                                                    selected
                                                        ? "border-primary/15 bg-primary/5"
                                                        : "border-transparent hover:bg-muted/50",
                                                )}
                                            >
                                                <div className="relative shrink-0">
                                                    <Avatar className="size-11 border border-border/60">
                                                        <AvatarFallback className="bg-muted text-xs font-semibold">
                                                            {initials(client.name)}
                                                        </AvatarFallback>
                                                    </Avatar>

                                                    {client.aiActive && (
                                                        <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full border-2 border-card bg-primary text-primary-foreground">
                                                            <Bot
                                                                aria-hidden="true"
                                                                className="size-3"
                                                            />
                                                            <span className="sr-only">
                                                                IA activée
                                                            </span>
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="truncate text-sm font-semibold">
                                                            {client.name}
                                                        </span>
                                                        <time
                                                            dateTime={
                                                                client.lastActivityAt
                                                            }
                                                            className="shrink-0 text-[10px] tabular-nums text-muted-foreground"
                                                        >
                                                            {previewDateFormatter.format(
                                                                new Date(
                                                                    client.lastActivityAt,
                                                                ),
                                                            )}
                                                        </time>
                                                    </div>

                                                    <p className="mt-1 truncate text-xs leading-relaxed text-muted-foreground">
                                                        {hasDraft ? (
                                                            <>
                                                                <span className="font-medium text-amber-700 dark:text-amber-400">
                                                                    Brouillon :{" "}
                                                                </span>
                                                                {drafts[client.id]}
                                                            </>
                                                        ) : (
                                                            client.lastMessage
                                                        )}
                                                    </p>
                                                </div>
                                            </button>
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

                    <footer className="flex items-center gap-2 border-t bg-muted/20 px-4 py-3 text-[11px] text-muted-foreground">
                        <span
                            aria-hidden="true"
                            className={cn(
                                "size-1.5 rounded-full",
                                realtimeConnected
                                    ? "bg-emerald-500"
                                    : "bg-amber-500",
                            )}
                        />
                        {realtimeConnected
                            ? "Mises à jour en direct"
                            : "Synchronisation automatique"}

                        {(contactsQuery.error || historyQuery.error) && (
                            <p
                                role="status"
                                className="border-b border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-800 dark:text-amber-300"
                            >
                                Synchronisation temporairement interrompue.
                                Les données déjà chargées restent affichées.
                            </p>
                        )}

                    </footer>
                </aside>

                {/* Conversation active */}
                <section
                    aria-label="Conversation active"
                    className={cn(
                        "min-h-0 min-w-0 flex-1 flex-col",
                        mobileChat ? "flex" : "hidden md:flex",
                    )}
                >
                    {activeClient ? (
                        <>
                            <header className="flex min-h-20 shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-card px-3 py-3 sm:px-5">
                                <div className="flex min-w-0 items-center gap-3">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-10 shrink-0 rounded-xl md:hidden"
                                        onClick={goBack}
                                        aria-label="Revenir aux conversations"
                                    >
                                        <ArrowLeft
                                            aria-hidden="true"
                                            className="size-5"
                                        />
                                    </Button>

                                    <Avatar className="hidden size-10 shrink-0 border sm:flex">
                                        <AvatarFallback className="text-xs font-semibold">
                                            {initials(activeClient.name)}
                                        </AvatarFallback>
                                    </Avatar>

                                    <div className="min-w-0">
                                        <h2 className="truncate text-sm font-semibold sm:text-base">
                                            {activeClient.name}
                                        </h2>

                                        <p className="mt-1 truncate text-xs tabular-nums text-muted-foreground">
                                            {activeClient.phone}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                    <div className="hidden lg:block">
                                        <AiLabel active={aiActive} />
                                    </div>

                                    {canManageAi ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={aiBusyId !== null}
                                            onClick={toggleAi}
                                            className="h-10 gap-2 rounded-xl px-3 text-xs"
                                            aria-label={
                                                aiActive
                                                    ? "Désactiver l’IA pour ce contact"
                                                    : "Activer l’IA pour ce contact"
                                            }
                                        >
                                            {aiBusyId === activeClient.id ? (
                                                <Loader2
                                                    aria-hidden="true"
                                                    className="size-4 animate-spin motion-reduce:animate-none"
                                                />
                                            ) : aiActive ? (
                                                <Pause
                                                    aria-hidden="true"
                                                    className="size-4"
                                                />
                                            ) : (
                                                <Play
                                                    aria-hidden="true"
                                                    className="size-4"
                                                />
                                            )}

                                            <span className="hidden sm:inline">
                                                {aiActive
                                                    ? "Désactiver l’IA"
                                                    : "Activer l’IA"}
                                            </span>
                                        </Button>
                                    ) : (
                                        <div className="lg:hidden">
                                            <AiLabel active={aiActive} />
                                        </div>
                                    )}
                                </div>
                            </header>

                            {showWelcome && (
                                <div className="flex items-center justify-between gap-3 border-b bg-primary/5 px-4 py-3 text-xs">
                                    <span>
                                        Votre espace de conversation est prêt.
                                    </span>
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

                            <div className="min-h-0 flex-1 bg-muted/20">
                                <MessageScrollerProvider key={activeClient.id}>
                                    <MessageScroller className="h-full">
                                        <MessageScrollerViewport className="px-3 py-5 sm:px-6">
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
                                            <MessageScrollerContent className="mx-auto min-h-full w-full max-w-4xl gap-5">
                                                <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
                                                    Jusqu’à 50 messages récents chargés
                                                    {" "}· Heures en UTC
                                                </p>

                                                {historyQuery.isLoading ? (
                                                    <div role="status" className="py-12 text-center text-sm text-muted-foreground">
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
                                                            Envoyez un message à ce contact
                                                            ou actualisez pour charger les
                                                            derniers échanges.
                                                        </p>
                                                    </div>
                                                ) : (
                                                    activeMessages.map(
                                                        (message, index) => {
                                                            const day =
                                                                message.timestamp.slice(
                                                                    0,
                                                                    10,
                                                                );
                                                            const previousDay =
                                                                activeMessages[
                                                                    index - 1
                                                                ]?.timestamp.slice(0, 10);

                                                            return (
                                                                <MessageScrollerItem
                                                                    key={
                                                                        "localId" in message
                                                                            ? message.localId
                                                                            : message.id
                                                                    }
                                                                    scrollAnchor={
                                                                        index ===
                                                                        activeMessages.length -
                                                                        1
                                                                    }
                                                                >
                                                                    {day !== previousDay && (
                                                                        <div className="mb-5 mt-2 flex justify-center">
                                                                            <span className="rounded-full border border-border/60 bg-background px-3 py-1 text-[10px] font-medium text-muted-foreground">
                                                                                {dateFormatter.format(
                                                                                    new Date(
                                                                                        message.timestamp,
                                                                                    ),
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                    )}

                                                                    <ChatBubble
                                                                        message={message}
                                                                        contactName={
                                                                            activeClient.name
                                                                        }
                                                                        onRestore={
                                                                            restoreDraft
                                                                        }
                                                                    />
                                                                </MessageScrollerItem>
                                                            );
                                                        },
                                                    )
                                                )}
                                            </MessageScrollerContent>
                                        </MessageScrollerViewport>

                                        <MessageScrollerButton
                                            direction="end"
                                            aria-label="Aller aux derniers messages"
                                        />
                                    </MessageScroller>
                                </MessageScrollerProvider>
                            </div>

                            <footer className="shrink-0 border-t border-border/70 bg-card px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-5 sm:pt-4">
                                <div className="mx-auto max-w-4xl">
                                    {aiActive && (
                                        <div className="mb-3 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-3 py-2">
                                            <Bot
                                                aria-hidden="true"
                                                className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-400"
                                            />
                                            <p className="text-xs leading-relaxed text-muted-foreground">
                                                L’IA est activée et peut également
                                                répondre à ce contact.
                                                {canManageAi &&
                                                    " Désactivez-la pour prendre la main."}
                                            </p>
                                        </div>
                                    )}

                                    <form
                                        onSubmit={handleSend}
                                        className="overflow-hidden rounded-2xl border border-border bg-background shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20"
                                    >
                                        <label
                                            htmlFor="chat-message"
                                            className="sr-only"
                                        >
                                            Message pour {activeClient.name}
                                        </label>

                                        <textarea
                                            ref={textareaRef}
                                            id="chat-message"
                                            value={draft}
                                            rows={2}
                                            maxLength={MAX_MESSAGE_LENGTH}
                                            onChange={(event) => {
                                                const value = event.target.value;

                                                setDrafts((previous) => ({
                                                    ...previous,
                                                    [activeClient.id]: value,
                                                }));
                                            }}
                                            onKeyDown={(event) => {
                                                // Entrée reste une nouvelle ligne.
                                                // Ctrl/Cmd + Entrée envoie.
                                                if (
                                                    event.key === "Enter" &&
                                                    (event.ctrlKey ||
                                                        event.metaKey) &&
                                                    !event.nativeEvent.isComposing
                                                ) {
                                                    event.preventDefault();
                                                    event.currentTarget.form?.requestSubmit();
                                                }
                                            }}
                                            placeholder="Écrire un message…"
                                            aria-describedby="chat-composer-help"
                                            className="block min-h-20 max-h-40 w-full resize-none bg-transparent px-4 pt-3 pb-2 text-base leading-relaxed outline-none placeholder:text-muted-foreground sm:text-sm"
                                        />

                                        <div className="flex items-center justify-between gap-3 px-3 pb-3">
                                            <div
                                                id="chat-composer-help"
                                                className="min-w-0 text-[10px] leading-relaxed text-muted-foreground"
                                            >
                                                <span className="hidden sm:block">
                                                    Ctrl / ⌘ + Entrée pour envoyer
                                                </span>
                                                <span className="tabular-nums">
                                                    {draft.length} /{" "}
                                                    {MAX_MESSAGE_LENGTH}
                                                </span>
                                            </div>

                                            <Button
                                                type="submit"
                                                disabled={
                                                    !draft.trim() ||
                                                    isSending ||
                                                    draft.length >
                                                    MAX_MESSAGE_LENGTH
                                                }
                                                className="h-10 shrink-0 gap-2 rounded-xl px-4"
                                            >
                                                {isSending ? (
                                                    <Loader2
                                                        aria-hidden="true"
                                                        className="size-4 animate-spin motion-reduce:animate-none"
                                                    />
                                                ) : (
                                                    <Send
                                                        aria-hidden="true"
                                                        className="size-4"
                                                    />
                                                )}
                                                {isSending
                                                    ? "Envoi…"
                                                    : "Envoyer"}
                                            </Button>
                                        </div>
                                    </form>

                                    <p className="px-1 py-2 text-[10px] leading-relaxed text-muted-foreground">
                                        Connecté en tant que {user.name || "membre"}
                                        {" "}· Brouillons conservés uniquement
                                        pendant l’ouverture de cette page.
                                    </p>
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
                                Consultez vos échanges, répondez à vos contacts
                                et gérez l’activation de l’IA au même endroit.
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
                {refreshing
                    ? "Actualisation des conversations."
                    : announcement}
            </p>
        </div>
    );
}