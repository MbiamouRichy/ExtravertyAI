// Données fictives et déterministes (aucun aléa au rendu : pas d’écart serveur/client).

export type Period = "7d" | "30d" | "90d";

export const periods: { id: Period; label: string; days: number }[] = [
  { id: "7d", label: "7 jours", days: 7 },
  { id: "30d", label: "30 jours", days: 30 },
  { id: "90d", label: "3 mois", days: 90 },
];

function wave(i: number, seed: number) {
  // Smooth pseudo-variation with a weekly rhythm.
  return Math.sin(i * 0.9 + seed) * 0.18 + Math.sin(i * 0.23 + seed * 2) * 0.12 + (i % 7 >= 5 ? -0.22 : 0.06);
}

export type VolumePoint = { label: string; received: number; sent: number };

const dayFormatter = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" });

export function volumeSeries(days: number): VolumePoint[] {
  const end = Date.UTC(2026, 9, 14);
  return Array.from({ length: days }, (_, index) => {
    const i = index + 1;
    const base = 140 + i * (days > 30 ? 0.6 : 1.4);
    const received = Math.round(base * (1 + wave(i, 1)));
    return {
      label: dayFormatter.format(new Date(end - (days - 1 - index) * 86_400_000)),
      received,
      sent: Math.round(received * (0.86 + wave(i, 3) * 0.1)),
    };
  });
}

export type Kpi = {
  id: string;
  label: string;
  value: string;
  delta: number;
  /** For "lower is better" metrics, a decrease is the good direction. */
  lowerIsBetter?: boolean;
  hint: string;
  spark: number[];
};

export function kpis(days: number): Kpi[] {
  const series = volumeSeries(days);
  const received = series.reduce((sum, p) => sum + p.received, 0);
  const scale = days / 30;
  const spark = (seed: number) => Array.from({ length: 14 }, (_, i) => 50 + wave(i, seed) * 60);
  return [
    {
      id: "received",
      label: "Messages reçus",
      value: received.toLocaleString("fr-FR"),
      delta: 12.4,
      hint: "Messages entrants de vos clients sur la période.",
      spark: spark(1),
    },
    {
      id: "autonomy",
      label: "Autonomie de l’IA",
      value: "74 %",
      delta: 3.1,
      hint: "Part des réponses envoyées par l’assistant, sans intervention humaine.",
      spark: spark(2),
    },
    {
      id: "first-reply",
      label: "1re réponse (médiane)",
      value: "8 s",
      delta: -18.2,
      lowerIsBetter: true,
      hint: "Délai médian entre le premier message d’un client et la première réponse.",
      spark: spark(4),
    },
    {
      id: "interesting",
      label: "Prospects intéressants",
      value: Math.round(46 * scale).toLocaleString("fr-FR"),
      delta: 9.6,
      hint: "Contacts classés « Prospect intéressant » par Instinct IA.",
      spark: spark(5),
    },
  ];
}

export const responders = [
  { id: "ai", label: "Assistant IA", share: 74 },
  { id: "team", label: "Équipe", share: 26 },
];

export const instinctFunnel = [
  { id: "active", label: "Contacts actifs", value: 412 },
  { id: "follow", label: "À suivre", value: 128 },
  { id: "interesting", label: "Prospects intéressants", value: 46 },
];

export const statuses = [
  { id: "READ", label: "Lus", value: 3120 },
  { id: "DELIVERED", label: "Distribués", value: 1084 },
  { id: "SENT", label: "Envoyés", value: 214 },
  { id: "PENDING", label: "En attente", value: 22 },
  { id: "FAILED", label: "Échecs", value: 9 },
];

export const sources = [
  { id: "direct", label: "Message direct", value: 58 },
  { id: "instagram", label: "Lien Instagram", value: 21 },
  { id: "facebook", label: "Lien Facebook", value: 13 },
  { id: "other", label: "Autres", value: 8 },
];

export const weekdays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
export const hours = Array.from({ length: 12 }, (_, i) => 8 + i); // 8 h → 19 h

/** Messages received per weekday × hour (0–1 normalised intensity + count). */
export const heatmap = weekdays.map((day, d) =>
  hours.map((hour) => {
    const lunch = Math.exp(-((hour - 12.5) ** 2) / 3);
    const evening = Math.exp(-((hour - 18.5) ** 2) / 2.5);
    const weekend = d >= 5 ? 0.55 : 1;
    const intensity = Math.min(1, (0.15 + lunch * 0.7 + evening * 0.8) * weekend * (0.85 + ((d * 7 + hour) % 5) * 0.05));
    return { day, hour, intensity, count: Math.round(intensity * 96) };
  }),
);

export const topContacts = [
  { id: "1", name: "Aïcha Ndiaye", messages: 64, instinct: "interesting", ai: false, last: "il y a 12 min" },
  { id: "2", name: "Sarah Kamga", messages: 51, instinct: "interesting", ai: true, last: "il y a 1 h" },
  { id: "3", name: "Boutique Elo", messages: 38, instinct: "follow_up", ai: false, last: "hier" },
  { id: "4", name: "Marc Tchoua", messages: 27, instinct: "follow_up", ai: true, last: "hier" },
  { id: "5", name: "Jean-Paul Mbarga", messages: 19, instinct: null, ai: true, last: "lun." },
] as const;
