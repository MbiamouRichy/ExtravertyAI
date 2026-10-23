"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Bot,
  CalendarClock,
  CalendarDays,
  Check,
  CircleCheck,
  Clock3,
  Copy,
  Download,
  Info,
  Link2,
  Loader2,
  MessagesSquare,
  Moon,
  Sparkles,
  Sunrise,
  UsersRound,
} from "lucide-react";

import { getInitials } from "@/components/getInitials";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@/components/ui/avatar";
import type { ChatAgent, ChatClient, ChatTag } from "@/lib/chat";
import type { ChatContactDetails } from "@/lib/contact-details";
import { revealContactPhone } from "@/app/actions/contact-phone";
import { wakeAssistantAction } from "@/app/actions/ai-quiet";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ConversationSummaryCard } from "./conversation-summary";
import { downloadConversation } from "./export-conversation";
import { ContactTagsEditor } from "./chat-workflow";
import { AssigneePicker } from "./assignee-picker";
import { ContactPipelineSection } from "./pipeline-controls";

function statusOf({
  resolved,
  aiActive,
  automationPaused,
  quiet,
}: {
  resolved: boolean;
  aiActive: boolean;
  automationPaused: boolean;
  quiet: boolean;
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
  if (aiActive && quiet)
    return {
      icon: Moon,
      label: "IA en veille",
      hint: "Conversation terminée : l’assistant ne répond plus aux simples « merci » ou « d’accord ». Il reprend dès que le client pose une vraie question.",
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
  currentUserId,
  pipeline,
  onContactChanged,
  projectTags = [],
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
  currentUserId: string;
  pipeline?: { enabled: boolean; currency: string };
  /** Rafraîchit la liste après une modification (étiquettes, assignation). */
  onContactChanged: () => void;
  /** Étiquettes du projet, proposées à l’ajout. */
  projectTags?: Array<ChatTag & { count: number }>;
}) {
  const [copyState, setCopyState] = useState<"idle" | "busy" | "done">("idle");
  const [exporting, setExporting] = useState(false);

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

  // Hidden at once after a wake-up; a later quiet period has another date.
  const [wokenAt, setWokenAt] = useState<string | null>(null);
  const [waking, startWaking] = useTransition();
  const quiet =
    !!client.aiQuietSince && client.aiQuietSince !== wokenAt && !automationPaused;

  function wake() {
    const since = client.aiQuietSince ?? null;
    startWaking(async () => {
      const result = await wakeAssistantAction({ projectId, contactId: client.id });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setWokenAt(since);
      onContactChanged();
      toast.success("L’IA répondra au prochain message du client");
    });
  }

  const status = statusOf({ resolved, aiActive, automationPaused, quiet });
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
          {quiet && aiActive && !resolved && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={waking}
              onClick={wake}
            >
              {waking ? (
                <Loader2
                  data-icon="inline-start"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <Sunrise data-icon="inline-start" />
              )}
              Réveiller l’IA
            </Button>
          )}
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

        <div className="border-t pt-3">
          <AssigneePicker
            key={`assignee-${client.id}`}
            projectId={projectId}
            contactId={client.id}
            contactName={client.name}
            currentUserId={currentUserId}
            assignee={client.assignee ?? null}
            onChanged={onContactChanged}
          />
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

      {/* The stage is unknown until the conversation list has loaded:
          never show a default « Nouveau » that may be wrong. */}
      {pipeline?.enabled && client.pipelineStage && (
        <ContactPipelineSection
          key={`pipeline-${client.id}`}
          projectId={projectId}
          contactId={client.id}
          stage={client.pipelineStage}
          dealValue={client.dealValue ?? null}
          currency={pipeline.currency}
          onChanged={onContactChanged}
        />
      )}

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
        projectTags={projectTags}
        onChanged={onContactChanged}
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
        {/* Ligne d’action au style de la liste « Détails » : le texte passe à la
            ligne au lieu de déborder dans le panneau étroit du mobile. */}
        <Button
          type="button"
          variant="outline"
          className="mt-3 mb-[max(0.25rem,env(safe-area-inset-bottom))] h-auto w-full min-w-0 justify-start gap-3 whitespace-normal rounded-xl px-3 py-2.5 text-left font-normal"
          disabled={exporting}
          aria-busy={exporting}
          onClick={async () => {
            setExporting(true);
            await downloadConversation(projectId, client.id);
            setExporting(false);
          }}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background">
            {exporting ? (
              <Loader2
                aria-hidden="true"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
            ) : (
              <Download aria-hidden="true" className="size-4" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium leading-snug">
              Exporter la conversation
            </span>
            <span className="block text-xs text-muted-foreground">
              {exporting ? "Préparation du dossier…" : "Dossier .zip · .txt et .csv"}
            </span>
          </span>
        </Button>
      </section>
    </div>
  );
}
