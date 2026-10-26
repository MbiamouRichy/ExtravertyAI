import Link from "next/link";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { signUpPlanHref } from "@/lib/auth-redirects";
import {
  PRICING_PLANS,
  formatMessageLimit,
  formatPlanPrice,
} from "@/lib/pricing";
import { Button } from "@/components/ui/button";

export function PricingPlans() {
  return (
    <ul className="grid gap-4 lg:grid-cols-3">
      {PRICING_PLANS.map((plan) => (
        <li
          key={plan.id}
          className={cn(
            "relative flex flex-col rounded-2xl border bg-card p-6 sm:p-8",
            plan.highlighted &&
              "border-primary shadow-xl shadow-foreground/10 ring-1 ring-primary lg:-my-3 lg:py-11",
          )}
        >
          {plan.highlighted && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-1 text-xs text-primary-foreground">
              Le plus choisi
            </span>
          )}
          <h3 className="text-xl">{plan.name}</h3>
          <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.description}</p>
          <p className="mt-6 flex items-baseline gap-1">
            <span className="font-heading text-4xl font-bold tracking-tight tabular-nums">
              {formatPlanPrice(plan.priceCents)}
            </span>
            <span className="text-sm text-muted-foreground">/ mois</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {formatMessageLimit(plan.messageLimit)} messages inclus · 10 jours d’essai
          </p>
          <Button
            asChild
            size="lg"
            variant={plan.highlighted ? "default" : "outline"}
            className="mt-6 w-full"
          >
            <Link href={signUpPlanHref(plan.id)}>Choisir {plan.name}</Link>
          </Button>
          <ul className="mt-8 space-y-3 border-t pt-6">
            {plan.features.map((feature) => (
              <li key={feature} className="flex gap-2.5 text-sm">
                <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                <span className="text-muted-foreground">{feature}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
