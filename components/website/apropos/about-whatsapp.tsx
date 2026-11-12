import Link from "next/link";
import { ArrowRight, Cable, Coins, ShieldAlert, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/website/vitrine/motion";
import {
  SectionIntro,
  SectionShell,
  Serif,
} from "@/components/website/vitrine/primitives";

const POINTS = [
  {
    icon: Cable,
    title: "Une connexion non officielle",
    text: "ExtravertyAI relie votre numéro à WhatsApp grâce à Evolution API, un logiciel libre qui utilise le même protocole que WhatsApp Web : votre numéro devient un appareil associé, comme un ordinateur. Ce n’est pas l’API WhatsApp Business officielle de Meta. ExtravertyAI n’est ni affilié à Meta ou à WhatsApp, ni approuvé par eux.",
  },
  {
    icon: Coins,
    title: "Pourquoi ce choix",
    text: "L’API officielle facture chaque conversation et exige une validation d’entreprise auprès de Meta. Notre connexion garde des prix accessibles, se met en place en quelques minutes et laisse votre application WhatsApp fonctionner normalement sur votre téléphone.",
  },
  {
    icon: ShieldAlert,
    title: "Le risque à connaître",
    text: "WhatsApp peut restreindre ou bloquer un numéro dont l’usage lui semble automatisé ou abusif, y compris lorsqu’il est utilisé de bonne foi. Nous ne pouvons ni empêcher une telle décision, ni la lever.",
  },
  {
    icon: ShieldCheck,
    title: "Comment le réduire",
    text: "Utilisez un numéro dédié à votre activité, n’écrivez qu’aux personnes qui vous ont contacté ou qui ont donné leur accord, gardez des diffusions raisonnables et laissez votre équipe reprendre les conversations délicates.",
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
        description="Avant de connecter votre numéro, vous devez savoir comment fonctionne la connexion, et ce qu’elle implique."
      />
      <ul className="grid gap-px border-t bg-border sm:grid-cols-2">
        {POINTS.map(({ icon: Icon, title, text }, index) => (
          <li key={title} className="bg-background">
            <Reveal delay={(index % 2) * 0.08} className="flex h-full flex-col gap-6 px-4 py-10 sm:px-8 lg:px-12">
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
