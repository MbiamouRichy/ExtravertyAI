"use client";

import type { RefObject } from "react";
import { Bot, Hand, Inbox, Mic, Image as ImageIcon, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import type { Conversation, ConversationStatus, Message } from "./data";
import { AgentStack, ContactAvatar, InstinctBadge } from "./shared";

export type Filter = "all" | ConversationStatus;

const filters: { id: Filter; label: string; hint: string }[] = [
  { id: "all", label: "Toutes", hint: "Toutes les conversations du projet" },
  { id: "pending", label: "À traiter", hint: "Transmises par l’IA : un humain doit répondre" },
  { id: "ai", label: "IA", hint: "L’assistant répond seul à ces contacts" },
  { id: "human", label: "Équipe", hint: "Un membre de l’équipe a repris la main" },
  { id: "resolved", label: "Résolues", hint: "Traitées. Elles reviennent si le client réécrit" },
];

function previewOf(message: Message | undefined) {
  if (!message) return { prefix: "", text: "Aucun message" };
  const prefix =
    message.author === "ai"
      ? "IA : "
      : message.author === "agent"
        ? "Vous : "
        : message.author === "note"
          ? "Note : "
          : "";
  if (message.kind === "voice")
    return { prefix, text: `Note vocale · ${message.duration}`, icon: Mic };
  if (message.kind === "image") return { prefix, text: "Photo", icon: ImageIcon };
  return { prefix, text: message.text };
}

export function ConversationList({
  items,
  counts,
  activeId,
  onSelect,
  filter,
  onFilterChange,
  query,
  onQueryChange,
  searchRef,
  className,
}: {
  items: Conversation[];
  counts: Record<Filter, number>;
  activeId: string | null;
  onSelect: (id: string) => void;
  filter: Filter;
  onFilterChange: (filter: Filter) => void;
  query: string;
  onQueryChange: (value: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
  className?: string;
}) {
  return (
    <section
      aria-label="Conversations"
      className={cn("flex min-h-0 flex-col border-r bg-background", className)}
    >
      <div className="space-y-3 border-b px-3 pb-3 pt-4">
        <div className="flex items-center justify-between px-1">
          <div>
            <h1 className="font-heading text-xl font-bold tracking-tight">Messagerie</h1>
            <p className="text-xs text-muted-foreground">
              {counts.pending} à traiter · {counts.ai} gérées par l’IA
            </p>
          </div>
        </div>

        <InputGroup>
          <InputGroupInput
            ref={searchRef}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") onQueryChange("");
            }}
            placeholder="Rechercher un contact…"
            aria-label="Rechercher une conversation"
            autoComplete="off"
            maxLength={80}
          />
          <InputGroupAddon align="inline-start">
            <Search />
          </InputGroupAddon>
          <InputGroupAddon align="inline-end">
            {query ? (
              <InputGroupButton
                size="icon-xs"
                aria-label="Effacer la recherche"
                onClick={() => onQueryChange("")}
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
          className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]"
        >
          {filters.map((item) => (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
            <Button
              variant={filter === item.id ? "secondary" : "ghost"}
              size="xs"
              aria-pressed={filter === item.id}
              onClick={() => onFilterChange(item.id)}
              className={cn(
                "shrink-0 rounded-full px-2.5",
                filter === item.id ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {item.label}
              <span className="font-mono text-[10px] tabular-nums opacity-60">
                {counts[item.id]}
              </span>
            </Button>
              </TooltipTrigger>
              <TooltipContent>{item.hint}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
            <span className="flex size-10 items-center justify-center rounded-xl border bg-muted/50">
              <Inbox aria-hidden="true" className="size-5 text-muted-foreground" />
            </span>
            <div>
              <p className="text-sm font-medium">Aucune conversation</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {query
                  ? "Essayez un autre nom ou numéro."
                  : "Rien à afficher pour ce filtre."}
              </p>
            </div>
            {(query || filter !== "all") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onQueryChange("");
                  onFilterChange("all");
                }}
              >
                Réinitialiser
              </Button>
            )}
          </div>
        ) : (
          <ul className="space-y-0.5 p-1.5">
            {items.map((conversation) => {
              const last = conversation.messages.at(-1);
              const preview = previewOf(last);
              const PreviewIcon = preview.icon;
              const active = conversation.id === activeId;
              const unread = conversation.unread > 0;
              return (
                <li key={conversation.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(conversation.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "group relative flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left outline-none transition-colors",
                      "hover:bg-muted/70 focus-visible:ring-3 focus-visible:ring-ring/50",
                      active && "bg-muted",
                    )}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-foreground"
                      />
                    )}
                    <ContactAvatar name={conversation.name} online={conversation.id === "c1"} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span
                            className={cn(
                              "truncate text-sm",
                              unread ? "font-semibold" : "font-medium",
                            )}
                          >
                            {conversation.name}
                          </span>
                          <AgentStack agents={conversation.agents} />
                        </span>
                        <span
                          className={cn(
                            "shrink-0 text-[11px] tabular-nums",
                            unread ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {conversation.lastActivity}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span
                          className={cn(
                            "flex min-w-0 flex-1 items-center gap-1 truncate text-xs",
                            unread ? "text-foreground" : "text-muted-foreground",
                          )}
                        >
                          {preview.prefix && (
                            <span className="shrink-0 text-muted-foreground">{preview.prefix}</span>
                          )}
                          {PreviewIcon && (
                            <PreviewIcon aria-hidden="true" className="size-3 shrink-0" />
                          )}
                          <span className="truncate">{preview.text}</span>
                        </span>
                        {unread && (
                          <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 font-mono text-[10px] text-primary-foreground">
                            {conversation.unread}
                            <span className="sr-only"> non lus</span>
                          </span>
                        )}
                      </span>
                      <span className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <InstinctBadge instinct={conversation.instinct} />
                        {conversation.status === "pending" && (
                          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border border-foreground/40 px-1.5 font-medium text-foreground">
                            <Hand aria-hidden="true" className="size-3" />
                            À traiter
                          </span>
                        )}
                        {conversation.aiActive && conversation.status !== "resolved" && (
                          <span className="inline-flex items-center gap-1">
                            <Bot aria-hidden="true" className="size-3" />
                            IA
                          </span>
                        )}
                        {conversation.tags[0] && (
                          <span className="truncate">· {conversation.tags[0]}</span>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
