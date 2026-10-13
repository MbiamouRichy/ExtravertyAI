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
  image?: string | null;
};

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
  // Le state est maintenant initialisé avec les données de la DB
  const teammates = initialTeammates;
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
            <li
              className="flex items-start gap-2 p-3 sm:items-center sm:first:pt-0 sm:last:pb-0 sm:gap-3"
              key={t.id}
            >
              <Avatar className="size-8 shrink-0">
                {/* Gérer le cas où l'image est null ou undefined */}
                <AvatarImage alt={t.name} src={t.image || undefined} />
                <AvatarFallback>{getInitials(t.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 pr-1">
                <p className="truncate font-medium text-foreground text-sm leading-snug">
                  {t.name}
                </p>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-relaxed sm:flex-nowrap sm:text-[10px] sm:leading-snug">
                  <MemberPresence
                    status={
                      presence.error
                        ? undefined
                        : presence.data?.find((p) => p.userId === t.userId)
                            ?.status
                    }
                  />
                </p>
              </div>
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
