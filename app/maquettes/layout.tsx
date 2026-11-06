import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { maquettesEnabled } from "@/lib/maquettes";

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
  // The proxy already answers 404 in production; nothing is rendered either way.
  if (!maquettesEnabled()) notFound();
  return children;
}
