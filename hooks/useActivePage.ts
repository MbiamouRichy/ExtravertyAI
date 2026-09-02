"use client";

import { usePathname } from "next/navigation";

export function useActivePage() {
  const pathname = usePathname();

  /**
   * Vérifie si le chemin passé correspond à l'URL actuelle.
   * @param path Le chemin à vérifier (ex: "/projects")
   * @param exact Si true, l'URL doit correspondre exactement. Si false, vérifie si l'URL commence par ce chemin.
   */
  const isActive = (path: string, exact = false) => {
    if (!pathname) return false;
    if (exact) {
      return pathname === path;
    }

    // Utile pour que "/projects/123" garde le menu "/projects" actif
    return pathname.startsWith(path);
  };

  // Retourne le nom de la section active pour d'autres usages logiques
  const currentSection = () => {
    if (!pathname) return null;

    // ⚠️ L'ordre est très important ici : du plus spécifique au plus général
    if (pathname.startsWith("/projects/user")) return "User";
    if (pathname.startsWith("/projects/new")) return "New project";
    if (pathname.startsWith("/projects/billing")) return "Plan";
    if (pathname.startsWith("/projects")) return "Projets";

    return "Other";
  };

  return {
    pathname,
    isActive,
    activeSection: currentSection(),
  };
}
