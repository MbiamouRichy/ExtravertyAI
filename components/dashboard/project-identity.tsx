"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type ProjectIdentity = {
  projectId: string;
  name: string;
  logoUrl: string | null;
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
export function ProjectIdentitySync({ projectId, name, logoUrl }: ProjectIdentity) {
  const { setIdentity } = useContext(IdentityContext);
  useEffect(() => {
    setIdentity({ projectId, name, logoUrl });
  }, [projectId, name, logoUrl, setIdentity]);
  return null;
}
