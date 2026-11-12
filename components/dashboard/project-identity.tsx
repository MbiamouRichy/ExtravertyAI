"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { SwitcherProject } from "@/lib/project-switcher";

export type ProjectIdentity = {
  projectId: string;
  name: string;
  logoUrl: string | null;
  /** Rôle du membre connecté : ne sert qu’à masquer les liens, le serveur revérifie. */
  role: string;
  /** État de l’offre, ou rôle pour qui ne voit pas la facturation. */
  subtitle: string;
  /** Projets du membre pour le sélecteur, calculés côté serveur. */
  projects: SwitcherProject[];
};

const IdentityContext = createContext<{
  identity: ProjectIdentity | null;
  setIdentity: (identity: ProjectIdentity) => void;
}>({ identity: null, setIdentity: () => undefined });

/**
 * Nom et icône du projet ouvert, fournis par la mise en page du projet
 * (rendue sous la barre latérale) pour l’en-tête de cette barre.
 */
export function ProjectIdentityProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<ProjectIdentity | null>(null);
  return (
    <IdentityContext.Provider value={{ identity, setIdentity }}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useProjectIdentity(projectId: string | undefined) {
  const { identity } = useContext(IdentityContext);
  return identity && identity.projectId === projectId ? identity : null;
}

/** Publie l’identité du projet ; se met à jour après un renommage ou une nouvelle icône. */
export function ProjectIdentitySync({ projectId, name, logoUrl, role, subtitle, projects }: ProjectIdentity) {
  const { setIdentity } = useContext(IdentityContext);
  // Liste comparée par contenu : un nouveau rendu serveur identique ne republie rien.
  const projectsKey = JSON.stringify(projects);
  useEffect(() => {
    setIdentity({ projectId, name, logoUrl, role, subtitle, projects: JSON.parse(projectsKey) });
  }, [projectId, name, logoUrl, role, subtitle, projectsKey, setIdentity]);
  return null;
}
