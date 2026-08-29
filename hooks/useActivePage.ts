"use client";

import { usePathname } from "next/navigation";

export function useActivePage() {
  const pathname = usePathname();

  /**
   * Vérifie si le chemin passé correspond à l'URL actuelle.
   * @param path Le chemin à vérifier (ex: "/project")
   * @param exact Si true, l'URL doit correspondre exactement. Si false, vérifie si l'URL commence par ce chemin.
   */
  const isActive = (path: string, exact = false) => {
    if (!pathname) return false;
    if (exact) {
      return pathname === path;
    }

    // Utile pour que "/project/123" garde le menu "/project" actif
    return pathname.startsWith(path);
  };

  // (Optionnel) Retourne directement le nom de la section active pour d'autres usages logiques
  const currentSection = () => {
    if (!pathname) return null;
    if (pathname.includes("/projects")) return "Projets";
    if (pathname.includes("/projects/user")) return "User";
    if (pathname.includes("/projects/billing")) return "PLan";
    return "Other";
  };

  return {
    pathname,
    isActive,
    activeSection: currentSection(),
  };
}
