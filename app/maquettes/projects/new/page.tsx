import type { Metadata } from "next";

import { NewProjectWizard } from "@/components/maquettes/project-new/new-project-wizard";
import { resolvePlanId } from "@/lib/pricing";

export const metadata: Metadata = { title: "Créer un projet" };

export default async function NewProjectMaquette({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string | string[] }>;
}) {
  // Comme la page réelle : ?plan= présélectionne le forfait choisi sur la vitrine.
  const initialPlan = resolvePlanId((await searchParams).plan);
  return <NewProjectWizard key={initialPlan} initialPlan={initialPlan} />;
}
