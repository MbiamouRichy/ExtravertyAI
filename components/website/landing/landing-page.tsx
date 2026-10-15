import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  BarChart3,
  Bot,
  Check,
  Clock3,
  FileText,
  Hand,
  Inbox,
  Lock,
  QrCode,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
} from "lucide-react";

import { PRICING_PLANS, formatPlanPrice } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Header } from "@/components/website/header";
import Footer from "@/components/website/footer";
import { HeroPreview } from "@/components/website/landing/hero-preview";
import { UseCases } from "@/components/website/landing/use-cases";

const facts = [
  { value: "24/7", label: "Réponses, même la nuit et le week-end" },
  { value: "< 5 min", label: "Pour connecter votre numéro WhatsApp" },
  { value: "3 formats", label: "Texte, notes vocales et images compris" },
  { value: "1 clic", label: "Pour reprendre la main sur l’IA" },
];

const steps = [
  {
    icon: QrCode,
    title: "Connectez WhatsApp",
    text: "Scannez un QR code depuis votre téléphone. Votre numéro reste le vôtre, vos clients ne voient aucune différence.",
  },
  {
    icon: SlidersHorizontal,
    title: "Instruisez votre agent",
    text: "Décrivez votre activité, vos prix et votre ton. L’assistant apprend vos règles en quelques minutes.",
  },
  {
    icon: Bot,
    title: "Laissez-le travailler",
    text: "Il répond, qualifie et vous alerte quand un humain doit intervenir. Vous suivez tout depuis la messagerie.",
  },
];

const faqs = [
  {
    q: "Mes clients sauront-ils qu’ils parlent à une IA ?",
    a: "Vous choisissez le ton et la signature de l’assistant. Nous recommandons la transparence : l’assistant peut se présenter et proposer un conseiller humain à tout moment.",
  },
  {
    q: "Puis-je reprendre une conversation manuellement ?",
    a: "Oui. Un interrupteur par conversation désactive l’IA instantanément. Vous pouvez aussi mettre toute l’automatisation en pause depuis les réglages du projet.",
  },
  {
    q: "Dois-je changer de numéro WhatsApp ?",
    a: "Non. Vous connectez votre numéro existant en scannant un QR code, comme pour WhatsApp Web.",
  },
  {
    q: "Que se passe-t-il si j’atteins mon quota de messages ?",
    a: "Vous êtes prévenu à l’avance. Les conversations restent accessibles et vous pouvez répondre manuellement ou changer d’offre à tout moment.",
  },
  {
    q: "Mes données sont-elles protégées ?",
    a: "Les accès sont isolés par projet, les rôles d’équipe limitent ce que chacun peut voir et vous pouvez exporter ou supprimer vos données quand vous le souhaitez.",
  },
];

function SectionHeading({
  eyebrow,
  title,
  description,
  id,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  id: string;
}) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
        {eyebrow}
      </p>
      <h2 id={id} className="scroll-mt-24 text-balance text-3xl tracking-tight md:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-pretty text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

