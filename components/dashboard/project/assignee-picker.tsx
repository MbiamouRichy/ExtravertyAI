"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronsUpDown, Loader2, UserRoundCheck, UserRoundX } from "lucide-react";

import { getInitials } from "@/components/getInitials";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  assignConversationAction,
  listAssignableMembersAction,
} from "@/app/actions/conversation-workflow";
import type { ChatAgent } from "@/lib/chat";

type Member = ChatAgent & { role: string };

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  USER: "Membre",
};

const NONE = "__none__";

function MemberAvatar({ member }: { member: ChatAgent }) {
  return (
    <Avatar size="sm" className="size-5">
      <AvatarImage src={member.image || undefined} alt="" />
      <AvatarFallback className="text-[9px] font-semibold">
        {getInitials(member.name?.trim() || "Membre")}
      </AvatarFallback>
    </Avatar>
  );
}

export function AssigneePicker({
  projectId,
  contactId,
  contactName,
  currentUserId,
  assignee,
  onChanged,
}: {
  projectId: string;
  contactId: string;
  contactName: string;
  currentUserId: string;
  assignee: ChatAgent | null;
  onChanged: () => void;
}) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  // Shown until the refreshed conversation reports another assignee.
  const [optimistic, setOptimistic] = useState<ChatAgent | null | undefined>(undefined);
  const [pending, startTransition] = useTransition();
  const current = assignee?.id ?? null;
  const [seen, setSeen] = useState(current);
  if (seen !== current) {
    setSeen(current);
    setOptimistic(undefined);
  }
  const shown = optimistic === undefined ? assignee : optimistic;

  async function loadMembers() {
    if (members) return;
    setLoadError(false);
    const result = await listAssignableMembersAction({ projectId });
    if (result.success) setMembers(result.members);
    else setLoadError(true);
  }

  function assign(assigneeId: string | null) {
    if ((shown?.id ?? null) === assigneeId) return;
    const next = assigneeId
      ? members?.find((member) => member.id === assigneeId)
      : null;
    // Without the member list yet, wait for the server instead of guessing.
    if (next !== undefined) setOptimistic(next);
    startTransition(async () => {
      const result = await assignConversationAction({
        projectId,
        contactId,
        assigneeId,
      });
      if (!result.success) {
        setOptimistic(undefined);
        toast.error(result.error);
        return;
      }
      if ((result.assignee?.id ?? null) !== current) setOptimistic(result.assignee);
      else setOptimistic(undefined);
      onChanged();
      toast.success(
        result.assignee
          ? result.assignee.id === currentUserId
            ? "Conversation prise en charge"
            : `Conversation assignée à ${result.assignee.name?.split(" ")[0] ?? "ce membre"}`
          : "Assignation retirée",
      );
    });
  }

  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-muted-foreground">Assignée à</span>
      <DropdownMenu onOpenChange={(open) => open && void loadMembers()}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            aria-label={`Assigner la conversation avec ${contactName}${shown ? `, actuellement assignée à ${shown.name ?? "un membre"}` : ", non assignée"}`}
            className="-mr-2 h-7 max-w-[60%] gap-1.5 px-2 text-xs"
          >
            {pending ? (
              <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            ) : shown ? (
              <MemberAvatar member={shown} />
            ) : null}
            <span className="truncate">
              {shown ? shown.name?.split(" ")[0] || "Membre" : "Personne"}
            </span>
            <ChevronsUpDown aria-hidden="true" className="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>Assigner à</DropdownMenuLabel>
          {shown?.id !== currentUserId && (
            <DropdownMenuItem onSelect={() => assign(currentUserId)}>
              <UserRoundCheck aria-hidden="true" />
              Me l’attribuer
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {loadError ? (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                void loadMembers();
              }}
            >
              Impossible de charger l’équipe. Réessayer
            </DropdownMenuItem>
          ) : !members ? (
            <p role="status" className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin motion-reduce:animate-none" />
              Chargement de l’équipe…
            </p>
          ) : (
            <DropdownMenuRadioGroup
              value={shown?.id ?? NONE}
              onValueChange={(value) => assign(value === NONE ? null : value)}
            >
              {members.map((member) => (
                <DropdownMenuRadioItem key={member.id} value={member.id} className="gap-2">
                  <MemberAvatar member={member} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      {member.name || "Membre"}
                      {member.id === currentUserId && " (vous)"}
                    </span>
                    <span className="block text-[11px] text-muted-foreground">
                      {ROLE_LABEL[member.role] ?? "Membre"}
                    </span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          )}
          {shown && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => assign(null)}>
                <UserRoundX aria-hidden="true" />
                Retirer l’assignation
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
