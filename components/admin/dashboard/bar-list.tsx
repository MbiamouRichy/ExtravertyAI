import type { ShareRow } from "@/lib/admin-dashboard";
import { formatValue } from "./format";

/**
 * Classement horizontal : la barre porte la part, le texte la valeur.
 * « Autres » regroupe la traîne, toujours en dernier.
 */
export function BarList({
  rows,
  valueLabel,
  formatLabel = (label) => label,
  mono = false,
}: {
  rows: ShareRow[];
  valueLabel: string;
  formatLabel?: (label: string) => string;
  mono?: boolean;
}) {
  if (!rows.length)
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Pas encore de données sur cette période
      </p>
    );
  const max = Math.max(...rows.map((row) => row.share));
  return (
    <table className="w-full table-fixed text-sm">
      <thead className="sr-only">
        <tr>
          <th scope="col">Libellé</th>
          <th scope="col">Part ({valueLabel.toLowerCase()})</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label} className="group">
            <th scope="row" className="relative py-1 pr-3 text-left font-normal">
              <span
                aria-hidden="true"
                className="absolute inset-y-1 left-0 rounded-md border-r-2 border-foreground/40 bg-gradient-to-r from-muted to-foreground/15"
                style={{ width: `${Math.max(2, (row.share / (max || 1)) * 100)}%` }}
              />
              <span
                className={`relative block truncate px-2.5 py-1.5 ${mono ? "font-mono text-xs" : ""}`}
                title={formatLabel(row.label)}
              >
                {formatLabel(row.label)}
              </span>
            </th>
            {/* La part se lit d’un coup d’œil ; l’effectif reste au survol et pour les lecteurs d’écran. */}
            <td
              className="w-16 py-1 text-right font-medium tabular-nums"
              title={`${formatValue(row.value)} ${valueLabel.toLowerCase()}`}
            >
              {formatValue(row.share, "percent")}
              <span className="sr-only"> ({formatValue(row.value)})</span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
