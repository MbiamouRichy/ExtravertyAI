"use client";

import { navLinks } from "@/components/dashboard/app-shared";
import { usePathname, useParams } from "next/navigation";

export function useActivePage() {
  const pathname = usePathname();
  const params = useParams();

  // On récupère le projectId de l'URL s'il existe
  const projectId = (params?.projectId as string) || "";

  /**
   * Vérifie si le chemin passé correspond à l'URL actuelle.
   * @param path Le chemin à vérifier (ex: "/projects")
   * @param exact Si true, l'URL doit correspondre exactement.
   */
  const isActive = (path: string, exact = false) => {
    if (!pathname || !path) return false;
    if (exact) {
      return pathname === path;
    }
    return pathname.startsWith(path);
  };

  // Retourne le nom de la section active dynamiquement
  const currentSection = () => {
    if (!pathname) return null;

    // Récupérer tous les liens disponibles avec le projectId actuel
    const links = navLinks(projectId);

    // 1. Priorité max : Chercher d'abord une correspondance exacte
    const exactMatch = links.find((link) => link.path === pathname);
    if (exactMatch) return exactMatch.title;

    // 2. Fallback : Chercher la meilleure correspondance partielle
    // On trie par longueur de chemin décroissante pour trouver le chemin le plus spécifique
    // Ex: "/projects/123/dashboard/edit" correspondra à "/projects/123/dashboard" avant de correspondre à "/projects"
    const partialMatch = links
      .filter((link) => link.path && pathname.startsWith(link.path))
      .sort((a, b) => b.path!.length - a.path!.length)[0];

    if (partialMatch) return partialMatch.title;

    return "Other";
  };

  return {
    pathname,
    isActive,
    activeSection: currentSection(),
  };
}
