import Link from "next/link";
import type { ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Bot,
  Check,
  FileText,
  Hand,
  Lock,
  ShieldCheck,
  Sparkles,
  Trash2,
  Users,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { signUpPlanHref } from "@/lib/auth-redirects";
import { PRICING_PLANS, formatPlanPrice, projectPlanHref } from "@/lib/pricing";
import { Button } from "@/components/ui/button";

import { AccountButton } from "./account-button";
import { AnalyticsPreview } from "./analytics-preview";
import {
  InstinctWidget,
  SpotlightCell,
  SummaryWidget,
  TakeoverWidget,
  VoiceWidget,
} from "./bento-widgets";
import { MessagePipeline } from "./message-pipeline";
import { Reveal } from "./motion";
import { FeatureMatrix } from "./pricing-matrix";
import { Crosshair, Eyebrow, SectionIntro, SectionShell, Serif } from "./primitives";

/* -------------------------------------------------------------------------- */
/* 01 · Pipeline                                                               */
/* -------------------------------------------------------------------------- */

export function PipelineSection() {
  return (
    <SectionShell id="parcours" labelledBy="parcours-titre">
      <SectionIntro
        index="01"
        eyebrow="Parcours d’un message"
        titleId="parcours-titre"
        title={
          <>
            Du message reçu à la bonne décision, <Serif>sans attendre.</Serif>
          </>
        }
        description="Texte, note vocale ou photo : chaque message suit le même chemin. L’IA comprend, applique vos règles, puis répond, qualifie ou alerte votre équipe."
      />
      <MessagePipeline />
    </SectionShell>
  );
}

/* -------------------------------------------------------------------------- */
/* 02 · Features bento                                                         */
/* -------------------------------------------------------------------------- */

interface CellHeaderProps {
  index: string;
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}

function CellHeader({ index, icon: Icon, title, children }: CellHeaderProps) {
  return (
    <header>
      <div className="mb-10 flex items-center justify-between">
        <span className="flex size-9 items-center justify-center rounded-md border bg-card">
          <Icon aria-hidden="true" className="size-4" />
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">{index}</span>
      </div>
      <h3 className="text-2xl tracking-tight">{title}</h3>
      <p className="mt-2 max-w-md text-pretty text-sm text-muted-foreground">{children}</p>
    </header>
  );
}

const TEAM: readonly { name: string; role: string; handles: number; ai?: boolean }[] = [
  { name: "Assistant IA", role: "Toujours actif", handles: 28, ai: true },
  { name: "Clara", role: "Administratrice", handles: 4 },
  { name: "Inès", role: "Membre", handles: 2 },
];

function TeamWidget() {
  return (
    <div className="mt-8 rounded-lg border bg-card">
      <p
        aria-hidden="true"
        className="flex justify-between border-b px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
      >
        <span>Membre</span>
        <span>En cours</span>
      </p>
      <ul className="divide-y">
        {TEAM.map((member) => (
          <li key={member.name} className="flex items-center gap-3 px-3 py-2.5">
            <span
              className={cn(
                "relative flex size-8 shrink-0 items-center justify-center rounded-full font-heading text-[11px] font-bold",
                member.ai ? "bg-primary text-primary-foreground" : "bg-secondary",
              )}
            >
              {member.ai ? <Bot aria-hidden="true" className="size-4" /> : member.name.slice(0, 1)}
              <span
                aria-hidden="true"
                className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-card bg-foreground"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{member.name}</span>
              <span className="block truncate font-mono text-[11px] text-muted-foreground">{member.role}</span>
            </span>
            <span className="shrink-0 font-mono text-sm tabular-nums">
              {member.handles}
              <span className="sr-only"> conversations en cours</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FeaturesSection() {
  return (
    <SectionShell id="fonctionnalites" labelledBy="fonctionnalites-titre">
      <SectionIntro
        index="02"
        eyebrow="Fonctionnalités"
        titleId="fonctionnalites-titre"
        title={
          <>
            L’IA absorbe le volume. <Serif>Vous gardez la main.</Serif>
          </>
        }
        description="Chaque brique est pensée pour que votre équipe intervienne moins souvent, mais toujours au bon moment. Essayez-les ci-dessous."
      />
      <div className="grid gap-px border-t bg-border md:grid-cols-6 lg:grid-cols-12">
        <SpotlightCell className="p-6 sm:p-8 md:col-span-6 lg:col-span-7">
          <CellHeader index="02.1" icon={Hand} title="Reprise en main en un clic">
            Un interrupteur par conversation : l’IA se met en retrait et vous
            répondez vous-même, sans quitter le fil.
          </CellHeader>
          <TakeoverWidget />
        </SpotlightCell>
        <SpotlightCell className="p-6 sm:p-8 md:col-span-6 lg:col-span-5">
          <CellHeader index="02.2" icon={AudioLines} title="Voix et images comprises">
            Les notes vocales sont retranscrites, les photos analysées. Vos
            clients s’expriment comme ils en ont l’habitude.
          </CellHeader>
          <VoiceWidget />
        </SpotlightCell>
        <SpotlightCell className="p-6 sm:p-8 md:col-span-3 lg:col-span-4">
          <CellHeader index="02.3" icon={FileText} title="Résumés IA">
            Comprenez 80 messages en trois lignes avant de rappeler un client.
          </CellHeader>
          <SummaryWidget />
        </SpotlightCell>
        <SpotlightCell className="p-6 sm:p-8 md:col-span-3 lg:col-span-4">
          <CellHeader index="02.4" icon={Sparkles} title="Instinct IA">
            Les prospects intéressants et ceux à relancer sont repérés après
            chaque message.
          </CellHeader>
          <InstinctWidget />
        </SpotlightCell>
        <SpotlightCell className="p-6 sm:p-8 md:col-span-6 lg:col-span-4">
          <CellHeader index="02.5" icon={Users} title="Toute l’équipe, un seul fil">
            Propriétaire, administrateur, membre : chacun voit ce dont il a
            besoin, et l’IA travaille à côté de vous.
          </CellHeader>
          <TeamWidget />
        </SpotlightCell>
      </div>
    </SectionShell>
  );
}

/* -------------------------------------------------------------------------- */
/* 03 · Analytics                                                              */
/* -------------------------------------------------------------------------- */

export function AnalyticsSection() {
  return (
    <SectionShell id="analytique" labelledBy="analytique-titre">
      <SectionIntro
        index="03"
        eyebrow="Analytique"
        titleId="analytique-titre"
        title={
          <>
            Votre service client, <Serif>mesuré en direct.</Serif>
          </>
        }
        description="Volume, temps de première réponse, part résolue par l’IA, transferts : tout est visible au même endroit. En offre Business, l’essentiel arrive aussi chaque lundi par email."
      />
      <Reveal>
        <AnalyticsPreview />
      </Reveal>
    </SectionShell>
  );
}

/* -------------------------------------------------------------------------- */
/* 04 · Pricing and feature matrix                                             */
/* -------------------------------------------------------------------------- */

function PricingPlans() {
  return (
    <ul className="grid gap-px border-t bg-border md:grid-cols-3">
      {PRICING_PLANS.map((plan) => {
        const featured = plan.highlighted;
        return (
          <li
            key={plan.id}
            className={cn(
              // Subgrid keeps prices, buttons and lists on the same lines across plans.
              "flex flex-col px-4 py-10 sm:px-8 md:row-span-5 md:grid md:grid-rows-subgrid lg:px-10",
              featured ? "bg-primary text-primary-foreground" : "bg-background",
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-2xl tracking-tight">{plan.name}</h3>
              {featured && (
                <span className="rounded-full bg-primary-foreground px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                  Le plus choisi
                </span>
              )}
            </div>
            <p
              className={cn(
                "mt-2 min-h-10 text-sm",
                featured ? "text-primary-foreground/70" : "text-muted-foreground",
              )}
            >
              {plan.description}
            </p>
            <p className="mt-8 flex items-baseline gap-1.5">
              <span className="font-heading text-5xl font-bold tracking-tight">
                {formatPlanPrice(plan.priceCents)}
              </span>
              <span className={cn("text-sm", featured ? "text-primary-foreground/70" : "text-muted-foreground")}>
                / mois
              </span>
            </p>
            {/* Signed in: straight to the project creation with this plan. */}
            <AccountButton
              href={signUpPlanHref(plan.id)}
              signedInHref={projectPlanHref(plan.id)}
              size="lg"
              variant={featured ? "secondary" : "outline"}
              className="group/cta mt-8 h-11 w-full"
            >
              Choisir {plan.name}
              <ArrowRight
                data-icon="inline-end"
                className="transition-transform group-hover/cta:translate-x-0.5"
              />
            </AccountButton>
            <ul className="mt-8 space-y-2.5 text-sm">
              {plan.features.slice(0, 4).map((feature) => (
                <li key={feature} className="flex gap-2.5">
                  <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span className={featured ? "text-primary-foreground/85" : undefined}>{feature}</span>
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

export function PricingSection() {
  return (
    <SectionShell id="tarifs" labelledBy="tarifs-titre">
      <SectionIntro
        index="04"
        eyebrow="Tarifs"
        titleId="tarifs-titre"
        title={
          <>
            Des offres simples, <Serif>sans engagement.</Serif>
          </>
        }
        description="10 jours d’essai gratuit, puis un abonnement mensuel. Changez d’offre ou arrêtez quand vous le souhaitez."
        aside={
          <Link
            href="/tarifs"
            className="group inline-flex items-center gap-1.5 rounded-sm text-sm underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Toutes les questions de facturation
            <ArrowUpRight
              aria-hidden="true"
              className="size-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </Link>
        }
      />
      <PricingPlans />
      <FeatureMatrix />
    </SectionShell>
  );
}

/* -------------------------------------------------------------------------- */
/* 05 · Security                                                               */
/* -------------------------------------------------------------------------- */

const SAFEGUARDS: readonly { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Lock, title: "Isolation par projet", text: "Chaque espace est cloisonné : aucune donnée partagée entre clients." },
  { icon: ShieldCheck, title: "Accès par rôle", text: "Des permissions fines pour chaque membre de l’équipe." },
  { icon: FileText, title: "Export à tout moment", text: "Vos contacts et conversations exportables en CSV." },
  { icon: Trash2, title: "Suppression maîtrisée", text: "Supprimez un projet ou votre compte, preuve à l’appui." },
];

export function SecuritySection() {
  return (
    <SectionShell id="securite" labelledBy="securite-titre">
      <SectionIntro
        index="05"
        eyebrow="Sécurité"
        titleId="securite-titre"
        title={
          <>
            Vos conversations <Serif>restent les vôtres.</Serif>
          </>
        }
        description="Nous traitons vos échanges clients avec le niveau d’exigence que vous attendez d’un outil professionnel."
      />
      <ul className="grid gap-px border-t bg-border sm:grid-cols-2 lg:grid-cols-4">
        {SAFEGUARDS.map(({ icon: Icon, title, text }, index) => (
          <li key={title} className="group bg-background px-4 py-10 sm:px-8">
            <div className="flex items-center justify-between">
              <Icon
                aria-hidden="true"
                className="size-5 transition-transform duration-300 group-hover:-translate-y-0.5 motion-reduce:transition-none"
              />
              <span className="font-mono text-[11px] text-muted-foreground">05.{index + 1}</span>
            </div>
            <p className="mt-10 font-heading text-lg font-semibold">{title}</p>
            <p className="mt-2 text-sm text-muted-foreground">{text}</p>
          </li>
        ))}
      </ul>
    </SectionShell>
  );
}

/* -------------------------------------------------------------------------- */
/* Closing call to action                                                      */
/* -------------------------------------------------------------------------- */

export function FinalCta() {
  return (
    <section aria-labelledby="cta-titre" className="relative border-t">
      <Crosshair className="-left-1.5 -top-1.5 z-10" />
      <Crosshair className="-right-1.5 -top-1.5 z-10" />
      <div className="relative isolate overflow-hidden bg-primary px-4 py-24 text-primary-foreground sm:px-8 md:py-32 lg:px-12">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,var(--primary-foreground)_1px,transparent_1px),linear-gradient(to_bottom,var(--primary-foreground)_1px,transparent_1px)] bg-size-[4.5rem_4.5rem] opacity-10 mask-[radial-gradient(ellipse_70%_80%_at_80%_100%,black,transparent)]"
        />
        <Eyebrow className="text-primary-foreground/60">Prêt en 5 minutes · Sans changer de numéro</Eyebrow>
        <h2
          id="cta-titre"
          className="mt-6 max-w-5xl text-balance text-5xl tracking-tight md:text-7xl lg:text-8xl"
        >
          Ne laissez plus un message <Serif>sans réponse.</Serif>
        </h2>
        <div className="mt-12 flex flex-col gap-3 sm:flex-row">
          <AccountButton
            href="/sign-up"
            size="lg"
            variant="secondary"
            className="group h-11 px-5"
            signedInLabel={
              <>
                Ouvrir mon espace
                <ArrowRight
                  data-icon="inline-end"
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </>
            }
          >
            Commencer gratuitement
            <ArrowRight
              data-icon="inline-end"
              className="transition-transform group-hover:translate-x-0.5"
            />
          </AccountButton>
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="h-11 px-5 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground dark:hover:bg-primary-foreground/10"
          >
            <Link href="/contact">Parler à l’équipe</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
