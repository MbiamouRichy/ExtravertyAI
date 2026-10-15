"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  BarChart3,
  Bot,
  CircleCheck,
  Ellipsis,
  FileText,
  Hand,
  MessagesSquare,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Settings,
  Users,
  UsersRound,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { conversations as seed, type Conversation, type Message } from "./data";
import { ConversationList, type Filter } from "./conversation-list";
import { MessageBubble } from "./message-bubble";
import { Composer, type ComposerMode } from "./composer";
import { ContactPanel } from "./contact-panel";
import { AgentStack, ContactAvatar } from "./shared";

function nowTime() {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(
    new Date(),
  );
}

const ME = { id: "me", name: "Vous" };

let sequence = 0;
function nextId() {
  sequence += 1;
  return `local-${sequence}`;
}

function Rail({ projectId }: { projectId: string }) {
  const base = `/projects/${encodeURIComponent(projectId)}`;
  const items = [
    { label: "Messagerie", href: `${base}/chat`, icon: MessagesSquare, active: true },
    { label: "Contacts", href: `${base}/contacts`, icon: Users },
    { label: "Analytique", href: `${base}/analytics`, icon: BarChart3 },
    { label: "Rapports", href: `${base}/reports`, icon: FileText },
    { label: "Équipe", href: `${base}/team`, icon: UsersRound },
  ];
  return (
    <nav
      aria-label="Navigation du projet"
      className="hidden w-14 shrink-0 flex-col items-center gap-1 border-r bg-sidebar py-3 md:flex"
    >
      <Link
        href="/maquettes"
        className="mb-3 flex size-9 items-center justify-center rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Logo className="w-6" />
        <span className="sr-only">Toutes les maquettes</span>
      </Link>
      {items.map(({ label, href, icon: Icon, active }) => (
        <Tooltip key={label}>
          <TooltipTrigger asChild>
            <Button
              asChild
              variant={active ? "secondary" : "ghost"}
              size="icon"
              className={cn(!active && "text-muted-foreground")}
            >
              <Link href={href} aria-current={active ? "page" : undefined}>
                <Icon />
                <span className="sr-only">{label}</span>
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      ))}
      <div className="mt-auto flex flex-col items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button asChild variant="ghost" size="icon" className="text-muted-foreground">
              <Link href={`${base}/settings`}>
                <Settings />
                <span className="sr-only">Réglages</span>
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Réglages</TooltipContent>
        </Tooltip>
        <ContactAvatar name="Vous Moi" size="sm" online />
      </div>
    </nav>
  );
}

