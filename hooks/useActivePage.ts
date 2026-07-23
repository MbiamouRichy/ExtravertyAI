"use client";

import { usePathname } from "next/navigation";

export function useActivePage() {
  const pathname = usePathname();
  console.log(pathname);

  /**
   * Vérifie si le chemin passé correspond à l'URL actuelle.
   * @param path Le chemin à vérifier (ex: "/Dashboard/project")
   * @param exact Si true, l'URL doit correspondre exactement. Si false, vérifie si l'URL commence par ce chemin.
   */
  const isActive = (path: string, exact = false) => {
    if (!pathname) return false;
    if (exact) {
      return pathname === path;
    }

    // Utile pour que "/Dashboard/project/123" garde le menu "/Dashboard/project" actif
    return pathname.startsWith(path);
  };

  // (Optionnel) Retourne directement le nom de la section active pour d'autres usages logiques
  const currentSection = () => {
    if (!pathname) return null;
    if (pathname === "/Dashboard") return "Dashboard";
    if (pathname.includes("/Dashboard/projets")) return "Projets";
    if (pathname.includes("/Dashboard/user")) return "User";
    return "Other";
  };

  return {
    pathname,
    isActive,
    activeSection: currentSection(),
  };
}
