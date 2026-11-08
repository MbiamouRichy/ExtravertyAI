import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, TriangleAlert } from "lucide-react";

import prisma from "@/lib/prisma";
import { adminMetadata, requireAdminPage } from "@/lib/admin-auth";
import {
  FIRST_COST_MONTH,
  loadAiCosts,
  monthBounds,
  monthKey,
  parseCostMonth,
  shiftMonth,
} from "@/lib/admin-ai-costs";
import { delta } from "@/lib/admin-dashboard";
import { Button } from "@/components/ui/button";
import { DeltaBadge, Panel } from "@/components/admin/dashboard/panel";

export function generateMetadata(): Promise<Metadata> {
  return adminMetadata("Coûts IA");
}

const PLAN_LABEL: Record<string, string> = {
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("fr-FR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Dollars depuis des millionièmes : 4 décimales sous 1 $, pour lire un coût par appel. */
function usd(micros: number | null) {
  if (micros === null) return "—";
  const value = micros / 1_000_000;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: value > 0 && value < 1 ? 4 : 2,
  }).format(value);
}

function monthLabel(key: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(monthBounds(key).start);
}

const plural = (count: number, one: string, many: string) =>
  `${integer.format(count)} ${count > 1 ? many : one}`;

export default async function AdminAiCostsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Revérifié ici : le layout ne protège pas les navigations côté client.
  await requireAdminPage();
  const month = parseCostMonth((await searchParams).mois);
  const report = await loadAiCosts(prisma, month);
  const { totals } = report;
  const previous = shiftMonth(month, -1);
  const next = shiftMonth(month, 1);
  const hasPrevious = month > FIRST_COST_MONTH;
  const hasNext = month < monthKey(new Date());
  const maxFeature = Math.max(1, ...report.features.map((row) => row.costMicros));

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Back-office · Intelligence artificielle
          </p>
          <h1 className="mt-1 text-3xl md:text-4xl">Coûts IA</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Ce que coûtent les appels au modèle, par usage et par projet : montants
            facturés par OpenRouter, en dollars, mois en UTC. Aucun contenu de
            conversation n’est conservé avec la mesure.
          </p>
        </div>
        <nav aria-label="Mois" className="flex shrink-0 items-center gap-1.5">
          <MonthLink
            href={hasPrevious ? `/admin/ai-costs?mois=${previous}` : null}
            label={`Mois précédent, ${monthLabel(previous)}`}
          >
            <ChevronLeft />
          </MonthLink>
          <p aria-current="date" className="min-w-32 text-center text-sm font-medium first-letter:uppercase">
            {monthLabel(month)}
          </p>
          <MonthLink
            href={hasNext ? `/admin/ai-costs?mois=${next}` : null}
            label={`Mois suivant, ${monthLabel(next)}`}
          >
            <ChevronRight />
          </MonthLink>
        </nav>
      </header>

      <section aria-label="Chiffres clés" className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Coût du mois"
          value={usd(totals.costMicros)}
          hint={
            report.projectedCostMicros !== null
              ? `≈ ${usd(report.projectedCostMicros)} au rythme actuel`
              : undefined
          }
        >
          <DeltaBadge
            value={delta(totals.costMicros, report.previousCostMicros)}
            label="vs mois précédent"
            inverse
          />
        </Tile>
        <Tile
          label="Appels au modèle"
          value={integer.format(totals.calls)}
          hint={
            totals.unpriced
              ? `${plural(totals.unpriced, "appel", "appels")} sans coût communiqué`
              : plural(report.projectCount, "projet", "projets")
          }
        />
        <Tile
          label="Tokens lus"
          value={compact.format(totals.promptTokens)}
          hint={`${compact.format(totals.completionTokens)} écrits · ${compact.format(totals.cachedTokens)} en cache`}
        />
        <Tile
          label="Coût moyen d’une réponse"
          value={usd(report.costPerReplyMicros === null ? null : Math.round(report.costPerReplyMicros))}
          hint="Consignes, historique et base de connaissances compris"
        />
      </section>

      {report.overThreshold > 0 && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm"
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-destructive" />
          <p className="min-w-0">
            <span className="font-medium">
              {report.overThreshold > 1
                ? `${integer.format(report.overThreshold)} projets dépassent`
                : "1 projet dépasse"}{" "}
              {usd(report.thresholdUsd * 1_000_000)} de coût IA sur ce mois.
            </span>{" "}
            <span className="text-muted-foreground">
              Vérifiez leur volume de messages et la taille de leur base de connaissances.
              Seuil réglable avec la variable <code className="font-mono text-xs">AI_COST_ALERT_USD</code>.
            </span>
          </p>
        </div>
      )}

      {totals.calls === 0 ? (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <p className="font-medium">Aucun appel IA enregistré en {monthLabel(month)}.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Chaque réponse, résumé, analyse d’image ou de note vocale sera compté ici dès
            son envoi au modèle.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-3">
          <Panel title="Par usage" description="Coût et nombre d’appels de chaque fonction">
            <ul className="space-y-4">
              {report.features.map((row) => (
                <li key={row.feature} className="space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0">{row.label}</span>
                    <span className="shrink-0 font-medium tabular-nums">{usd(row.costMicros)}</span>
                  </div>
                  <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground/60"
                      style={{ width: `${Math.max(2, (row.costMicros / maxFeature) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {plural(row.calls, "appel", "appels")} ·{" "}
                    {compact.format(row.promptTokens)} tokens lus
                  </p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel
            title="Par projet"
            description={
              report.projectCount > report.projects.length
                ? `Les ${report.projects.length} projets les plus coûteux sur ${integer.format(report.projectCount)}`
                : "Du plus coûteux au moins coûteux"
            }
            className="lg:col-span-2"
          >
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="pb-2 text-left font-normal">Projet</th>
                  <th scope="col" className="hidden pb-2 pl-4 text-right font-normal md:table-cell">Appels</th>
                  <th scope="col" className="hidden pb-2 pl-4 text-right font-normal md:table-cell">Tokens lus</th>
                  <th scope="col" className="hidden pb-2 pl-4 text-right font-normal sm:table-cell">Par réponse</th>
                  <th scope="col" className="pb-2 pl-4 text-right font-normal">Coût</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {report.projects.map((row) => (
                  <tr key={row.projectId ?? "deleted"} className="align-top">
                    <th scope="row" className="py-3 text-left font-normal">
                      <span className="block font-medium wrap-anywhere">{row.name}</span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        {row.plan && <span>{PLAN_LABEL[row.plan] ?? row.plan}</span>}
                        <span className="tabular-nums md:hidden">
                          {plural(row.calls, "appel", "appels")} ·{" "}
                          {compact.format(row.promptTokens)} tokens
                        </span>
                        {row.overThreshold && (
                          <span className="inline-flex items-center gap-1 font-medium text-destructive">
                            <span aria-hidden="true" className="size-1.5 rounded-full bg-destructive" />
                            Seuil dépassé
                          </span>
                        )}
                      </span>
                    </th>
                    <td className="hidden py-3 pl-4 text-right tabular-nums md:table-cell">
                      {integer.format(row.calls)}
                    </td>
                    <td className="hidden py-3 pl-4 text-right tabular-nums md:table-cell">
                      {compact.format(row.promptTokens)}
                    </td>
                    <td className="hidden py-3 pl-4 text-right tabular-nums sm:table-cell">
                      {row.replies ? usd(Math.round(row.replyCostMicros / row.replies)) : "—"}
                    </td>
                    <td className="py-3 pl-4 text-right font-medium tabular-nums">
                      {usd(row.costMicros)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      )}
    </div>
  );
}

function MonthLink({
  href,
  label,
  children,
}: {
  href: string | null;
  label: string;
  children: ReactNode;
}) {
  if (!href) {
    return (
      <Button variant="outline" size="icon-sm" disabled aria-label={label}>
        {children}
      </Button>
    );
  }
  return (
    <Button asChild variant="outline" size="icon-sm">
      <Link href={href} aria-label={label} scroll={false}>
        {children}
      </Link>
    </Button>
  );
}

function Tile({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col rounded-2xl border bg-card">
      <div className="px-4 pt-4 pb-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-2 truncate font-mono text-2xl font-medium tabular-nums sm:text-3xl" title={value}>
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children && <div className="mt-auto border-t bg-muted/30 px-4 py-2.5">{children}</div>}
    </div>
  );
}