function TypingIndicator({ name }: { name: string }) {
  return (
    <li className="mt-3 flex items-center gap-2" aria-live="polite">
      <span className="flex gap-1 rounded-2xl rounded-bl-md border bg-background px-3 py-3">
        {[0, 160, 320].map((delay) => (
          <span
            key={delay}
            aria-hidden="true"
            className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
      <span className="text-[11px] text-muted-foreground">{name} écrit…</span>
    </li>
  );
}

export function ChatWorkspace({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [items, setItems] = useState<Conversation[]>(() =>
    structuredClone(seed).map((c) => (c.id === seed[0]?.id ? { ...c, unread: 0 } : c)),
  );
  const [activeId, setActiveId] = useState<string | null>(seed[0]?.id ?? null);
  const [mobileView, setMobileView] = useState<"list" | "thread">("list");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [typingId, setTypingId] = useState<string | null>(null);
  const [atBottom, setAtBottom] = useState(true);

  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const counts = useMemo<Record<Filter, number>>(
    () => ({
      all: items.length,
      pending: items.filter((c) => c.status === "pending").length,
      ai: items.filter((c) => c.status === "ai").length,
      human: items.filter((c) => c.status === "human").length,
      resolved: items.filter((c) => c.status === "resolved").length,
    }),
    [items],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("fr");
    return items.filter(
      (c) =>
        (filter === "all" || c.status === filter) &&
        (!q ||
          c.name.toLocaleLowerCase("fr").includes(q) ||
          c.phone.replace(/\s/g, "").includes(q.replace(/\s/g, "")) ||
          c.tags.some((tag) => tag.toLocaleLowerCase("fr").includes(q))),
    );
  }, [items, filter, query]);

  const active = items.find((c) => c.id === activeId) ?? null;

  const update = useCallback((id: string, fn: (c: Conversation) => Conversation) => {
    setItems((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));
  }, []);

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const select = useCallback(
    (id: string) => {
      setActiveId(id);
      setMobileView("thread");
      update(id, (c) => ({ ...c, unread: 0 }));
    },
    [update],
  );

  // Keep the newest message in view when switching threads or receiving messages.
  const messageCount = active?.messages.length ?? 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduce ? "auto" : "smooth" });
  }, [activeId, messageCount, typingId]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing)) {
        event.preventDefault();
        setMobileView("list");
        searchRef.current?.focus();
        return;
      }
      if (event.altKey && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
        event.preventDefault();
        const index = visible.findIndex((c) => c.id === activeId);
        const next = visible[index + (event.key === "ArrowDown" ? 1 : -1)];
        if (next) select(next.id);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, activeId, select]);

  function appendMessage(id: string, message: Message) {
    update(id, (c) => ({ ...c, messages: [...c.messages, message], lastActivity: message.time }));
  }

  function setDelivery(id: string, messageId: string, delivery: Message["delivery"]) {
    update(id, (c) => ({
      ...c,
      messages: c.messages.map((m) => (m.id === messageId ? { ...m, delivery } : m)),
    }));
  }

  function systemEvent(id: string, text: string) {
    appendMessage(id, {
      id: nextId(),
      author: "system",
      day: "Aujourd’hui",
      time: nowTime(),
      text,
    });
  }

  function setAi(conversation: Conversation, enabled: boolean, silent = false) {
    update(conversation.id, (c) => ({
      ...c,
      aiActive: enabled,
      status: enabled ? "ai" : "human",
    }));
    systemEvent(
      conversation.id,
      enabled ? "Assistant IA réactivé" : "Vous avez repris la main · IA en pause",
    );
    if (!silent)
      toast(enabled ? "L’assistant IA répond à nouveau" : "IA en pause pour ce contact");
  }

  function send(text: string, mode: ComposerMode) {
    if (!active) return;
    const id = active.id;
    const messageId = nextId();
    if (mode === "note") {
      appendMessage(id, { id: messageId, author: "note", day: "Aujourd’hui", time: nowTime(), text });
      return;
    }
    if (active.aiActive) setAi(active, false, true);
    else if (active.status !== "human") update(id, (c) => ({ ...c, status: "human" }));
    update(id, (c) =>
      c.agents.some((agent) => agent.id === ME.id) ? c : { ...c, agents: [...c.agents, ME] },
    );
    appendMessage(id, {
      id: messageId,
      author: "agent",
      day: "Aujourd’hui",
      time: nowTime(),
      text,
      delivery: "sending",
    });
    later(400, () => setDelivery(id, messageId, "sent"));
    later(1100, () => setDelivery(id, messageId, "delivered"));
    later(2200, () => {
      setDelivery(id, messageId, "read");
      setTypingId(id);
    });
    later(4200, () => {
      setTypingId((current) => (current === id ? null : current));
      // Un nouveau message client rouvre une conversation résolue.
      update(id, (c) => (c.status === "resolved" ? { ...c, status: "human" } : c));
      appendMessage(id, {
        id: nextId(),
        author: "contact",
        day: "Aujourd’hui",
        time: nowTime(),
        text: "Parfait, merci beaucoup 🙏",
      });
    });
  }

  function addTag(tag: string) {
    if (!active) return;
    update(active.id, (c) => ({ ...c, tags: [...c.tags, tag] }));
  }

  function removeTag(tag: string) {
    if (!active) return;
    update(active.id, (c) => ({ ...c, tags: c.tags.filter((item) => item !== tag) }));
  }

  function openContact() {
    if (window.matchMedia("(min-width: 80rem)").matches) setPanelOpen(true);
    else setSheetOpen(true);
  }

  function toggleResolved() {
    if (!active) return;
    const resolved = active.status === "resolved";
    update(active.id, (c) => ({
      ...c,
      status: resolved ? (c.aiActive ? "ai" : "human") : "resolved",
    }));
    systemEvent(active.id, resolved ? "Conversation rouverte" : "Conversation marquée comme résolue");
    toast.success(resolved ? "Conversation rouverte" : "Conversation résolue", {
      action: resolved
        ? undefined
        : {
            label: "Annuler",
            onClick: () =>
              update(active.id, (c) => ({ ...c, status: c.aiActive ? "ai" : "human" })),
          },
    });
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Rail projectId={projectId} />

      <ConversationList
        items={visible}
        counts={counts}
        activeId={activeId}
        onSelect={select}
        filter={filter}
        onFilterChange={setFilter}
        query={query}
        onQueryChange={setQuery}
        searchRef={searchRef}
        className={cn(
          "w-full md:w-80 md:shrink-0 lg:w-[22rem]",
          mobileView === "thread" && "max-md:hidden",
        )}
      />

      <main
        id="contenu"
        aria-label={active ? `Conversation avec ${active.name}` : "Conversation"}
        className={cn(
          "flex min-w-0 flex-1 flex-col",
          mobileView === "list" && "max-md:hidden",
        )}
      >
        {!active ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <MessagesSquare aria-hidden="true" className="size-8 text-muted-foreground" />
            <p className="font-heading text-lg font-semibold">Sélectionnez une conversation</p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Choisissez un contact dans la liste pour afficher l’échange.
            </p>
          </div>
        ) : (
          <>
            <header className="chat-floating-header relative z-10 flex h-16 shrink-0 items-center gap-2 border-b bg-background px-2 sm:px-4">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setMobileView("list")}
                aria-label="Retour aux conversations"
              >
                <ArrowLeft />
              </Button>
              <button
                type="button"
                onClick={openContact}
                className="flex min-w-0 items-center gap-3 rounded-lg p-1 text-left outline-none hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label={`Voir la fiche de ${active.name}`}
              >
                <ContactAvatar name={active.name} online={active.id === "c1"} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">{active.name}</span>
                    <AgentStack agents={active.agents} />
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {active.id === "c1" ? "En ligne" : `Vu · ${active.lastActivity}`} · {projectName}
                  </span>
                </span>
              </button>

              <div className="ml-auto flex items-center gap-1 sm:gap-2">
                <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1.5">
                  <Bot aria-hidden="true" className="size-4 text-muted-foreground" />
                  <Label htmlFor="ai-toggle" className="hidden cursor-pointer text-xs sm:block">
                    Assistant IA
                  </Label>
                  <Switch
                    id="ai-toggle"
                    size="sm"
                    checked={active.aiActive}
                    onCheckedChange={(checked) => setAi(active, checked)}
                    aria-label="Activer l’assistant IA pour ce contact"
                  />
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={active.status === "resolved" ? "outline" : "default"}
                      size="sm"
                      onClick={toggleResolved}
                      className="hidden sm:inline-flex"
                    >
                      {active.status === "resolved" ? <RotateCcw /> : <CircleCheck />}
                      {active.status === "resolved" ? "Rouvrir" : "Résoudre"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-64">
                    {active.status === "resolved"
                      ? "Remet la conversation dans la file active."
                      : "Classe la conversation comme traitée (filtre « Résolues »). Elle revient si le client réécrit."}
                  </TooltipContent>
                </Tooltip>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Plus d’actions">
                      <Ellipsis />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem className="sm:hidden" onSelect={toggleResolved}>
                      {active.status === "resolved" ? "Rouvrir" : "Marquer comme résolue"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setSheetOpen(true)} className="xl:hidden">
                      Fiche contact
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => toast("Maquette : export simulé")}>
                      Exporter en CSV
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="hidden xl:inline-flex"
                      aria-pressed={panelOpen}
                      aria-label={panelOpen ? "Masquer la fiche contact" : "Afficher la fiche contact"}
                      onClick={() => setPanelOpen((value) => !value)}
                    >
                      {panelOpen ? <PanelRightClose /> : <PanelRightOpen />}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Fiche contact</TooltipContent>
                </Tooltip>
              </div>
            </header>

            {active.status === "pending" && (
              <div
                role="status"
                className="flex items-center gap-2 border-b bg-foreground px-4 py-2 text-xs text-background"
              >
                <Hand aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="flex-1">
                  L’assistant a transmis cette conversation. Le client attend une réponse humaine.
                </span>
              </div>
            )}

            <div className="relative min-h-0 flex-1">
              <div
                ref={scrollRef}
                onScroll={(event) => {
                  const el = event.currentTarget;
                  setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 80);
                }}
                className="h-full overflow-y-auto bg-[radial-gradient(var(--border)_1px,transparent_1px)] bg-size-[20px_20px]"
              >
                <ol
                  aria-label="Messages"
                  className="mx-auto flex w-full max-w-3xl flex-col px-3 pb-6 pt-4 sm:px-6"
                >
                  {active.messages.map((message, index) => {
                    const prev = active.messages[index - 1];
                    const newDay = !prev || prev.day !== message.day;
                    const grouped =
                      !newDay && prev?.author === message.author && message.author !== "system";
                    return (
                      <Fragment key={message.id}>
                        {newDay && (
                          <li
                            role="presentation"
                            className="sticky top-2 z-1 my-4 flex justify-center"
                          >
                            <span className="rounded-full border bg-background/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-xs backdrop-blur">
                              {message.day}
                            </span>
                          </li>
                        )}
                        <MessageBubble message={message} grouped={grouped} />
                      </Fragment>
                    );
                  })}
                  {typingId === active.id && <TypingIndicator name={active.name.split(" ")[0]} />}
                </ol>
              </div>
              {!atBottom && (
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full shadow-md"
                  aria-label="Aller au dernier message"
                  onClick={() =>
                    scrollRef.current?.scrollTo({
                      top: scrollRef.current.scrollHeight,
                      behavior: "smooth",
                    })
                  }
                >
                  <ArrowDown />
                </Button>
              )}
            </div>

            <Composer
              key={active.id}
              conversationId={active.id}
              aiActive={active.aiActive}
              suggestions={active.suggestions}
              onSend={send}
            />
          </>
        )}
      </main>

      {active && panelOpen && (
        <aside
          aria-label="Fiche contact"
          className="hidden w-80 shrink-0 overflow-y-auto border-l bg-background xl:block"
        >
          <ContactPanel conversation={active} onAddTag={addTag} onRemoveTag={removeTag} />
        </aside>
      )}

      {active && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-sm xl:hidden">
            <SheetHeader className="sr-only">
              <SheetTitle>Fiche de {active.name}</SheetTitle>
              <SheetDescription>Résumé, étiquettes et détails du contact</SheetDescription>
            </SheetHeader>
            <ContactPanel conversation={active} onAddTag={addTag} onRemoveTag={removeTag} />
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
