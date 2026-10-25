"use client";

import { cn } from "@/lib/utils";
import { type ComponentProps } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MemberPresence, useProjectPresence } from "./user/member-presence";
import { AssignNextButton } from "./project/assign-next-button";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "../ui/button";
import { getInitials } from "../getInitials";
import Link from "next/link";

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

const ROLE_ORDER: Record<string, number> = { OWNER: 0, ADMIN: 1 };

function roleRank(role: string) {
  return ROLE_ORDER[role] ?? 2;
}

// On ajoute les props pour recevoir les données du serveur
interface TeamOnDutyProps extends ComponentProps<typeof Card> {
  initialTeammates: Teammate[];
  projectId: string;
}

export function TeamOnDuty({
  initialTeammates,
  projectId,
  className,
  ...props
}: TeamOnDutyProps) {
  // Propriétaire, puis administrateurs, puis membres ; l’ordre reçu est gardé à rôle égal.
  const teammates = [...initialTeammates].sort(
    (a, b) => roleRank(a.role) - roleRank(b.role),
  );
  const presence = useProjectPresence(projectId);

  return (
    <Card
      className={cn("min-w-0 shadow-none dark:ring-0 relative", className)}
      {...props}
    >
      <CardHeader className="border-b">
        <CardTitle>Membres d’équipe</CardTitle>
        <CardDescription>
          Les personnes qui travaillent avec vous sur ce projet.
        </CardDescription>
      </CardHeader>
      <CardContent
        className={cn(
          "p-0",
          teammates.length > 10 &&
            "max-h-72 h-full min-h-16 mask-b-from-50% mask-b-to-100%",
        )}
      >
        {teammates.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">
            Aucun membre à afficher.
          </p>
        )}
        <ul className="flex flex-col divide-y divide-border">
          {teammates.slice(0, 10).map((t) => (
            <li className="flex items-center gap-3 px-4 py-3" key={t.id}>
              <Avatar className="size-9 shrink-0">
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
              {t.role !== "OWNER" && (
                <AssignNextButton
                  projectId={projectId}
                  assigneeId={t.userId}
                  assigneeName={t.name}
                />
              )}
            </li>
          ))}
        </ul>
      </CardContent>
      <div className="mt-2 flex shrink-0 items-center justify-center border-t px-3 py-3">
        <Button asChild className="relative" variant="ghost" size="sm">
          <Link href={`/projects/${projectId}/team`}>
            Voir l’équipe
            <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </Card>
  );
}
