import type { Metadata } from "next";

import { ProjectWizard } from "@/components/maquettes/project-new/project-wizard";

import NewProjectLoading from "./loading";

export const metadata: Metadata = { title: "Création de projet" };

export default async function NewProjectMaquette({
  searchParams,
}: {
  searchParams: Promise<{ apercu?: string | string[] }>;
}) {
  // « ?apercu=chargement » fige l’écran de chargement pour le relire.
  if ((await searchParams).apercu === "chargement") return <NewProjectLoading />;

  return <ProjectWizard />;
}
