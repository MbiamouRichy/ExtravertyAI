"use client";

import { cn } from "@/lib/utils";
import { type ComponentProps, useState } from "react";
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { StatusIndicator } from "@/components/ui/indicator";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "../ui/button";
import { getInitials } from "../getInitials";
import Link from "next/link";

// On met à jour le type pour accepter null (venant de Prisma pour l'image)
export type Teammate = {
    id: string; // Correspondra au userId
    name: string;
    status: "Online" | "Away";
    open: number;
    image?: string | null;
};

// On ajoute les props pour recevoir les données du serveur
interface TeamOnDutyProps extends ComponentProps<typeof Card> {
    initialTeammates: Teammate[];
    projectId: string
}


export function TeamOnDuty({
    initialTeammates,
    projectId,
    className,
    ...props
}: TeamOnDutyProps) {
    // Le state est maintenant initialisé avec les données de la DB
    const [teammates] = useState<Teammate[]>(initialTeammates);


    return (
        <Card className={cn("shadow-none dark:ring-0 bg-background rounded-none! relative", className)} {...props}>
            <CardHeader className="border-b">
                <CardTitle>Membres d&apos;equipe</CardTitle>
                <CardDescription>Les personnes qui travaille avec vous sur ce projet.</CardDescription>
            </CardHeader>
            <CardContent className={cn("p-0", teammates.length > 10 && "max-h-72 mask-b-from-50% mask-b-to-100%")}>
                <ul className="flex flex-col divide-y divide-border">
                    {teammates.slice(0, 10).map((t) => (
                        <li
                            className="flex items-center gap-2 p-3 first:pt-0 last:pb-0 sm:gap-3"
                            key={t.id}
                        >
                            <Avatar className="size-8">
                                {/* Gérer le cas où l'image est null ou undefined */}
                                <AvatarImage alt={t.name} src={t.image || undefined} />
                                <AvatarFallback>{getInitials(t.name)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1 pr-1">
                                <p className="truncate font-medium text-foreground text-sm leading-snug">
                                    {t.name}
                                </p>
                                <p className="flex items-center gap-2 text-[10px] leading-snug">
                                    <span className="flex shrink-0 items-center gap-1">
                                        <StatusIndicator
                                            color={t.status === "Online" ? "emerald" : "amber"}
                                            pulse={t.status === "Online"}
                                        />
                                        {t.status === "Online" ? "En ligne" : "Absent"}
                                    </span>
                                    <span className="inline-flex size-1 rounded-full bg-foreground/80" />
                                    <span>{t.open} conv. assignées</span>
                                </p>
                            </div>
                        </li>
                    ))}
                </ul>
            </CardContent>
            <div className="mask-t-from-30% absolute inset-x-0 bottom-0 flex h-1/5  items-center justify-center bg-linear-to-t from-background to-background/0">
                <Button asChild className="relative" variant="ghost" size="sm">
                    <Link href={`/projects/${projectId}/team`}>
                        Voir l&apos;equipe
                        <ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
                    </Link>
                </Button>
            </div>
        </Card>
    );
}