"use client";

import Link from "next/link";
import { CheckIcon, ChevronsUpDownIcon, LayoutGridIcon, PlusIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import type { ProjectIdentity } from "./project-identity";
import { ProjectIcon } from "./project/project-icon";

/**
 * En-tête de la barre latérale : le projet ouvert, et au clic la liste des
 * projets du membre pour passer de l’un à l’autre. Changer de projet ouvre
 * son tableau de bord, la seule page que tous les rôles peuvent ouvrir.
 */
export function ProjectSwitcher({ identity }: { identity: ProjectIdentity | null }) {
  const { isMobile, setOpenMobile } = useSidebar();

  if (!identity) {
    return (
      <div aria-hidden="true" className="flex h-12 items-center gap-2 px-2 group-data-[collapsible=icon]:px-0">
        <Skeleton className="size-8 shrink-0 rounded-lg" />
        <Skeleton className="h-4 w-28 group-data-[collapsible=icon]:hidden" />
      </div>
    );
  }

  // Sur mobile, la barre est un panneau : on le ferme une fois le choix fait.
  const close = () => setOpenMobile(false);

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        {/*
          Sur mobile, le menu s’ouvre dans le panneau, déjà modal. Deux calques
          modaux fermés ensemble laissaient `pointer-events: none` sur le body
          et figeaient l’app : seul le panneau bloque donc les clics extérieurs.
        */}
        <DropdownMenu modal={!isMobile}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={identity.name}
              aria-label={`Changer de projet. Projet ouvert : ${identity.name}`}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <ProjectIcon
                name={identity.name}
                logoUrl={identity.logoUrl}
                className="size-8 rounded-lg after:rounded-lg"
                fallbackClassName="rounded-lg text-xs"
              />
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate font-heading text-sm font-semibold">{identity.name}</span>
                <span className="truncate text-xs text-muted-foreground">{identity.subtitle}</span>
              </span>
              <ChevronsUpDownIcon aria-hidden="true" className="ml-auto text-muted-foreground" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={isMobile ? 4 : 8}
            className="w-(--radix-dropdown-menu-trigger-width) min-w-64 rounded-lg"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                Mes projets
              </DropdownMenuLabel>
              {identity.projects.map((project) => {
                const current = project.id === identity.projectId;
                return (
                  <DropdownMenuItem key={project.id} asChild onSelect={close}>
                    <Link
                      href={`/projects/${encodeURIComponent(project.id)}`}
                      aria-current={current ? "page" : undefined}
                      className="cursor-pointer gap-2.5"
                    >
                      <ProjectIcon
                        name={project.name}
                        logoUrl={project.logoUrl}
                        className="size-7 rounded-md after:rounded-md"
                        fallbackClassName="rounded-md text-[11px]"
                      />
                      <span className="grid min-w-0 flex-1 leading-tight">
                        <span className="truncate font-medium">{project.name}</span>
                        <span className="truncate text-xs text-muted-foreground">{project.role}</span>
                      </span>
                      {current && (
                        <>
                          <CheckIcon aria-hidden="true" className="ml-auto text-primary" />
                          <span className="sr-only">(projet ouvert)</span>
                        </>
                      )}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem asChild onSelect={close}>
                <Link href="/projects" className="cursor-pointer">
                  <LayoutGridIcon aria-hidden="true" />
                  Tous mes projets
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild onSelect={close}>
                <Link href="/projects/new" className="cursor-pointer">
                  <PlusIcon aria-hidden="true" />
                  Nouveau projet
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
