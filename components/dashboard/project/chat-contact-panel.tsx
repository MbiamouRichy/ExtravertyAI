"use client";

import { Bot, CalendarClock, CircleCheck, Clock3, Sparkles, UsersRound } from "lucide-react";

import { getInitials } from "@/components/getInitials";
import { Avatar, AvatarFallback, AvatarGroup, AvatarImage } from "@/components/ui/avatar";
import type { ChatAgent, ChatClient } from "@/lib/chat";
import { cn } from "@/lib/utils";
import { ConversationSummaryCard } from "./conversation-summary";
import { ContactTagsEditor } from "./chat-workflow";

function statusOf({
  resolved,
  aiActive,
  automationPaused,
}: {
  resolved: boolean;
  aiActive: boolean;
  automationPaused: boolean;
}) {
  if (resolved)
    return {
      icon: CircleCheck,
      label: "Résolue",
      hint: "Conversation traitée. Elle redeviendra active si le client réécrit.",
    };
  if (aiActive && automationPaused)
    return {
      icon: Bot,
      label: "IA en pause (projet)",
      hint: "Le projet est en pause : l’assistant ne répond à aucun contact.",
    };
  if (aiActive)
    return {
      icon: Bot,
      label: "Gérée par l’IA",
      hint: "L’assistant répond seul à ce contact. Cliquez sur « Répondre » pour reprendre la main.",
    };
  return {
    icon: UsersRound,
    label: "Prise en main",
    hint: "Votre équipe gère la conversation, l’assistant est en pause pour ce contact.",
  };
}

export function ChatContactPanel({
  projectId,
  client,
  aiActive,
  resolved,
  automationPaused,
  agents,
  hasClientMessage,
  lastActivityLabel,
  onTagsChanged,
}: {
  projectId: string;
  client: ChatClient;
  aiActive: boolean;
  resolved: boolean;
  automationPaused: boolean;
  agents: ChatAgent[];
  hasClientMessage: boolean;
  lastActivityLabel: string;
  onTagsChanged: () => void;
}) {
  const status = statusOf({ resolved, aiActive, automationPaused });
  const StatusIcon = status.icon;
  const instinct = client.prospectClassification;

  return (
    <div className="flex flex-col gap-6 p-5">
      <div className="flex flex-col items-center text-center">
        <Avatar className="size-16">
          <AvatarFallback className="font-heading text-lg font-semibold">
            {getInitials(client.name)}
          </AvatarFallback>
        </Avatar>
        <p className="mt-3 break-words font-heading text-lg font-semibold">{client.name}</p>
      </div>

      <section aria-labelledby={`status-${client.id}`} className="space-y-3 rounded-xl border p-4">
        <div>
          <h2
            id={`status-${client.id}`}
            className="flex items-center gap-1.5 font-mono text-[11px] font-normal uppercase tracking-wider text-muted-foreground"
          >
            <StatusIcon aria-hidden="true" className="size-3.5" />
            Statut · {status.label}
          </h2>
          <p className="mt-1 text-xs leading-relaxed">{status.hint}</p>
        </div>

        <div className="border-t pt-3">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Instinct IA
          </p>
          {instinct === "interesting" || instinct === "follow_up" ? (
            <span
              className={cn(
                "mt-1.5 inline-flex items-center gap-1 rounded-sm px-1.5 py-px text-xs",
                instinct === "interesting"
                  ? "bg-primary font-medium text-primary-foreground"
                  : "border text-muted-foreground",
              )}
            >
              {instinct === "interesting" ? (
                <Sparkles aria-hidden="true" className="size-3" />
              ) : (
                <Clock3 aria-hidden="true" className="size-3" />
              )}
              {instinct === "interesting" ? "Prospect intéressant" : "À suivre"}
            </span>
          ) : (
            <p className="mt-1.5 text-xs text-muted-foreground">
              {instinct === "none" ? "Aucun intérêt commercial détecté" : "Analyse en attente"}
            </p>
          )}
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            Recalculé après chaque nouveau message, selon les objectifs de votre agent.
          </p>
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-3 text-xs">
          <span className="text-muted-foreground">Suivie par</span>
          {agents.length ? (
            <span className="flex min-w-0 items-center gap-2">
              <AvatarGroup className="shrink-0 *:data-[slot=avatar]:size-5">
                {agents.slice(0, 3).map((agent) => (
                  <Avatar key={agent.id} size="sm" title={agent.name ?? "Agent"}>
                    <AvatarImage src={agent.image || undefined} alt="" />
                    <AvatarFallback className="text-[9px] font-semibold">
                      {getInitials(agent.name?.trim() || "Agent")}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </AvatarGroup>
              <span className="truncate">
                {agents.map((agent) => agent.name?.trim().split(" ")[0] || "Agent").join(", ")}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">{aiActive ? "Assistant IA" : "Personne pour l’instant"}</span>
          )}
        </div>
      </section>

      <ConversationSummaryCard
        key={`summary-${client.id}`}
        projectId={projectId}
        contactId={client.id}
        enabled={hasClientMessage}
      />

      <ContactTagsEditor
        key={`tags-${client.id}`}
        projectId={projectId}
        contactId={client.id}
        contactName={client.name}
        tags={client.tags ?? []}
        onChanged={onTagsChanged}
      />

      <section aria-labelledby={`details-${client.id}`}>
        <h2
          id={`details-${client.id}`}
          className="mb-2 font-mono text-[11px] font-normal uppercase tracking-wider text-muted-foreground"
        >
          Détails
        </h2>
        <dl className="divide-y rounded-xl border">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <CalendarClock aria-hidden="true" className="size-3.5" />
              Dernière activité
            </dt>
            <dd className="truncate text-right">{lastActivityLabel}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs">
            <dt className="flex items-center gap-2 text-muted-foreground">
              <Bot aria-hidden="true" className="size-3.5" />
              Assistant IA
            </dt>
            <dd>{aiActive ? "Activé" : "En pause"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
