"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Bot,
  CalendarClock,
  CalendarDays,
  Check,
  CircleCheck,
  Clock3,
  Copy,
  Info,
  Link2,
  Loader2,
  MessagesSquare,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { getInitials } from "@/components/getInitials";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@/components/ui/avatar";
import type { ChatAgent, ChatClient } from "@/lib/chat";
import type { ChatContactDetails } from "@/lib/contact-details";
import { revealContactPhone } from "@/app/actions/contact-phone";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  details,
  canCopyPhone,
  formatDate,
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
  details?: ChatContactDetails;
  /** Propriétaire ou administrateur : seul autorisé à copier le numéro. */
  canCopyPhone: boolean;
  formatDate: (iso: string) => string;
  onTagsChanged: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "busy" | "done">("idle");

  async function copyPhone() {
    if (copyState === "busy") return;
    setCopyState("busy");
    try {
      const result = await revealContactPhone({
        projectId,
        contactId: client.id,
      });
      if (!result.success) {
        toast.error(result.error);
        setCopyState("idle");
        return;
      }
      await navigator.clipboard.writeText(result.phone);
      setCopyState("done");
      toast.success("Numéro copié");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      toast.error("La copie est indisponible.");
      setCopyState("idle");
    }
  }

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
        <p className="mt-3 break-words font-heading text-lg font-semibold">
          {client.name}
        </p>
        {details?.maskedPhone && (
          <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            <span className="font-mono tabular-nums" aria-label="Numéro masqué">
              {details.maskedPhone}
            </span>
            {canCopyPhone && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    disabled={copyState === "busy"}
                    onClick={() => void copyPhone()}
                    aria-label="Copier le numéro complet"
                  >
                    {copyState === "busy" ? (
                      <Loader2
                        aria-hidden="true"
                        className="animate-spin motion-reduce:animate-none"
                      />
                    ) : copyState === "done" ? (
                      <Check aria-hidden="true" />
                    ) : (
                      <Copy aria-hidden="true" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copier le numéro complet</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}
      </div>

      <section
        aria-labelledby={`status-${client.id}`}
        className="space-y-3 rounded-xl border p-4"
      >
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
          <p className="flex items-center gap-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            Instinct IA
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-5"
                  aria-label="Comment fonctionne Instinct IA"
                >
                  <Info aria-hidden="true" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="max-w-60 normal-case tracking-normal">
                Recalculé après chaque nouveau message, selon les objectifs de
                votre agent.
              </TooltipContent>
            </Tooltip>
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
              {instinct === "none"
                ? "Aucun intérêt commercial détecté"
                : "Analyse en attente"}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t pt-3 text-xs">
          <span className="text-muted-foreground">Suivie par</span>
          {agents.length ? (
            <span className="flex min-w-0 items-center gap-2">
              <AvatarGroup className="shrink-0 *:data-[slot=avatar]:size-5">
                {agents.slice(0, 3).map((agent) => (
                  <Avatar
                    key={agent.id}
                    size="sm"
                    title={agent.name ?? "Agent"}
                  >
                    <AvatarImage src={agent.image || undefined} alt="" />
                    <AvatarFallback className="text-[9px] font-semibold">
                      {getInitials(agent.name?.trim() || "Agent")}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </AvatarGroup>
              <span className="truncate">
                {agents
                  .map((agent) => agent.name?.trim().split(" ")[0] || "Agent")
                  .join(", ")}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">
              {aiActive ? "Assistant IA" : "Personne pour l’instant"}
            </span>
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
          {[
            ...(details
              ? [
                  {
                    icon: CalendarDays,
                    label: "Premier contact",
                    value: formatDate(details.firstContactAt),
                  },
                  {
                    icon: MessagesSquare,
                    label: "Messages",
                    value: details.clientMessages.toLocaleString("fr-FR"),
                    hint: "Messages envoyés par ce contact",
                  },
                  {
                    icon: Link2,
                    label: "Source",
                    value: details.source,
                    hint: "Appareil de son dernier message",
                  },
                ]
              : []),
            {
              icon: CalendarClock,
              label: "Dernière activité",
              value: lastActivityLabel,
            },
            {
              icon: Bot,
              label: "Assistant IA",
              value: aiActive ? "Activé" : "En pause",
            },
          ].map(({ icon: Icon, label, value, hint }) => (
            <div
              key={label}
              className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs"
            >
              <dt
                className="flex shrink-0 items-center gap-2 text-muted-foreground"
                title={hint}
              >
                <Icon aria-hidden="true" className="size-3.5" />
                {label}
              </dt>
              <dd className="min-w-0 truncate text-right">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
