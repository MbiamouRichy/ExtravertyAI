import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Maquettes UI · ExtravertyAI",
    template: "%s · Maquettes ExtravertyAI",
  },
  description:
    "Propositions d’interfaces ExtravertyAI : accueil, tarifs, connexion et messagerie.",
  robots: { index: false, follow: false },
};

export default function MaquettesLayout({ children }: { children: ReactNode }) {
  return children;
}
