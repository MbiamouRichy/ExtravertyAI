// Signal ou bruit : chaque semaine est comparée à la médiane des 8 semaines
// précédentes, avec une bande robuste (médiane ± k·MAD) élargie au bruit
// d'échantillonnage quand l'effectif est faible. Fonctions pures, sans dépendance
// au rendu : elles pourront rejoindre lib/ une fois le dictionnaire validé.

export const BASELINE_WEEKS = 8;
export const MIN_BASELINE_WEEKS = 4;
/** Largeur de bande, en écarts-types robustes. */
export const BAND_K = 3;
const MAD_TO_SIGMA = 1.4826;

export type IndicatorKind = "rate" | "count" | "duration" | "score";
/** Sens souhaitable : « up » si une hausse est une bonne nouvelle. */
export type Direction = "up" | "down";

export type WeekPoint = {
  /** null : indicateur non mesuré cette semaine-là (ancien rapport). */
  value: number | null;
  /** Effectif sur lequel repose la valeur (conversations, réponses, événements). */
  n: number;
};

export type Band = { median: number; low: number; high: number; weeks: number };

export type SignalStatus =
  | "unusual-bad"
  | "unusual-good"
  | "usual"
  | "low-sample"
  | "insufficient-history"
  | "not-measured";

export type Signal = { status: SignalStatus; band: Band | null };

export function median(values: number[]) {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Quantile à interpolation linéaire, identique à percentile_cont de PostgreSQL. */
export function quantile(values: number[], q: number) {
  if (!values.length) return Number.NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

/** Intervalle de Wilson à 95 % pour une proportion successes / n. */
export function wilson(successes: number, n: number, z = 1.96) {
  if (n <= 0) return { low: 0, high: 1 };
  const p = successes / n;
  const z2 = z * z;
  const centre = (p + z2 / (2 * n)) / (1 + z2 / n);
  const margin =
    (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / (1 + z2 / n);
  return {
    low: Math.max(0, centre - margin),
    high: Math.min(1, centre + margin),
  };
}

/** Écart-type plancher dû au seul hasard de l'échantillon de la semaine. */
function samplingSigma(kind: IndicatorKind, centre: number, n: number) {
  const size = Math.max(n, 1);
  switch (kind) {
    case "rate":
      return Math.sqrt((centre * (1 - centre)) / size);
    case "count":
      return Math.sqrt(Math.max(centre, 1));
    case "duration":
      // Médiane de délais : dispersion relative d'environ 1,25/√n.
      return (1.25 * centre) / Math.sqrt(size);
    case "score":
      // Notes de 1 à 5 : écart-type individuel prudent de 1.
      return 1 / Math.sqrt(size);
  }
}

export function baselineBand(
  history: WeekPoint[],
  kind: IndicatorKind,
  minSample: number,
  currentN: number,
  k = BAND_K,
): Band | null {
  // Un compteur calme (0 à 2 échecs) fait partie de l'habitude : seuls les taux,
  // délais et notes écartent les semaines à trop faible effectif.
  const usable = history
    .slice(-BASELINE_WEEKS)
    .filter(
      (week): week is { value: number; n: number } =>
        week.value !== null && (kind === "count" || week.n >= minSample),
    );
  if (usable.length < MIN_BASELINE_WEEKS) return null;
  const values = usable.map((week) => week.value);
  const centre = median(values);
  const robust =
    MAD_TO_SIGMA * median(values.map((value) => Math.abs(value - centre)));
  const half = k * Math.max(robust, samplingSigma(kind, centre, currentN));
  const ceiling =
    kind === "rate" ? 1 : kind === "score" ? 5 : Number.POSITIVE_INFINITY;
  const floor = kind === "score" ? 1 : 0;
  return {
    median: centre,
    low: Math.max(floor, centre - half),
    high: Math.min(ceiling, centre + half),
    weeks: usable.length,
  };
}

export function classify(
  history: WeekPoint[],
  current: WeekPoint,
  kind: IndicatorKind,
  direction: Direction,
  minSample: number,
  k = BAND_K,
): Signal {
  if (current.value === null) return { status: "not-measured", band: null };
  const band = baselineBand(history, kind, minSample, current.n, k);
  if (!band) return { status: "insufficient-history", band: null };
  // Pour un compteur, l'effectif est le compteur lui-même (ou son habitude).
  const n = kind === "count" ? Math.max(current.value, band.median) : current.n;
  if (n < minSample) return { status: "low-sample", band };
  if (current.value >= band.low && current.value <= band.high)
    return { status: "usual", band };
  const higher = current.value > band.high;
  return {
    status: higher === (direction === "up") ? "unusual-good" : "unusual-bad",
    band,
  };
}
