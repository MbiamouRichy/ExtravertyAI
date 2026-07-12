import { AuthPage } from "@/components/auth/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ExtravertyAI - Se connecter",
  description:
    "ExtravertyAI est un assistant de support client alimenté par l'IA qui fournit des réponses rapides et précises aux questions des clients, améliorant ainsi l'expérience client et le nombre de ventes.",
};
export const dynamic = "force-static";

export default function SeConnecterPage() {
    return <AuthPage />;
}