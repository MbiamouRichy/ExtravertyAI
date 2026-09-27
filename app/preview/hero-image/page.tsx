import type { Metadata } from "next";
import { notFound } from "next/navigation";
import HeroImageProposal from "@/components/website/hero-image-proposal";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Proposition de section · ExtravertyAI",
  robots: { index: false, follow: false },
};

export default function HeroImagePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 border-b px-4 py-5 sm:px-8">
        <span className="font-heading text-lg font-semibold">ExtravertyAI</span>
        <Badge variant="outline">Proposition · Section d’accueil</Badge>
      </header>
      <HeroImageProposal />
    </main>
  );
}
