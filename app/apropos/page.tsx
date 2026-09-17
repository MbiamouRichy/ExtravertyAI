import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  MessageCircle,
  Sparkles,
  Users,
  CheckCheck,
  CircleDot,
} from "lucide-react";
import { Header } from "@/components/website/header";
import Footer from "@/components/website/footer";

export const metadata: Metadata = {
  title: "À propos — La relation client, plus simplement | ExtravertyAI",
  description:
    "ExtravertyAI aide les entreprises à mieux accueillir leurs clients sur WhatsApp, grâce à une IA qui travaille avec leurs équipes.",
  alternates: { canonical: "/apropos" },
};
export const dynamic = "force-static";
const principles = [
  {
    icon: MessageCircle,
    title: "Partir de votre réalité",
    text: "Une boutique, un service, une équipe : chaque activité a son rythme. Nous commençons par comprendre vos échanges et vos besoins.",
  },
  {
    icon: Sparkles,
    title: "Rendre l’IA utile",
    text: "Moins de questions répétitives à traiter. Des conversations regroupées. Une technologie qui simplifie le quotidien de votre équipe.",
  },
  {
    icon: Users,
    title: "Garder la main",
    text: "L’automatisation accompagne la relation. Votre équipe peut reprendre une conversation et suspendre les réponses de l’assistant.",
  },
];
export default function AboutPage() {
  return (
    <>
      <Header />
      <main
        id="main-content"
        className="mx-auto max-w-7xl px-5 pt-32 sm:px-8 lg:px-12 lg:pt-40"
      >
        <section className="grid items-end gap-8 border-b pb-14 lg:grid-cols-[1.4fr_1fr] lg:gap-16 lg:pb-20">
          <div>
            <p className="mb-7 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <span className="size-2 rounded-full bg-primary" /> Notre
              conviction
            </p>
            <h1 className="text-5xl! leading-[1.06]! tracking-[-0.055em]! sm:text-6xl! lg:text-7xl!">
              La technologie
              <br />
              avance.
              <br />
              <span className="text-foreground dark:text-foreground">
                La relation reste.
              </span>
            </h1>
          </div>
          <div className="max-w-md pb-2">
            <p className="text-xl leading-relaxed">
              Nous construisons ExtravertyAI pour que les entreprises passent
              moins de temps à répéter, et plus de temps à créer du lien.
            </p>
            <p className="mt-5 leading-relaxed text-muted-foreground">
              Nous aidons les professionnels à faire de WhatsApp un espace de
              travail plus simple, avec une IA au service de leur équipe.
            </p>
            <Link
              href="/contact"
              className="mt-7 inline-flex min-h-11 items-center gap-3 font-medium text-foreground dark:text-foreground"
            >
              Faisons connaissance <ArrowUpRight className="size-5" />
            </Link>
          </div>
        </section>

        <section
          aria-labelledby="mission-title"
          className="grid gap-10 py-16 lg:grid-cols-2 lg:items-center lg:gap-20 lg:py-24"
        >
          <div>
            <p className="mb-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              01 / Le point de départ
            </p>
            <h2
              id="mission-title"
              className="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl"
            >
              Derrière chaque message,
              <br />
              il y a une personne.
            </h2>
            <p className="mt-6 leading-relaxed text-muted-foreground">
              Une question sur votre activité. Un client qui hésite. Une demande
              qui arrive après une longue journée. Pour les entreprises, ces
              petits échanges comptent.
            </p>
            <p className="mt-4 leading-relaxed text-muted-foreground">
              Notre ambition est simple : vous aider à accueillir ces demandes,
              à suivre les conversations et à passer le relais à la bonne
              personne quand cela compte.
            </p>
          </div>
          <figure className="relative overflow-hidden rounded-3xl bg-muted p-6 dark:bg-muted sm:p-10">
            <figcaption className="mb-8 flex items-center justify-between text-xs font-medium uppercase tracking-widest text-muted-foreground dark:text-muted-foreground">
              <span>Une conversation, une équipe</span>
              <MessageCircle className="size-4" />
            </figcaption>
            <div className="space-y-4">
              <div className="mr-10 rounded-2xl rounded-bl-sm bg-card p-4 text-sm text-card-foreground shadow-sm">
                <p className="mb-1 text-xs font-semibold text-muted-foreground">
                  Votre client
                </p>
                Bonjour, j’aimerais en savoir plus sur vos services.
              </div>
              <div className="ml-8 rounded-2xl rounded-br-sm bg-primary p-5 text-sm text-primary-foreground">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary-foreground">
                  <Sparkles className="size-3.5" /> Votre assistant
                </p>
                Bonjour et bienvenue ! Quel service vous intéresse ?
                <div className="mt-3 flex justify-end">
                  <CheckCheck className="size-4 text-primary-foreground" />
                </div>
              </div>
              <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-border px-4 py-2 text-xs text-muted-foreground dark:border-border dark:text-muted-foreground">
                <Users className="size-3.5" /> Votre équipe peut prendre le
                relais
              </div>
            </div>
            <p className="mt-8 text-xs text-muted-foreground dark:text-muted-foreground">
              Illustration du parcours de conversation
            </p>
          </figure>
        </section>

        <section
          aria-labelledby="principles-title"
          className="border-y py-14 lg:py-20"
        >
          <div className="mb-10 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="mb-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                02 / Ce qui nous guide
              </p>
              <h2
                id="principles-title"
                className="text-3xl font-semibold tracking-tight sm:text-4xl"
              >
                Utile. Simple. Humain.
              </h2>
            </div>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Trois principes pour construire un outil qui trouve sa place dans
              votre activité.
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {principles.map(({ icon: Icon, title, text }, index) => (
              <article key={title} className="border-t pt-6">
                <div className="mb-8 flex items-center justify-between">
                  <Icon className="size-6 text-foreground dark:text-foreground" />
                  <span className="font-mono text-xs text-muted-foreground">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mb-3 text-xl font-semibold tracking-tight">
                  {title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {text}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section
          aria-labelledby="process-title"
          className="grid gap-10 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:py-24"
        >
          <div>
            <p className="mb-4 text-xs uppercase tracking-[0.18em] text-muted-foreground">
              03 / Avancer ensemble
            </p>
            <h2
              id="process-title"
              className="text-3xl font-semibold tracking-tight sm:text-4xl"
            >
              De votre besoin
              <br />à vos premiers échanges.
            </h2>
            <Link
              href="/#tarifs"
              className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium"
            >
              Découvrir nos offres <ArrowRight className="size-4" />
            </Link>
          </div>
          <ol className="space-y-0">
            {[
              [
                "Comprendre",
                "Nous échangeons sur votre activité, vos clients et les demandes que vous souhaitez mieux gérer.",
              ],
              [
                "Connecter",
                "Vous reliez votre compte WhatsApp à votre espace et retrouvez vos conversations au même endroit.",
              ],
              [
                "Tester et ajuster",
                "Vous observez les réponses de l’assistant, validez son usage et gardez la possibilité de reprendre la main.",
              ],
            ].map(([title, text], index) => (
              <li key={title} className="flex gap-5 border-t py-6">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs">
                  0{index + 1}
                </span>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {text}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="mb-16 flex flex-col justify-between gap-8 rounded-3xl bg-primary p-7 text-primary-foreground sm:p-12 md:flex-row md:items-center">
          <div>
            <p className="mb-4 flex items-center gap-2 text-xs uppercase tracking-widest text-primary-foreground">
              <CircleDot className="size-3.5" /> Construisons la suite
            </p>
            <h2 className="max-w-xl text-3xl font-semibold tracking-tight sm:text-4xl">
              Votre prochaine bonne conversation commence ici.
            </h2>
          </div>
          <Link
            href="/contact"
            className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 rounded-xl bg-background px-6 py-3 font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            Parlons de votre projet <ArrowUpRight className="size-5" />
          </Link>
        </section>
      </main>
      <Footer />
    </>
  );
}
