"use client";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MemberPresence, useProjectPresence } from "./user/member-presence";
import { AssignNextButton } from "./project/assign-next-button";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "../ui/button";
import { getInitials } from "../getInitials";
import Link from "next/link";
import {
  PROJECT_ROLES,
  can,
  type ProjectRole,
} from "@/lib/project-permissions";
import { AnalyticsCard } from "./analytics-card";

// On met à jour le type pour accepter null (venant de Prisma pour l'image)
export type Teammate = {
  id: string;
  userId: string;
  name: string;

  open: number;
  role: string;
  /** Conversations ouvertes qui lui sont assignées. */
  assigned: number;
  image?: string | null;
};

// Propriétaire d’abord, puis les rôles du plus large au plus restreint.
function roleRank(role: string) {
  const index = PROJECT_ROLES.indexOf(role as ProjectRole);
  return index === -1 ? PROJECT_ROLES.length : index;
}

// On ajoute les props pour recevoir les données du serveur
interface TeamOnDutyProps {
  initialTeammates: Teammate[];
  projectId: string;
  /** Propose « confier la prochaine conversation » (superviseurs et plus). */
  canDispatch: boolean;
  canManageTeam: boolean;
  className?: string;
}

export function TeamOnDuty({
  initialTeammates,
  projectId,
  canDispatch,
  canManageTeam,
  className,
}: TeamOnDutyProps) {
  // Propriétaire, puis administrateurs, puis membres ; l’ordre reçu est gardé à rôle égal.
  const teammates = [...initialTeammates].sort(
    (a, b) => roleRank(a.role) - roleRank(b.role),
  );
  const presence = useProjectPresence(projectId);

  return (
    <AnalyticsCard
      title="Membres d’équipe"
      description={`${teammates.length.toLocaleString("fr-FR")} membre${teammates.length > 1 ? "s" : ""} sur ce projet`}
      className={className}
      aside={
        canManageTeam && (
          <Button asChild variant="ghost" size="sm" className="-mt-1 -mr-2">
            <Link href={`/projects/${projectId}/team`}>
              Voir l’équipe
              <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
            </Link>
          </Button>
        )
      }
    >
      {teammates.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Aucun membre à afficher.
        </p>
      )}
      <ul
        className={cn(
          "flex flex-col divide-y",
          teammates.length > 10 &&
            "max-h-72 min-h-16 mask-b-from-50% mask-b-to-100%",
        )}
      >
        {teammates.slice(0, 10).map((t) => (
          <li
            className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
            key={t.id}
          >
            <Avatar className="size-8 shrink-0">
              <AvatarImage alt="" src={t.image || undefined} />
              <AvatarFallback>{getInitials(t.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-snug text-foreground">
                {t.name}
              </p>
              {/* Présence et charge : passent à la ligne sur petit écran. */}
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                <MemberPresence
                  status={
                    presence.error
                      ? undefined
                      : presence.data?.find((p) => p.userId === t.userId)
                          ?.status
                  }
                />
                <span aria-hidden="true" className="text-muted-foreground/60">
                  ·
                </span>
                <span className="whitespace-nowrap tabular-nums">
                  {t.assigned.toLocaleString("fr-FR")}{" "}
                  {t.assigned > 1 ? "assignées" : "assignée"}
                </span>
              </p>
            </div>
            {/* Le propriétaire choisit ses conversations lui-même. */}
            {canDispatch &&
              t.role !== "OWNER" &&
              can(t.role, "conversations.handle") && (
              <AssignNextButton
                projectId={projectId}
                assigneeId={t.userId}
                assigneeName={t.name}
              />
            )}
          </li>
        ))}
      </ul>
    </AnalyticsCard>
  );
}
