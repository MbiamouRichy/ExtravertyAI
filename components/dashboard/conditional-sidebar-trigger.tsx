"use client";

import { usePathname } from "next/navigation";
import { CustomSidebarTrigger } from "@/components/dashboard/custom-sidebar-trigger";
import { Separator } from "@/components/ui/separator";

export function ConditionalSidebarTrigger() {
    const pathname = usePathname();

    // Décomposition sécurisée de l'URL pour éviter les faux positifs via Regex
    const segments = pathname?.split("/").filter(Boolean) || [];

    // On vérifie qu'on est dans /projects/[id]
    // Et on exclut explicitement la route "new" qui ne possède pas de sidebar de projet
    const isProjectContext =
        segments[0] === "dashboard" &&
        segments[1] === "projects" &&
        segments.length >= 3 &&
        segments[2] !== "new";

    // Si on n'est pas dans un projet, on ne rend rien au DOM (opti UI/UX)
    if (!isProjectContext) return null;

    return (
        <>
            <CustomSidebarTrigger />
            <Separator
                className="mr-2 h-4 data-[orientation=vertical]:self-center transition-all duration-200"
                orientation="vertical"
            />
        </>
    );
}