"use client";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import React from "react";
import { Button } from "@/components/ui/button";
import { PRICING_PLANS } from "@/lib/pricing";
import { signUpPlanHref } from "@/lib/auth-redirects";
import { StarIcon, CheckCircleIcon } from "lucide-react";

const plans = PRICING_PLANS.map((plan) => ({
  ...plan,
  info: plan.description,
  price: plan.priceCents / 100,
  btn: { text: `Choisir ${plan.name}`, href: signUpPlanHref(plan.id) },
}));
type Plan = (typeof plans)[number];

export function Tarifs() {
  return (
    <section
      id="tarifs"
      className="flex w-full flex-col items-center justify-center gap-7 py-10 px-2 md:px-4 scroll-mt-24"
    >
      <div className="md:mx-auto w-full max-w-3xl space-y-2">
        <h4 className="text-center font-bold text-2xl tracking-tight md:text-3xl lg:font-extrabold lg:text-4xl">
          Nos tarifs simples et transparents!
        </h4>
        <p className="text-center text-muted-foreground text-base md:text-lg">
          Choisissez l&apos;offre adaptée à votre business et commencez à
          répondre automatiquement à vos clients dès aujourd&apos;hui.
        </p>
        <p className="text-sm text-muted-foreground text-center">
          Tarifs mensuels en dollars américains, par projet. Un numéro WhatsApp
          inclus.
        </p>
      </div>

      <div className="md:mx-auto grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <PricingCard key={plan.name} plan={plan} />
        ))}
      </div>
    </section>
  );
}

type PricingCardProps = React.ComponentProps<"div"> & {
  plan: Plan;
};

export function PricingCard({
  plan,
  className,

  ...props
}: PricingCardProps) {
  return (
    <div
      className={cn(
        "relative flex w-full flex-col overflow-hidden rounded-lg border shadow-xs",
        plan.highlighted && "md:scale-105",
        className,
      )}
      key={plan.name}
      {...props}
    >
      <div
        className={cn(
          "border-b p-2 md:p-4",
          plan.highlighted && "bg-primary/5 dark:bg-card",
        )}
      >
        <div className="flex flex-row justify-between items-center w-full">
          <p className="font-medium text-lg md:text-xl">{plan.name}</p>

          <AnimatePresence mode="wait">
            <div className="flex items-center gap-2">
              {plan.highlighted && (
                <motion.div
                  className="flex items-center gap-1 rounded-md border bg-background md:px-2 py-0.5 text-xs"
                  key="popular-badge"
                  layout
                  transition={{ duration: 0.1 }}
                >
                  <StarIcon className="size-3 fill-current" />
                  Populaire
                </motion.div>
              )}
            </div>
          </AnimatePresence>
        </div>
        <p className="font-normal max-w-74 md:max-w-full text-muted-foreground text-sm md:text-base">
          {plan.info}
        </p>
        <h3 className="mt-6 mb-1 flex w-max items-end gap-1">
          <NumberFlow
            locales="fr-FR"
            className="font-extrabold text-3xl [&::part(suffix)]:font-normal [&::part(suffix)]:text-base [&::part(suffix)]:text-muted-foreground"
            format={{
              style: "currency",
              currency: "USD",
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }}
            suffix=" / mois"
            value={plan.price}
          />
        </h3>
        <p className="mb-2 font-normal text-muted-foreground text-xs md:text-sm">
          Paiement mensuel
        </p>
      </div>
      <div
        className={cn(
          "space-y-3 px-2 md:px-4 pt-6 pb-8 text-muted-foreground text-sm",
          plan.highlighted && "bg-muted/10",
        )}
      >
        {plan.features.map((feature) => (
          <div className="flex items-center gap-2" key={feature}>
            <CheckCircleIcon className="size-3.5 shrink-0 text-foreground" />
            <p className="w-auto text-sm md:text-base">{feature}</p>
          </div>
        ))}
      </div>
      <div
        className={cn(
          "mt-auto w-full border-t py-2 px-1 md:p-3",
          plan.highlighted && "bg-card dark:bg-card/80",
        )}
      >
        <Button
          asChild
          className="w-full"
          variant={plan.highlighted ? "default" : "outline"}
        >
          <Link title={plan.btn.text} href={plan.btn.href}>
            {plan.btn.text}
          </Link>
        </Button>
      </div>
    </div>
  );
}
