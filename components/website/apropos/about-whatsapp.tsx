import Link from "next/link";
import {
  ArrowRight,
  CalendarRange,
  Coins,
  Gauge,
  Info,
  Keyboard,
  MessageSquareOff,
  Smartphone,
  Timer,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/website/vitrine/motion";
import {
  SectionIntro,
  SectionShell,
  Serif,
} from "@/components/website/vitrine/primitives";

const POINTS = [
  {
    icon: Smartphone,
    title: "Comme WhatsApp Web",
    text: "Votre numéro est relié à ExtravertyAI comme un appareil associé, de la même façon que WhatsApp Web sur un ordinateur, grâce au logiciel libre Evolution API. Ce n’est pas l’API WhatsApp Business de Meta : ExtravertyAI est un service indépendant, sans lien avec Meta ni WhatsApp.",
  },
  {
    icon: Coins,
    title: "Pourquoi ce choix",
    text: "Pas de facturation à la conversation ni de validation d’entreprise auprès de Meta : des prix accessibles, une mise en place en quelques minutes, et votre application WhatsApp continue de fonctionner normalement sur votre téléphone.",
  },
  {
    icon: Info,
    title: "Ce qu’il faut savoir",
    text: "Ce mode de connexion n’est pas un service officiel de WhatsApp. WhatsApp reste libre de limiter un numéro dont l’usage lui paraît automatisé ou abusif, et nous ne pouvons pas revenir sur sa décision. Ce risque se maîtrise : un usage respectueux de vos clients le rend faible.",
  },
] as const;

/** Protections réellement appliquées par l'application (voir lib/broadcasts.ts, lib/follow-ups.ts). */
const PROTECTIONS = [
  {
    icon: Users,
    title: "Seulement vos contacts",
    text: "Une diffusion ne part qu’aux personnes qui vous ont déjà écrit. Aucune liste de numéros ne peut être importée.",
  },
  {
    icon: MessageSquareOff,
    title: "STOP respecté",
    text: "Chaque diffusion propose de répondre STOP. Le contact ne reçoit alors plus ni diffusion ni relance.",
  },
  {
    icon: Timer,
    title: "Un rythme humain",
    text: "8 à 15 secondes, au hasard, entre deux messages d’une diffusion, et au moins 20 secondes entre deux relances.",
  },
  {
    icon: CalendarRange,
    title: "Aux heures ouvrables",
    text: "Diffusions et relances partent entre 8 h et 20 h, à l’heure de vos clients.",
  },
  {
    icon: Gauge,
    title: "Des volumes plafonnés",
    text: "Plafonds quotidiens et mensuels de diffusion selon l’offre ; relances désactivées par défaut, trois au plus par prospect.",
  },
  {
    icon: Keyboard,
    title: "Des réponses naturelles",
    text: "« En train d’écrire… » s’affiche avant chaque envoi, et l’IA répond aux messages reçus au lieu d’écrire la première.",
  },
] as const;

export function AboutWhatsApp() {
  return (
    <SectionShell id="connexion-whatsapp" labelledBy="connexion-whatsapp-titre">
      <SectionIntro
        index="03"
        eyebrow="Transparence"
        titleId="connexion-whatsapp-titre"
        title={
          <>
            Comment nous nous connectons <Serif>à WhatsApp.</Serif>
          </>
        }
        description="Avant de connecter votre numéro, voici comment fonctionne la connexion, et ce que nous faisons pour le protéger."
      />
      <ul className="grid gap-px border-t bg-border md:grid-cols-3">
        {POINTS.map(({ icon: Icon, title, text }, index) => (
          <li key={title} className="bg-background">
            <Reveal delay={index * 0.06} className="flex h-full flex-col gap-6 px-4 py-10 sm:px-8 lg:px-12">
              <span className="flex size-10 items-center justify-center rounded-xl border">
                <Icon aria-hidden="true" className="size-4.5" />
              </span>
              <div>
                <h3 className="font-heading text-xl font-semibold tracking-tight text-pretty">{title}</h3>
                <p className="mt-3 max-w-md text-sm text-pretty text-muted-foreground">{text}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ul>
      <div className="border-t px-4 py-10 sm:px-8 lg:px-12">
        <h3
          id="protections-numero"
          className="font-heading text-xl font-semibold tracking-tight text-pretty"
        >
          Ce qu’ExtravertyAI fait pour protéger votre numéro
        </h3>
        <p className="mt-3 max-w-2xl text-sm text-pretty text-muted-foreground">
          Ces protections sont intégrées à l’application et s’appliquent à tous les projets. Elles
          réduisent fortement le risque, sans pouvoir le supprimer : un numéro dédié à votre
          activité reste le meilleur choix.
        </p>
        <ul aria-labelledby="protections-numero" className="mt-8 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
          {PROTECTIONS.map(({ icon: Icon, title, text }) => (
            <li key={title} className="flex gap-3">
              <Icon aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="mt-1 text-sm text-pretty text-muted-foreground">{text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="border-t px-4 py-6 sm:px-8 lg:px-12">
        <Button asChild variant="link" className="h-11 px-0">
          <Link href="/conditions#whatsapp">
            Lire l’article des conditions d’utilisation
            <ArrowRight aria-hidden="true" data-icon="inline-end" />
          </Link>
        </Button>
      </div>
    </SectionShell>
  );
}
