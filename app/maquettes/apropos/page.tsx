import type { Metadata } from "next";

import { AboutPage } from "@/components/maquettes/apropos/about-page";

import AproposLoading from "./loading";

export const metadata: Metadata = { title: "À propos" };

export default async function AproposMaquette({
  searchParams,
}: {
  searchParams: Promise<{ apercu?: string | string[] }>;
}) {
  // « ?apercu=chargement » fige l’écran de chargement pour le relire.
  if ((await searchParams).apercu === "chargement") return <AproposLoading />;

  return <AboutPage />;
}
