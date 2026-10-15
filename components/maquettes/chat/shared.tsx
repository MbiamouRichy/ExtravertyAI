import { Clock3, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ProspectClassification } from "@/lib/instinct-classification";
import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";

import { instinctLabel, type Agent } from "./data";

export function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ContactAvatar({
  name,
  size = "default",
  online = false,
  className,
}: {
  name: string;
  size?: "default" | "sm" | "lg";
  online?: boolean;
  className?: string;
}) {
  return (
    <Avatar size={size} className={className}>
      <AvatarFallback className="font-heading text-xs font-semibold">
        {initials(name)}
      </AvatarFallback>
      {online && (
        <AvatarBadge>
          <span className="sr-only">En ligne</span>
        </AvatarBadge>
      )}
    </Avatar>
  );
}

/** Team members who already replied to this contact. */
export function AgentStack({ agents, max = 3 }: { agents: Agent[]; max?: number }) {
  if (!agents.length) return null;
  const shown = agents.slice(0, max);
  return (
    <AvatarGroup
      aria-label={`Conversation suivie par ${agents.map((agent) => agent.name).join(", ")}`}
      className="shrink-0 *:data-[slot=avatar]:size-5"
    >
      {shown.map((agent) => (
        <Avatar key={agent.id} size="sm" title={agent.name}>
          <AvatarFallback className="text-[9px] font-semibold">{initials(agent.name)}</AvatarFallback>
        </Avatar>
      ))}
      {agents.length > max && (
        <AvatarGroupCount className="size-5 text-[9px]">+{agents.length - max}</AvatarGroupCount>
      )}
    </AvatarGroup>
  );
}

/**
 * Instinct IA classification, as in the real inbox: only actionable states
 * ("interesting", "follow_up") are surfaced; "none" and null stay quiet.
 */
export function InstinctBadge({
  instinct,
  variant = "compact",
  className,
}: {
  instinct: ProspectClassification | null;
  variant?: "compact" | "full";
  className?: string;
}) {
  if (instinct !== "interesting" && instinct !== "follow_up") {
    if (variant === "compact") return null;
    return (
      <span className={cn("inline-flex items-center gap-1.5 text-xs text-muted-foreground", className)}>
        {instinct === "none" ? instinctLabel.none : "Analyse en attente"}
      </span>
    );
  }
  const Icon = instinct === "interesting" ? Sparkles : Clock3;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-sm text-[11px]",
        instinct === "interesting"
          ? "bg-primary px-1.5 py-px font-medium text-primary-foreground"
          : "border px-1.5 text-muted-foreground",
        variant === "full" && "text-xs",
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {instinctLabel[instinct]}
    </span>
  );
}
