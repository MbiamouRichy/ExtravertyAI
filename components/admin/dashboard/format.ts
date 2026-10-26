export type ValueFormat = "number" | "currency" | "percent";

const integer = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("fr-FR", { style: "percent", maximumFractionDigits: 1 });

export function formatValue(
  value: number | null | undefined,
  format: ValueFormat = "number",
  currency = "USD",
  short = false,
) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (format === "percent") return percent.format(value);
  if (format === "currency")
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency,
      notation: short ? "compact" : "standard",
      maximumFractionDigits: short ? 1 : value % 1 === 0 ? 0 : 2,
    }).format(value);
  return short ? compact.format(value) : integer.format(value);
}

/** « 12 oct. » pour un jour, « oct. 2025 » pour un mois (clé AAAA-MM-JJ, en UTC). */
export function formatBucket(key: string, unit: "day" | "month", long = false) {
  const date = new Date(`${key}T00:00:00Z`);
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: "UTC",
    ...(unit === "day"
      ? { day: "numeric", month: "short", ...(long && { year: "numeric" }) }
      : { month: long ? "long" : "short", year: long ? "numeric" : "2-digit" }),
  }).format(date);
}

export function formatDelta(value: number | null) {
  if (value === null) return "nouveau";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${percent.format(Math.abs(value))}`;
}
