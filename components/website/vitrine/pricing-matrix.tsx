"use client";

import { useState } from "react";
import { Check, ChevronDown, CircleHelp, Minus } from "lucide-react";

import { cn } from "@/lib/utils";
import { PRICING_PLANS, formatPlanPrice, type PlanId } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  INCLUDED_EVERYWHERE,
  MATRIX_DETAIL_GROUPS,
  MATRIX_GROUPS,
  MATRIX_HINTS,
  type MatrixCell,
} from "./data";
import { Eyebrow } from "./primitives";

function CellValue({ value }: { value: MatrixCell }) {
  if (value === true) {
    return (
      <>
        <Check aria-hidden="true" className="mx-auto size-4" />
        <span className="sr-only">Inclus</span>
      </>
    );
  }
  if (value === false) {
    return (
      <>
        <Minus
          aria-hidden="true"
          className="mx-auto size-4 text-muted-foreground/50"
        />
        <span className="sr-only">Non inclus</span>
      </>
    );
  }
  return <span className="font-mono text-xs">{value}</span>;
}

/** Icône d’aide : au clic ou au toucher, une phrase explique la fonctionnalité. */
function FeatureHint({ label, hint }: { label: string; hint: string }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="ml-1 shrink-0 align-middle text-muted-foreground hover:text-foreground"
          aria-label={`En savoir plus : ${label}`}
        >
          <CircleHelp aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-64 p-3 text-xs leading-relaxed"
      >
        <p className="mb-1 font-medium text-foreground">{label}</p>
        <p className="text-muted-foreground">{hint}</p>
      </PopoverContent>
    </Popover>
  );
}

/** Full comparison. On phones a plan switcher keeps the table to two readable columns. */
export function FeatureMatrix() {
  const [mobilePlan, setMobilePlan] = useState<PlanId>("pro");
  // Comparatif court par défaut ; le détail complet se déplie à la demande.
  const [showAll, setShowAll] = useState(false);
  const groups = showAll
    ? [...MATRIX_GROUPS, ...MATRIX_DETAIL_GROUPS]
    : MATRIX_GROUPS;

  return (
    <div className="border-t px-4 py-16 sm:px-8 lg:px-12">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow>Matrice des fonctionnalités</Eyebrow>
          <h3 id="matrice-titre" className="mt-3 text-3xl tracking-tight">
            Comparer en détail
          </h3>
        </div>
        <div
          role="group"
          aria-label="Offre affichée dans le tableau"
          className="inline-flex w-fit rounded-lg border p-0.5 sm:hidden"
        >
          {PRICING_PLANS.map((plan) => (
            <Button
              key={plan.id}
              type="button"
              size="sm"
              variant={mobilePlan === plan.id ? "secondary" : "ghost"}
              aria-pressed={mobilePlan === plan.id}
              onClick={() => setMobilePlan(plan.id)}
            >
              {plan.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Ce qui est identique partout : dit une fois, sans encombrer le tableau. */}
      <section
        aria-labelledby="inclus-titre"
        className="mt-8 rounded-2xl border bg-muted/30 p-4 sm:p-5"
      >
        <h4
          id="inclus-titre"
          className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
        >
          Inclus dans toutes les offres
        </h4>
        <ul className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {INCLUDED_EVERYWHERE.map((item) => (
            <li key={item} className="flex items-start gap-2">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </section>

      <table
        id="matrice-tableau"
        aria-labelledby="matrice-titre"
        className="mt-10 w-full border-collapse text-sm"
      >
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky top-16 z-10 w-3/5 bg-background/95 py-4 text-left backdrop-blur sm:w-2/5"
            >
              <span className="sr-only">Fonctionnalité</span>
            </th>
            {PRICING_PLANS.map((plan) => (
              <th
                key={plan.id}
                scope="col"
                className={cn(
                  "sticky top-16 z-10 bg-background/95 px-2 py-4 text-center font-heading text-base font-bold backdrop-blur sm:w-1/5",
                  plan.id !== mobilePlan && "hidden sm:table-cell",
                )}
              >
                {plan.highlighted && (
                  <span className="mx-auto mb-1.5 block w-fit rounded-full bg-primary px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-primary-foreground">
                    Le plus choisi
                  </span>
                )}
                {plan.name}
                <span className="block font-mono text-[11px] font-normal text-muted-foreground">
                  {formatPlanPrice(plan.priceCents)} / mois
                </span>
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.title}>
            <tr>
              <th
                scope="colgroup"
                colSpan={PRICING_PLANS.length + 1}
                className="pb-3 pt-10 text-left font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
              >
                {group.title}
              </th>
            </tr>
            {group.rows.map((row) => (
              <tr
                key={row.label}
                className="border-t transition-colors hover:bg-muted/40"
              >
                <th scope="row" className="py-3.5 pr-4 text-left font-normal">
                  {row.label}
                  {MATRIX_HINTS[row.label] && (
                    <FeatureHint
                      label={row.label}
                      hint={MATRIX_HINTS[row.label]}
                    />
                  )}
                </th>
                {PRICING_PLANS.map((plan) => (
                  <td
                    key={plan.id}
                    className={cn(
                      "px-2 py-3.5 text-center",
                      plan.highlighted && "bg-muted/40",
                      plan.id !== mobilePlan && "hidden sm:table-cell",
                    )}
                  >
                    <CellValue value={row.values[plan.id]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ))}
      </table>

      <div className="mt-8 flex justify-center">
        <Button
          type="button"
          variant="outline"
          aria-expanded={showAll}
          aria-controls="matrice-tableau"
          onClick={() => setShowAll((value) => !value)}
        >
          {showAll ? "Masquer le détail" : "Voir toutes les fonctionnalités"}
          <ChevronDown
            data-icon="inline-end"
            className={cn(
              "transition-transform motion-reduce:transition-none",
              showAll && "rotate-180",
            )}
          />
        </Button>
      </div>
    </div>
  );
}
