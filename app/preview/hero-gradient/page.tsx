import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Hero } from "./hero";
import styles from "./preview.module.css";

export const metadata: Metadata = {
  title: "Démo hero · ExtravertyAI",
  robots: { index: false, follow: false },
};

export default function HeroGradientPreview() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="relative isolate min-h-dvh overflow-hidden bg-background text-foreground">
      <div aria-hidden="true" className={styles.halo} />
      <div aria-hidden="true" className={styles.dots} />
      <header className="relative mx-auto mt-4 flex max-w-5xl items-center justify-between gap-3 rounded-xl border bg-background/80 p-2 shadow-sm backdrop-blur-md max-xl:mx-4">
        <Link href="/" aria-label="ExtravertyAI, accueil" className="flex items-center gap-1 rounded-md font-heading text-lg font-bold focus-visible:outline-2 focus-visible:outline-ring">
          <Logo className="size-9" />ExtravertyAI
        </Link>
        <nav aria-label="Navigation de la démonstration" className="hidden items-center gap-6 text-sm md:flex">
          <Link className="hover:underline" href="#apercu">Le produit</Link>
          <Link className="hover:underline" href="#benefices">Les bénéfices</Link>
          <Link className="hover:underline" href="/#tarifs">Tarifs</Link>
        </nav>
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" className="hidden sm:inline-flex"><Link href="/sign-in">Connexion</Link></Button>
          <Button asChild><Link href="/sign-up">Commencer</Link></Button>
        </div>
      </header>
      <Hero />
      <footer className="relative mx-auto flex max-w-6xl flex-wrap justify-between gap-2 border-t px-6 py-6 text-xs text-muted-foreground">
        <span>ExtravertyAI · Votre prochain client est déjà dans vos messages.</span>
        <span>Proposition visuelle · Données fictives</span>
      </footer>
    </main>
  );
}
