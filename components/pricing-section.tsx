"use client";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import React from "react";
import { Button } from "@/components/ui/button";
import { type FREQUENCY, FrequencyToggle } from "@/components/frequency-toggle";
import { StarIcon, CheckCircleIcon } from "lucide-react";

type Plan = {
  name: string;
  info: string;
  price: {
    Mensuel: number;
    Annuel: number; // prix mensuel si payé à l'année
  };
  features: string[];
  btn: {
    text: string;
    href: string;
  };
  highlighted?: boolean;
};

const plans: Plan[] = [
  {
    name: "Starter",
    info: "Idéal pour débuter et automatiser ses premiers clients",
    price: {
      Mensuel: 15000,
      Annuel: 13000,
    },
    features: [
      "Assistant WhatsApp de base",
      "Réponses automatiques 24h/24",
      "Gestion des messages textuelles",
      "Réponses textuelles uniquement",
      "Installation rapide",
      "Support basique",
    ],
    btn: {
      text: "Commencer maintenant",
      href: "https://wa.me/24176205629?text=Bonjour,%20je%20veux%20commencer%20avec%20le%20plan%20Starter.%20Pouvez-vous%20m'expliquer%20la%20mise%20en%20place%20?",
    },
  },
  {
    highlighted: true,
    name: "Pro",
    info: "Parfait pour les business qui veulent plus de ventes",
    price: {
      Mensuel: 25000,
      Annuel: 22000,
    },
    features: [
      "Tout du plan Starter, plus :",
      "Assistant WhatsApp avancé (comprehension poussée de l'entreprise)",
      "Compréhension des réponses multimodales (texte, audio)",
      "Collecte et analyse des données clients limitée (500 clients/mois)",
      "Personnalisation avancée de l'assistant IA",
      "Support prioritaire",
    ],
    btn: {
      text: "Activer mon assistant",
      href: "https://wa.me/24176205629?text=Bonjour,%20je%20suis%20intéressé%20par%20le%20plan%20Pro.%20Je%20veux%20automatiser%20mes%20ventes%20sur%20WhatsApp.%20Pouvez-vous%20m'accompagner%20?",
    },
  },
  {
    name: "Business",
    info: "Pour les marques et équipes avec fort volume",
    price: {
      Mensuel: 55000,
      Annuel: 45000,
    },
    features: [
      "Tout du plan Pro, plus :",
      "Automatisation complète du service client",
      "Compréhension des réponses multimodales (texte, audio, video, images)",
      "Réponses textuelles et vocales (IA)",
      "Collecte et analyse des données clients illimitée",
      "Gestion des conversations avancée",
      "Intégrations (CRM, Google Sheets, Agenda, etc.)",
      "Optimisation des ventes",
      "Support dédié",
    ],
    btn: {
      text: "Parler à un expert",
      href: "https://wa.me/24176205629?text=Bonjour,%20je%20veux%20une%20solution%20avancée%20pour%20mon%20entreprise.%20Pouvez-vous%20me%20proposer%20une%20offre%20adaptée%20?",
    },
  },
];

export function Tarifs() {
  const [frequency, setFrequency] = React.useState<"Mensuel" | "Annuel">(
    "Mensuel",
  );

  return (
    <div
      id="tarifs"
      className="flex w-full flex-col items-center justify-center gap-7 py-10 px-2 md:px-4"
    >
      <div className="mx-auto max-w-3xl space-y-2">
        <h4 className="text-center font-bold text-2xl tracking-tight md:text-3xl lg:font-extrabold lg:text-4xl">
          Nos tarifs simples et transparents!
        </h4>
        <p className="text-center text-muted-foreground text-sm md:text-base">
          Choisissez l&apos;offre adaptée à votre business et commencez à
          répondre automatiquement à vos clients dès aujourd&apos;hui.
        </p>
        <p className="text-sm text-muted-foreground text-center md:text-base">
          <span className="font-bold text-foreground">+ de 80%</span> des
          clients répondus en moins de 10 secondes grâce à ExtravertyIA
        </p>
      </div>
      <FrequencyToggle frequency={frequency} setFrequency={setFrequency} />

      <div className="md:mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <PricingCard frequency={frequency} key={plan.name} plan={plan} />
        ))}
      </div>
    </div>
  );
}

type PricingCardProps = React.ComponentProps<"div"> & {
  plan: Plan;
  frequency?: FREQUENCY;
};

export function PricingCard({
  plan,
  className,
  frequency = "Mensuel",
  ...props
}: PricingCardProps) {
  return (
    <div
      className={cn(
        "relative flex w-full flex-col overflow-hidden rounded-lg border shadow-xs",
        plan.highlighted && "scale-105",
        className,
      )}
      key={plan.name}
      {...props}
    >
      <div
        className={cn(
          "border-b p-4",
          plan.highlighted && "bg-card dark:bg-card/80",
        )}
      >
        <AnimatePresence mode="wait">
          <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
            {plan.highlighted && (
              <motion.div
                className="flex items-center gap-1 rounded-md border bg-background px-2 py-0.5 text-xs"
                key="popular-badge"
                layout
                transition={{ duration: 0.1 }}
              >
                <StarIcon className="size-3 fill-current" />
                Populaire
              </motion.div>
            )}

            {frequency === "Annuel" &&
              plan.price.Mensuel > plan.price.Annuel && (
                <motion.div
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-1 rounded-md border bg-primary px-2 py-0.5 text-primary-foreground text-xs"
                  exit={{ opacity: 0 }}
                  initial={{ opacity: 0 }}
                  key="discount-badge"
                  layout
                  transition={{ duration: 0.15 }}
                >
                  {/* Calculate the actual discount percentage of the plan */}
                  {Math.round(
                    ((plan.price.Mensuel - plan.price.Annuel) /
                      plan.price.Mensuel) *
                      100,
                  )}
                  % reduit
                </motion.div>
              )}
          </div>
        </AnimatePresence>

        <div className="font-medium text-lg">{plan.name}</div>
        <p className="font-normal text-muted-foreground text-sm">{plan.info}</p>
        <h3 className="mt-6 mb-1 flex w-max items-end gap-1">
          <NumberFlow
            className="font-extrabold text-3xl [&::part(suffix)]:font-normal [&::part(suffix)]:text-base [&::part(suffix)]:text-muted-foreground"
            format={{
              style: "currency",
              currency: "XAF",
              notation: "compact",
            }}
            suffix="/Mensuel"
            value={plan.price[frequency]}
          />
        </h3>
        <p className="mb-2 font-normal text-muted-foreground text-xs">
          Paiement {frequency}
        </p>
      </div>
      <div
        className={cn(
          "space-y-3 px-4 pt-6 pb-8 text-muted-foreground text-sm",
          plan.highlighted && "bg-muted/10",
        )}
      >
        {plan.features.map((feature) => (
          <div className="flex items-center gap-2" key={feature}>
            <CheckCircleIcon className="size-3.5 shrink-0 text-foreground" />
            <p className="w-auto">{feature}</p>
          </div>
        ))}
      </div>
      <div
        className={cn(
          "mt-auto w-full border-t p-3",
          plan.highlighted && "bg-card dark:bg-card/80",
        )}
      >
        <Button
          asChild
          className="w-full"
          variant={plan.highlighted ? "default" : "outline"}
        >
          <Link title={plan.btn.text} href={plan.btn.href} target="_blank">
            {plan.btn.text}
          </Link>
        </Button>
      </div>
    </div>
  );
}
