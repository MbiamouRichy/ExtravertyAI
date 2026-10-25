
import Link from "next/link";
import { Check, Minus } from "lucide-react";

import { PRICING_PLANS, formatMessageLimit } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SiteNav } from "@/components/website/vitrine/site-nav";
import { SiteFooter } from "@/components/website/vitrine/site-footer";
import { PricingPlans } from "@/components/website/pricing/pricing-plans";



type Cell = boolean | string;

const comparison: { group: string; rows: { label: string; values: Cell[] }[] }[] = [
  {
    group: "Volume",
    rows: [
      {
        label: "Messages par mois",
        values: PRICING_PLANS.map((plan) => formatMessageLimit(plan.messageLimit)),
      },
      { label: "Utilisateurs", values: PRICING_PLANS.map((plan) => String(plan.users)) },
      { label: "Numéros WhatsApp", values: ["1", "1", "1"] },
      { label: "Stockage des fichiers", values: PRICING_PLANS.map((plan) => plan.storage) },
    ],
  },
  {
    group: "Intelligence artificielle",
    rows: [
      { label: "Réponses texte 24/7", values: [true, true, true] },
      { label: "Notes vocales", values: [false, true, true] },
      { label: "Compréhension des images", values: [false, false, true] },
      { label: "Mémoire de contexte", values: ["20 messages", "30 messages", "50 messages"] },
      { label: "Résumé des conversations", values: [false, true, true] },
      { label: "Qualification des prospects", values: [false, true, true] },
    ],
  },
  {
    group: "Pilotage",
    rows: [
      { label: "Historique des statistiques", values: ["30 jours", "90 jours", "12 mois"] },
      { label: "Pipeline de prospects", values: [false, true, true] },
      { label: "Google Sheets", values: [true, true, true] },
      { label: "Webhooks (Make, Zapier, CRM)", values: [false, true, true] },
      { label: "Assignation automatique", values: [false, false, true] },
      { label: "Export CSV des contacts", values: [true, true, true] },
      { label: "Rapports programmés", values: [false, false, true] },
      { label: "Support", values: ["Standard", "Prioritaire", "Prioritaire"] },
    ],
  },
];

const faqs = [
  {
    q: "Comment fonctionne l’essai gratuit ?",
    a: "Chaque offre démarre par 10 jours d’essai. Une carte est demandée à l’inscription, mais aucun prélèvement n’a lieu avant la fin de l’essai et vous pouvez annuler avant.",
  },
  {
    q: "Puis-je changer d’offre en cours de mois ?",
    a: "Oui. La différence est calculée au prorata et appliquée immédiatement sur votre prochaine facture.",
  },
  {
    q: "Qu’est-ce qui compte comme un message ?",
    a: "Chaque message envoyé depuis votre numéro connecté, par l’IA ou par un membre de l’équipe. Les messages reçus de vos clients ne sont pas comptés.",
  },
  {
    q: "Comment fonctionne la résiliation ?",
    a: "Sans engagement : vous résiliez depuis la page Facturation et gardez l’accès jusqu’à la fin de la période payée.",
  },
];

function CellValue({ value }: { value: Cell }) {
  if (value === true)
    return (
      <>
        <Check aria-hidden="true" className="mx-auto size-4" />
        <span className="sr-only">Inclus</span>
      </>
    );
  if (value === false)
    return (
      <>
        <Minus aria-hidden="true" className="mx-auto size-4 text-muted-foreground/50" />
        <span className="sr-only">Non inclus</span>
      </>
    );
  return <span className="tabular-nums">{value}</span>;
}

export function PricingPage() {
  return (
    <>
      <SiteNav />
      <main id="contenu">
        <section aria-labelledby="tarifs-titre" className="px-4 pb-24 pt-14 sm:px-6 md:pt-20">
          <div className="mx-auto mb-12 max-w-2xl text-center">
            <p className="mb-3 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Tarifs
            </p>
            <h1 id="tarifs-titre" className="text-balance text-4xl md:text-6xl">
              Un prix clair pour chaque étape
            </h1>
            <p className="mt-5 text-pretty text-muted-foreground">
              Sans engagement, sans frais cachés. Changez d’offre quand votre
              volume évolue.
            </p>
          </div>
          <div className="mx-auto w-full max-w-6xl">
            <PricingPlans />
          </div>
        </section>

        <section aria-labelledby="comparatif" className="px-4 pb-24 sm:px-6">
          <div className="mx-auto w-full max-w-6xl">
            <h2 id="comparatif" className="mb-8 text-center text-3xl tracking-tight">
              Comparer en détail
            </h2>
            <div className="overflow-x-auto rounded-2xl border">
              <table className="w-full min-w-[40rem] border-collapse text-sm">
                <caption className="sr-only">
                  Comparatif des fonctionnalités par offre
                </caption>
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b">
                    <th scope="col" className="w-2/5 px-5 py-4 text-left font-normal text-muted-foreground">
                      Fonctionnalité
                    </th>
                    {PRICING_PLANS.map((plan) => (
                      <th
                        key={plan.id}
                        scope="col"
                        className="px-5 py-4 text-center font-heading text-base font-semibold"
                      >
                        {plan.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                {comparison.map((section) => (
                  <tbody key={section.group}>
                    <tr className="bg-muted/50">
                      <th
                        scope="colgroup"
                        colSpan={PRICING_PLANS.length + 1}
                        className="px-5 py-2.5 text-left font-mono text-xs uppercase tracking-wider text-muted-foreground"
                      >
                        {section.group}
                      </th>
                    </tr>
                    {section.rows.map((row) => (
                      <tr key={row.label} className="border-t">
                        <th scope="row" className="px-5 py-3.5 text-left font-normal">
                          {row.label}
                        </th>
                        {row.values.map((value, index) => (
                          <td key={index} className="px-5 py-3.5 text-center">
                            <CellValue value={value} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </div>
          </div>
        </section>

        <section aria-labelledby="tarifs-faq" className="px-4 pb-24 sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <h2 id="tarifs-faq" className="mb-6 text-center text-3xl tracking-tight">
              Questions sur la facturation
            </h2>
            <Accordion type="single" collapsible>
              {faqs.map((item, index) => (
                <AccordionItem key={item.q} value={`q-${index}`}>
                  <AccordionTrigger className="text-left text-base">{item.q}</AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
            <div className="mt-10 flex flex-col items-center gap-3 rounded-2xl border bg-muted/30 p-8 text-center">
              <p className="font-heading text-lg font-semibold">
                Plus de 25 000 messages par mois ?
              </p>
              <p className="text-sm text-muted-foreground">
                Parlons d’une offre adaptée à votre volume.
              </p>
              <Button asChild variant="outline">
                <Link href="/contact">Contacter l’équipe</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