export function LandingPage() {
  const pro = PRICING_PLANS.find((plan) => plan.id === "pro");

  return (
    <>
      <Header />
      <main id="contenu" className="overflow-x-clip">
        {/* Hero */}
        <section
          aria-labelledby="hero-title"
          className="relative isolate px-4 pb-20 pt-14 sm:px-6 md:pt-20"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[radial-gradient(var(--border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_70%_60%_at_50%_0%,black,transparent)] bg-size-[22px_22px]"
          />
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1.05fr_1fr]">
            <div className="text-center lg:text-left">
              <Link
                href="#produit"
                className="group mb-6 inline-flex items-center gap-2 rounded-full border bg-background/80 py-1 pl-1 pr-3 text-xs shadow-xs backdrop-blur transition-colors hover:bg-muted motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-500"
              >
                <span className="rounded-full bg-primary px-2 py-0.5 text-primary-foreground">
                  Nouveau
                </span>
                Résumés IA de chaque conversation
                <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <h1
                id="hero-title"
                className="text-[2.6rem] text-balance sm:text-5xl md:text-6xl motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:delay-75 motion-safe:fill-mode-backwards motion-safe:duration-500"
              >
                Votre WhatsApp répond.
                <span className="block text-muted-foreground">
                  Vous concluez.
                </span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-pretty text-base text-muted-foreground md:text-lg lg:mx-0 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:delay-150 motion-safe:fill-mode-backwards motion-safe:duration-500">
                ExtravertyAI répond à vos clients en quelques secondes, qualifie
                vos prospects et vous passe la main quand ça compte. Sans changer
                de numéro.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:delay-200 motion-safe:fill-mode-backwards motion-safe:duration-500">
                <Button asChild size="lg" className="w-full px-5 sm:w-auto">
                  <Link href="/sign-up">
                    Essai gratuit
                    <ArrowRight data-icon="inline-end" />
                  </Link>
                </Button>
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="w-full px-5 sm:w-auto"
                >
                  <Link href="#etapes">Voir comment ça marche</Link>
                </Button>
              </div>
              <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground lg:justify-start">
                {["10 jours d’essai gratuit", "Prêt en 5 minutes", "Sans engagement"].map(
                  (item) => (
                    <li key={item} className="flex items-center gap-1.5">
                      <Check aria-hidden="true" className="size-3.5 text-foreground" />
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </div>
            <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:delay-300 motion-safe:fill-mode-backwards motion-safe:duration-700">
              <HeroPreview />
            </div>
          </div>
        </section>

        {/* Facts */}
        <section aria-label="ExtravertyAI en chiffres" className="border-y bg-muted/30">
          <dl className="mx-auto grid w-full max-w-6xl grid-cols-2 divide-border md:grid-cols-4 md:divide-x">
            {facts.map((fact) => (
              <div key={fact.value} className="px-4 py-8 text-center sm:px-6">
                <dt className="sr-only">{fact.label}</dt>
                <dd className="font-heading text-3xl font-bold tracking-tight">
                  {fact.value}
                </dd>
                <dd className="mt-1 text-xs text-muted-foreground">{fact.label}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* How it works */}
        <section aria-labelledby="etapes" className="px-4 py-24 sm:px-6">
          <SectionHeading
            id="etapes"
            eyebrow="Mise en route"
            title="Opérationnel avant votre prochain café"
            description="Trois étapes, aucune compétence technique. Vous restez maître de ce que l’assistant dit et fait."
          />
          <ol className="mx-auto grid w-full max-w-6xl gap-4 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }, index) => (
              <li
                key={title}
                className="group relative rounded-2xl border bg-card p-6 transition-shadow hover:shadow-lg hover:shadow-foreground/5"
              >
                <div className="mb-8 flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl border bg-background">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="text-xl">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Bento features */}
        <section
          id="produit"
          aria-labelledby="produit-titre"
          className="scroll-mt-20 px-4 pb-24 sm:px-6"
        >
          <SectionHeading
            id="produit-titre"
            eyebrow="Produit"
            title="Tout ce qu’il faut pour ne plus laisser un client sans réponse"
          />
          <div className="mx-auto grid w-full max-w-6xl auto-rows-[minmax(14rem,auto)] gap-4 md:grid-cols-6">
            <article className="relative overflow-hidden rounded-2xl border bg-card p-6 md:col-span-4">
              <Inbox aria-hidden="true" className="mb-4 size-5" />
              <h3 className="text-xl">Une messagerie pensée pour l’équipe</h3>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Filtrez par statut, voyez qui gère quoi et retrouvez chaque
                échange en une recherche. L’IA et vos conseillers travaillent
                dans le même fil.
              </p>
              <div aria-hidden="true" className="mt-6 grid gap-2 sm:grid-cols-3">
                {[
                  { label: "À traiter", count: 4 },
                  { label: "Gérées par l’IA", count: 28 },
                  { label: "Résolues", count: 112 },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-xs"
                  >
                    <span className="text-muted-foreground">{item.label}</span>
                    <span className="font-mono font-medium">{item.count}</span>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border bg-primary p-6 text-primary-foreground md:col-span-2">
              <Hand aria-hidden="true" className="mb-4 size-5" />
              <h3 className="text-xl">Reprise en main instantanée</h3>
              <p className="mt-2 text-sm opacity-75">
                Un interrupteur suffit. L’IA se met en retrait et vous alerte
                quand un client demande un humain.
              </p>
              <div
                aria-hidden="true"
                className="mt-6 flex items-center justify-between rounded-lg bg-primary-foreground/10 px-3 py-2 text-xs"
              >
                IA active
                <span className="flex h-5 w-9 items-center rounded-full bg-primary-foreground px-0.5">
                  <span className="ml-auto size-4 rounded-full bg-primary" />
                </span>
              </div>
            </article>

            <article className="rounded-2xl border bg-card p-6 md:col-span-2">
              <FileText aria-hidden="true" className="mb-4 size-5" />
              <h3 className="text-xl">Résumés IA</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Comprenez 80 messages en 3 lignes avant de rappeler un client.
              </p>
              <div aria-hidden="true" className="mt-5 space-y-1.5">
                <div className="h-2 w-full rounded-full bg-muted" />
                <div className="h-2 w-4/5 rounded-full bg-muted" />
                <div className="h-2 w-3/5 rounded-full bg-muted" />
              </div>
            </article>

            <article className="rounded-2xl border bg-card p-6 md:col-span-2">
              <Sparkles aria-hidden="true" className="mb-4 size-5" />
              <h3 className="text-xl">Instinct IA</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Après chaque message, l’IA repère les prospects intéressants et
                ceux à relancer, selon les objectifs de votre agent.
              </p>
              <div aria-hidden="true" className="mt-5 flex gap-1.5 text-[11px]">
                <span className="inline-flex items-center gap-1 rounded-full border border-primary bg-primary px-2 py-0.5 text-primary-foreground">
                  <Sparkles className="size-3" />
                  Intéressant
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5">
                  <Clock3 className="size-3" />
                  À suivre
                </span>
              </div>
            </article>

            <article className="rounded-2xl border bg-card p-6 md:col-span-2">
              <AudioLines aria-hidden="true" className="mb-4 size-5" />
              <h3 className="text-xl">Voix et images comprises</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Les notes vocales sont retranscrites, les photos produits
                analysées.
              </p>
              <div aria-hidden="true" className="mt-5 flex h-8 items-end gap-0.5">
                {[3, 6, 4, 8, 5, 9, 4, 7, 3, 6, 8, 5, 3, 7, 4, 6, 3].map((h, i) => (
                  <span
                    key={i}
                    className="w-1.5 rounded-full bg-foreground/70"
                    style={{ height: `${h * 10}%` }}
                  />
                ))}
              </div>
            </article>

            <article className="rounded-2xl border bg-card p-6 md:col-span-3">
              <BarChart3 aria-hidden="true" className="mb-4 size-5" />
              <h3 className="text-xl">Analytique et rapports hebdomadaires</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Volume, temps de première réponse, sources : recevez l’essentiel
                chaque lundi par email.
              </p>
            </article>

            <article className="rounded-2xl border bg-card p-6 md:col-span-3">
              <Users aria-hidden="true" className="mb-4 size-5" />
              <h3 className="text-xl">Équipe, rôles et permissions</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Propriétaire, administrateur, membre : chacun accède uniquement
                à ce dont il a besoin.
              </p>
            </article>
          </div>
        </section>

        {/* Use cases */}
        <section
          id="cas-usage"
          aria-labelledby="cas-usage-titre"
          className="scroll-mt-20 border-t bg-muted/30 px-4 py-24 sm:px-6"
        >
          <SectionHeading
            id="cas-usage-titre"
            eyebrow="Cas d’usage"
            title="Conçu pour les entreprises qui vivent sur WhatsApp"
          />
          <div className="mx-auto w-full max-w-5xl">
            <UseCases />
          </div>
        </section>

        {/* Trust */}
        <section aria-labelledby="confiance" className="px-4 py-24 sm:px-6">
          <div className="mx-auto grid w-full max-w-6xl items-center gap-12 md:grid-cols-2">
            <div>
              <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Sécurité
              </p>
              <h2 id="confiance" className="text-balance text-3xl tracking-tight md:text-4xl">
                Vos conversations restent les vôtres
              </h2>
              <p className="mt-4 text-muted-foreground">
                Nous traitons vos échanges clients avec le niveau d’exigence que
                vous attendez d’un outil professionnel.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: Lock, title: "Isolation par projet", text: "Chaque espace est cloisonné, aucune donnée partagée entre clients." },
                { icon: ShieldCheck, title: "Accès par rôle", text: "Des permissions fines pour chaque membre de l’équipe." },
                { icon: FileText, title: "Export à tout moment", text: "Vos contacts et conversations exportables en CSV." },
                { icon: Hand, title: "Suppression maîtrisée", text: "Supprimez un projet ou votre compte, preuve à l’appui." },
              ].map(({ icon: Icon, title, text }) => (
                <li key={title} className="rounded-xl border p-5">
                  <Icon aria-hidden="true" className="mb-3 size-4" />
                  <p className="font-heading font-semibold">{title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Pricing teaser */}
        <section aria-labelledby="tarifs-apercu" className="px-4 pb-24 sm:px-6">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 rounded-2xl border bg-card p-8 md:flex-row md:items-center md:p-10">
            <div>
              <h2 id="tarifs-apercu" className="text-2xl md:text-3xl">
                Des offres simples, sans engagement
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                À partir de {formatPlanPrice(PRICING_PLANS[0].priceCents)} par
                mois. L’offre {pro?.name} est la plus choisie par les équipes en
                croissance.
              </p>
            </div>
            <Button asChild size="lg" variant="outline" className="shrink-0">
              <Link href="/tarifs">
                Comparer les offres
                <ArrowRight data-icon="inline-end" />
              </Link>
            </Button>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          aria-labelledby="faq-titre"
          className="scroll-mt-20 px-4 pb-24 sm:px-6"
        >
          <div className="mx-auto grid w-full max-w-6xl gap-10 md:grid-cols-[1fr_1.6fr]">
            <div>
              <h2 id="faq-titre" className="text-3xl tracking-tight md:text-4xl">
                Questions fréquentes
              </h2>
              <p className="mt-3 text-sm text-muted-foreground">
                Une autre question ?{" "}
                <Link href="/contact" className="text-foreground underline underline-offset-4">
                  Écrivez-nous
                </Link>
                .
              </p>
            </div>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((item, index) => (
                <AccordionItem key={item.q} value={`faq-${index}`}>
                  <AccordionTrigger className="text-left text-base">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Final CTA */}
        <section aria-labelledby="cta-final" className="px-4 pb-24 sm:px-6">
          <div className="relative isolate mx-auto w-full max-w-6xl overflow-hidden rounded-3xl bg-primary px-6 py-16 text-center text-primary-foreground md:py-20">
            <div
              aria-hidden="true"
              className="absolute inset-0 -z-10 bg-[radial-gradient(var(--primary-foreground)_1px,transparent_1px)] opacity-10 mask-[radial-gradient(ellipse_at_center,black,transparent_70%)] bg-size-[18px_18px]"
            />
            <h2 id="cta-final" className="mx-auto max-w-2xl text-balance text-3xl md:text-5xl">
              Ne laissez plus un message sans réponse.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-sm opacity-75">
              Connectez votre numéro, instruisez votre assistant et regardez-le
              travailler dès aujourd’hui.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" variant="secondary" className="px-5">
                <Link href="/sign-up">
                  Commencer gratuitement
                  <ArrowRight data-icon="inline-end" />
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
