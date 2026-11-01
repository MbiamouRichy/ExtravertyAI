"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Bot, CalendarDays, Check, CircleCheck, Clock3, Copy, Download, Link2, Loader2, MessagesSquare, Moon, Sparkles, Sunrise, UsersRound, type LucideIcon } from "lucide-react";

import { getInitials } from "@/components/getInitials";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarImage,
} from "@/components/ui/avatar";
import type { ChatAgent, ChatClient, ChatTag } from "@/lib/chat";
import { PRESENCE_LABEL, type ContactPresence } from "@/lib/contact-presence-shared";
import type { ChatContactDetails } from "@/lib/contact-details";
import { revealContactPhone } from "@/app/actions/contact-phone";
import { wakeAssistantAction } from "@/app/actions/ai-quiet";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ConversationSummaryCard } from "./conversation-summary";
import { downloadConversation } from "./export-conversation";
import { ContactTagsEditor } from "./chat-workflow";
import { AssigneePicker } from "./assignee-picker";
import { ContactPipelineSection } from "./pipeline-controls";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-7 items-center justify-between gap-3 text-xs">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-right">{children}</dd>
    </div>
  );
}

const detailDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-h-10 items-center gap-2.5 px-3 text-xs">
      <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd title={value} className="min-w-0 flex-1 truncate text-right font-medium">
        {value}
      </dd>
    </div>
  );
}

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
  presence = null,
  aiActive,
  resolved,
  automationPaused,
  agents,
  hasClientMessage,
  details,
  canCopyPhone,
  currentUserId,
  pipeline,
  onContactChanged,
  projectTags = [],
}: {
  projectId: string;
  client: ChatClient;
  /** Statut WhatsApp du prospect, en direct. */
  presence?: Exclude<ContactPresence, "offline"> | null;
  aiActive: boolean;
  resolved: boolean;
  automationPaused: boolean;
  agents: ChatAgent[];
  hasClientMessage: boolean;
  details?: ChatContactDetails;
  /** Propriétaire ou administrateur : seul autorisé à copier le numéro. */
  canCopyPhone: boolean;
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
    <div className="flex flex-col divide-y px-5 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <header className="flex min-w-0 items-center gap-3 py-5">
        <span className="relative shrink-0">
          <Avatar className="size-11">
            <AvatarFallback className="font-heading text-sm font-semibold">
              {getInitials(client.name)}
            </AvatarFallback>
          </Avatar>
          {presence && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -bottom-0.5 size-3.5 rounded-full border-2 border-background bg-emerald-500"
            />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-heading text-base font-semibold">{client.name}</p>
          {presence && (
            <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400">
              {PRESENCE_LABEL[presence]}
            </p>
          )}
          {details?.maskedPhone && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
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
      </header>

      <section aria-label="Suivi de la conversation" className="py-4">
        <dl className="space-y-1">
          <Row label="Statut">
            <StatusIcon aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate" title={status.hint}>
              {status.label}
            </span>
          </Row>
          <Row label="Intérêt">
            {instinct === "interesting" ? (
              <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-primary px-2 py-1 font-medium text-primary-foreground">
                <Sparkles aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="truncate">Prospect intéressant</span>
              </span>
            ) : instinct === "follow_up" ? (
              <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 font-medium">
                <Clock3 aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="truncate">À suivre</span>
              </span>
            ) : (
              <span className="truncate text-muted-foreground">
                {instinct === "none" ? "Aucun détecté" : "En attente"}
              </span>
            )}
          </Row>
          <Row label="Suivie par">
            {agents.length > 0 && (
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
            )}
            <span className="truncate">
              {agents.length
                ? agents.map((agent) => agent.name?.trim().split(" ")[0] || "Agent").join(", ")
                : aiActive
                  ? "Assistant IA"
                  : "Personne"}
            </span>
          </Row>
        </dl>
        <AssigneePicker
          key={`assignee-${client.id}`}
          projectId={projectId}
          contactId={client.id}
          contactName={client.name}
          currentUserId={currentUserId}
          assignee={client.assignee ?? null}
          onChanged={onContactChanged}
        />
        {quiet && aiActive && !resolved && (
          <div className="mt-3 space-y-2">
            <p className="text-xs leading-relaxed text-muted-foreground">{status.hint}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
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
          </div>
        )}
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

      <section aria-labelledby={`details-${client.id}`} className="py-5">
        <h2
          id={`details-${client.id}`}
          className="mb-2 font-mono text-[11px] font-normal uppercase tracking-wider text-muted-foreground"
        >
          Détails
        </h2>
        <dl className="divide-y rounded-xl border">
          {details && (
            <>
              <DetailRow
                icon={CalendarDays}
                label="Premier contact"
                value={detailDate.format(new Date(details.firstContactAt))}
              />
              <DetailRow
                icon={MessagesSquare}
                label="Messages reçus"
                value={details.clientMessages.toLocaleString("fr-FR")}
              />
              <DetailRow icon={Link2} label="Source" value={details.source} />
            </>
          )}
          <DetailRow
            icon={Clock3}
            label="Dernière activité"
            value={detailDate.format(new Date(client.lastActivityAt))}
          />
        </dl>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          disabled={exporting}
          aria-busy={exporting}
          onClick={async () => {
            setExporting(true);
            await downloadConversation(projectId, client.id);
            setExporting(false);
          }}
        >
          {exporting ? (
            <Loader2
              data-icon="inline-start"
              className="animate-spin motion-reduce:animate-none"
            />
          ) : (
            <Download data-icon="inline-start" />
          )}
          {exporting ? "Préparation du dossier…" : "Exporter la conversation"}
        </Button>
      </section>
    </div>
  );
}
