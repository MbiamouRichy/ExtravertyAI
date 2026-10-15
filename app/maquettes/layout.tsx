import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "Maquettes UI · ExtravertyAI",
    template: "%s · Maquettes ExtravertyAI",
  },
  description:
    "Propositions d’interfaces ExtravertyAI : accueil, tarifs, connexion et messagerie.",
  robots: { index: false, follow: false },
};

export default function MaquettesLayout({ children }: LayoutProps<"/maquettes">) {
  return children;
}
