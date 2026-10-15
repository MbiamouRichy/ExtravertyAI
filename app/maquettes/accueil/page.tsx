import type { Metadata } from "next";

import { LandingPage } from "@/components/website/landing/landing-page";

export const metadata: Metadata = { title: "Accueil" };

// La maquette est désormais la page d’accueil réelle : une seule source de vérité.
export default function AccueilMaquette() {
  return <LandingPage />;
}
