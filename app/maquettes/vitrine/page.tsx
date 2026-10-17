import type { Metadata } from "next";

import { VitrinePage } from "@/components/maquettes/vitrine/vitrine-page";

export const metadata: Metadata = {
  title: "Vitrine",
  description:
    "Proposition de page d’accueil ExtravertyAI : démo de conversation en direct, parcours d’un message, analytique et matrice des offres.",
};

export default function VitrineMaquette() {
  return <VitrinePage />;
}
