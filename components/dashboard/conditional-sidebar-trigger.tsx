"use client";

import { usePathname } from "next/navigation";
import { CustomSidebarTrigger } from "@/components/dashboard/custom-sidebar-trigger";
import { HomeIcon } from "lucide-react";
import { Button } from "../ui/button";
import Link from "next/link";

export function ConditionalSidebarTrigger() {
    const isProjectContext = useIsProjectContext();
    // Si on n'est pas dans un projet spécifique, on ne rend rien au DOM (opti UI/UX)
    if (!isProjectContext) return (<Button variant="ghost" size="icon" asChild>
        <Link href="/projects" title="Retour à la liste des projets">
            <HomeIcon />
        </Link>
    </Button>)

    return <CustomSidebarTrigger />
}

export function useIsProjectContext() {
    const pathname = usePathname();

    // Décomposition sécurisée de l'URL pour éviter les faux positifs via Regex
    const segments = pathname?.split("/").filter(Boolean) || [];

    // Liste des mots-clés qui suivent "/projects/" mais qui NE SONT PAS des ID de projet
    const staticRoutes = ["new", "user", "billing"];

    // On vérifie qu'on est bien dans un contexte de projet spécifique (ex: /projects/123)
    const isProjectContext =
        segments[0] === "projects" &&      // On est dans la section projects
        segments.length >= 2 &&            // Il y a un ID ou un sous-chemin après
        !staticRoutes.includes(segments[1]);
    // Ce sous-chemin n'est pas une route statique
    return isProjectContext;
}