import { Contact } from "@/components/contact";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ExtravertyAI - Contactez-nous",
  description:
    "ExtravertyAI est un assistant de support client alimenté par l'IA qui fournit des réponses rapides et précises aux questions des clients, améliorant ainsi l'expérience client et le nombre de ventes.",
};
export const dynamic = "force-static";
export default function Page() {
  return (
    <div className="min-h-screen w-full overflow-hidden px-4">
      <Contact />
    </div>
  );
}
