import Link from "next/link";
import { ArrowRight, Check, Play, Sparkles, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { HeroImage } from "./hero-image";
import styles from "./preview.module.css";

const benefits = [
  { icon: Zap, title: "Présent, même en votre absence.", description: "Votre assistant accueille les messages et répond aux questions, à toute heure." },
  { icon: Users, title: "Chaque prospect a sa place.", description: "Retrouvez le contexte de vos échanges et les besoins de chaque contact." },
  { icon: Sparkles, title: "Votre temps, mieux investi.", description: "Confiez les questions répétitives à l’IA et concentrez-vous sur la relation." },
];

export function Hero() {
  return (
    <>
      <section aria-labelledby="hero-title" className="relative px-4 pb-16 pt-20 text-center sm:pt-24">
        <Link href="#apercu" className="inline-flex items-center gap-3 rounded-full border bg-background/70 p-1 pr-3 text-xs shadow-sm transition-colors hover:bg-background focus-visible:outline-2 focus-visible:outline-ring">
          <span className="rounded-full border bg-background px-2 py-0.5 font-medium shadow-xs">24/7</span>
          Votre assistant WhatsApp, toujours là
          <ArrowRight aria-hidden="true" className="size-3" />
        </Link>
        <h1 id="hero-title" className="mx-auto mt-6 max-w-4xl text-balance text-4xl sm:text-5xl lg:text-6xl">
          Vos conversations avancent.<br />
          <span className={styles.outline}>Votre business aussi.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
          Répondez automatiquement sur WhatsApp, qualifiez vos prospects
          et transformez chaque échange en opportunité. Même quand vous dormez.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" variant="outline" className="w-full rounded-full px-5 sm:w-auto"><Link href="#apercu"><Play aria-hidden="true" className="size-4" />Explorer la démo</Link></Button>
          <Button asChild size="lg" className="w-full rounded-full px-5 sm:w-auto"><Link href="/sign-up">Créer mon assistant<ArrowRight aria-hidden="true" className="size-4" /></Link></Button>
        </div>
        <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><Check aria-hidden="true" className="size-3" />À votre image</span>
          <span className="inline-flex items-center gap-1.5"><Check aria-hidden="true" className="size-3" />Disponible 24/7</span>
          <span className="inline-flex items-center gap-1.5"><Check aria-hidden="true" className="size-3" />Vous gardez la main</span>
        </div>
        <HeroImage />
      </section>
      <section id="benefices" aria-label="Les bénéfices" className="relative mx-auto grid max-w-6xl scroll-mt-8 gap-8 px-6 pb-20 md:grid-cols-3 md:gap-12">
        {benefits.map(({ icon: Icon, title, description }) => (
          <div key={title} className="border-t pt-6">
            <Icon aria-hidden="true" className="mb-4 size-5" />
            <h2 className="text-lg tracking-tight">{title}</h2>
            <p className="mt-3 text-sm text-muted-foreground">{description}</p>
          </div>
        ))}
      </section>
    </>
  );
}
