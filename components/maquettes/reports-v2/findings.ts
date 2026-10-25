// Verdict et constats : règles déterministes classées par impact × confiance.
// Aucun texte n'est rédigé par un modèle de langage ; chaque phrase cite sa preuve.
import type { WeekAggregate } from "./data";
import type { IndicatorKey, IndicatorReading } from "./indicators";
import type { Band, IndicatorKind, SignalStatus } from "./signal";
import { wilson } from "./signal";

const percent = new Intl.NumberFormat("fr-FR", {
  style: "percent",
  maximumFractionDigits: 0,
});
const decimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const integer = new Intl.NumberFormat("fr-FR");

export function formatDuration(seconds: number) {
  if (seconds < 90) return `${Math.round(seconds)} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${String(rest).padStart(2, "0")}` : `${hours} h`;
}

export function formatValue(kind: IndicatorKind, value: number) {
  switch (kind) {
    case "rate":
      return percent.format(value);
    case "count":
      return integer.format(value);
    case "duration":
      return formatDuration(value);
    case "score":
      return `${decimal.format(value)}/5`;
  }
}

export function formatBand(kind: IndicatorKind, band: Band) {
  const round = (value: number) =>
    kind === "count" ? Math.round(value) : value;
  return `${formatValue(kind, round(band.low))} à ${formatValue(kind, round(band.high))}`;
}

export function formatCount(value: number, singular: string, plural: string) {
  return `${integer.format(value)} ${value > 1 ? plural : singular}`;
}

export type Confidence = "high" | "medium" | "low";
const confidenceWeight: Record<Confidence, number> = {
  high: 1,
  medium: 0.6,
  low: 0.3,
};
export const confidenceLabel: Record<Confidence, string> = {
  high: "Signal net",
  medium: "À traiter",
  low: "À confirmer",
};

export type Finding = {
  id: string;
  title: string;
  evidence: string[];
  /** Conversations concernées, base du classement. */
  impact: number;
  confidence: Confidence;
  action: { label: string; href: string };
};

export type Verdict = {
  tone: "watch" | "good" | "usual" | "new" | "empty";
  label: string;
  sentence: string;
};

type Readings = Record<IndicatorKey, IndicatorReading>;

export function byKey(readings: IndicatorReading[]): Readings {
  return Object.fromEntries(
    readings.map((r) => [r.definition.key, r]),
  ) as Readings;
}

function usualText(reading: IndicatorReading) {
  const { band } = reading.signal;
  const { kind } = reading.definition;
  return band
    ? `Habitude : ${formatValue(kind, kind === "count" ? Math.round(band.median) : band.median)} sur ${band.weeks} semaines, plage normale ${formatBand(kind, band)}`
    : "Historique insuffisant pour situer cette valeur";
}

/** « 3 → 5 » : écart absolu, sans pourcentage, pour les petits effectifs. */
function absoluteChange(reading: IndicatorReading) {
  if (
    !reading.previous ||
    reading.previous.value === null ||
    reading.current.value === null
  )
    return null;
  const { kind } = reading.definition;
  return `${formatValue(kind, reading.previous.value)} → ${formatValue(kind, reading.current.value)} par rapport à la semaine précédente`;
}

const is = (reading: IndicatorReading, status: SignalStatus) =>
  reading.signal.status === status;

export function buildFindings(
  readings: IndicatorReading[],
  week: WeekAggregate,
  range: string,
  base: string,
): Finding[] {
  const r = byKey(readings);
  const findings: Finding[] = [];

  // Questions sans réponse : la cause la plus fréquente d'une baisse d'autonomie.
  if (is(r.gaps, "unusual-bad") || week.gapsOpenAtClose >= 5) {
    const top = week.gapTopics[0];
    findings.push({
      id: "gaps",
      title: is(r.gaps, "unusual-bad")
        ? `${formatCount(week.gapsNew, "question est restée", "questions sont restées")} sans réponse de l’IA, bien plus que d’habitude`
        : `${formatCount(week.gapsOpenAtClose, "question attend", "questions attendent")} encore une réponse de votre part`,
      evidence: [
        `${formatCount(week.gapsNew, "nouvelle question", "nouvelles questions")} du ${range} · ${usualText(r.gaps)}`,
        `${formatCount(week.gapsOpenAtClose, "question ouverte", "questions ouvertes")} à la clôture${top ? ` · sujet le plus fréquent : ${top.label.toLowerCase()} (${top.count})` : ""}`,
      ],
      impact: Math.max(week.gapsNew, week.gapsOpenAtClose / 2),
      confidence: is(r.gaps, "unusual-bad") ? "high" : "medium",
      action: {
        label: "Répondre aux questions",
        href: `${base}/knowledge?tab=improve`,
      },
    });
  }

  if (week.waiting.total > 0) {
    findings.push({
      id: "waiting",
      title: `${formatCount(week.waiting.total, "client attendait", "clients attendaient")} une réponse à la clôture${week.waiting.over24h ? `, dont ${week.waiting.over24h} depuis plus de 24 h` : ""}`,
      evidence: [
        "Dernier message client sans réponse depuis plus d’une heure, dimanche à minuit (UTC)",
        `${formatCount(week.waiting.manual, "conversation", "conversations")} en mode manuel, ${week.waiting.total - week.waiting.manual} avec l’IA active`,
      ],
      impact: week.waiting.total + week.waiting.over24h,
      confidence: week.waiting.over24h ? "high" : "medium",
      action: {
        label: "Voir les conversations",
        href: `${base}/chat?filter=manual`,
      },
    });
  }

  const failures = r.failures.current.value ?? 0;
  // Un ou deux échecs isolés relèvent du bruit : seuls 3 échecs ou plus, ou un
  // niveau hors plage, deviennent un constat.
  if (is(r.failures, "unusual-bad") || failures >= 3) {
    const change = absoluteChange(r.failures);
    findings.push({
      id: "failures",
      title: is(r.failures, "unusual-bad")
        ? `${formatCount(failures, "envoi ou réponse a échoué", "envois ou réponses ont échoué")}, un niveau inhabituel`
        : `${formatCount(failures, "échec technique", "échecs techniques")} cette semaine`,
      evidence: [
        `${formatCount(week.sends.failed, "message en échec", "messages en échec")} sur ${integer.format(week.sends.attempted)} envois · ${formatCount(week.aiJobsFailed, "réponse IA non générée", "réponses IA non générées")}`,
        is(r.failures, "low-sample") && change ? change : usualText(r.failures),
      ],
      impact: failures,
      confidence: is(r.failures, "unusual-bad") ? "high" : "medium",
      action: {
        label: "Vérifier la connexion WhatsApp",
        href: `${base}/settings`,
      },
    });
  }

  if (is(r.handover, "unusual-bad")) {
    const { handoverReasons: reasons, outcome, conversations } = week;
    const ci = wilson(outcome.handover, conversations);
    findings.push({
      id: "handover",
      title: `L’équipe a repris ${percent.format(outcome.handover / conversations)} des conversations, plus que d’habitude`,
      evidence: [
        `${outcome.handover} sur ${conversations} (IC 95 % ${percent.format(ci.low)}–${percent.format(ci.high)}) · ${usualText(r.handover)}`,
        `Réponse depuis l’application : ${reasons.app} · depuis le téléphone : ${reasons.phone} · pause manuelle : ${reasons.manual} · IA déjà en pause : ${reasons.alreadyPaused}`,
      ],
      impact: outcome.handover,
      confidence: "high",
      action: {
        label: "Relire les reprises",
        href: `${base}/chat?filter=manual`,
      },
    });
  }

  if (is(r.csat, "unusual-bad") || week.csat.low >= 3) {
    findings.push({
      id: "csat",
      title: is(r.csat, "unusual-bad")
        ? "La satisfaction client a baissé"
        : `${formatCount(week.csat.low, "client a donné", "clients ont donné")} une note de 1 ou 2`,
      evidence: [
        `${week.csat.mean === null ? "Aucune note" : `Note moyenne ${formatValue("score", week.csat.mean)}`} sur ${formatCount(week.csat.responses, "réponse", "réponses")} · ${usualText(r.csat)}`,
      ],
      impact: week.csat.low,
      confidence: is(r.csat, "unusual-bad") ? "high" : "medium",
      action: { label: "Lire les avis", href: `${base}/analytics` },
    });
  }

  if (
    week.feedback.down >= 3 &&
    week.feedback.down / Math.max(week.feedback.votes, 1) >= 0.5
  ) {
    findings.push({
      id: "feedback",
      title: `${week.feedback.down} réponses de l’IA ont été jugées mauvaises par votre équipe`,
      evidence: [
        `${week.feedback.down} votes négatifs sur ${week.feedback.votes} émis pendant la semaine`,
      ],
      impact: week.feedback.down,
      confidence: "medium",
      action: {
        label: "Corriger ces réponses",
        href: `${base}/knowledge?tab=improve`,
      },
    });
  }

  if (is(r.aiReply, "unusual-bad")) {
    findings.push({
      id: "aiReply",
      title: "L’IA a mis plus de temps que d’habitude à répondre",
      evidence: [
        `Médiane ${formatDuration(week.aiReply.median)}, 9 clients sur 10 servis en moins de ${formatDuration(week.aiReply.p90)} · ${usualText(r.aiReply)}`,
      ],
      impact: Math.round(week.aiReply.n / 2),
      confidence: "high",
      action: { label: "Voir le détail des délais", href: `${base}/analytics` },
    });
  }

  // Baisse d'autonomie qu'aucun levier ci-dessus n'explique : relire un échantillon.
  const explained = findings.some(
    (finding) =>
      finding.confidence === "high" &&
      ["gaps", "handover", "failures"].includes(finding.id),
  );
  if (is(r.autonomy, "unusual-bad") && !explained) {
    findings.push({
      id: "autonomy",
      title:
        "L’IA a mené seule moins de conversations que d’habitude, sans cause isolée",
      evidence: [usualText(r.autonomy)],
      impact: week.conversations - week.outcome.autonomous,
      confidence: "medium",
      action: { label: "Relire des conversations", href: `${base}/chat` },
    });
  }

  if (week.annotations.agentUpdates > 0)
    for (const finding of findings)
      if (["gaps", "handover", "autonomy"].includes(finding.id))
        finding.evidence.push(
          "Les consignes de l’agent ont été modifiées cette semaine : l’écart peut aussi en venir.",
        );

  return findings
    .sort(
      (a, b) =>
        b.impact * confidenceWeight[b.confidence] -
        a.impact * confidenceWeight[a.confidence],
    )
    .slice(0, 3);
}

const badPhrase: Partial<
  Record<IndicatorKey, (value: string, usual: string) => string>
> = {
  autonomy: (v, u) =>
    `l’IA n’a mené seule que ${v} des conversations, contre ${u} d’habitude`,
  failures: (v, u) =>
    `${v} envois ou réponses ont échoué, contre ${u} d’habitude`,
  gaps: (v, u) =>
    `${v} questions sont restées sans réponse, contre ${u} d’habitude`,
  handover: (v, u) =>
    `l’équipe a dû reprendre ${v} des conversations, contre ${u} d’habitude`,
  csat: (v, u) => `la satisfaction est tombée à ${v}, contre ${u} d’habitude`,
  aiReply: (v, u) =>
    `la première réponse de l’IA a pris ${v}, contre ${u} d’habitude`,
};
const goodPhrase: Partial<
  Record<IndicatorKey, (value: string, usual: string) => string>
> = {
  autonomy: (v, u) =>
    `l’IA a mené seule ${v} des conversations, au-dessus de son habitude (${u})`,
  handover: (v, u) =>
    `l’équipe n’a repris que ${v} des conversations, contre ${u} d’habitude`,
  gaps: (v, u) =>
    `seulement ${v} questions sans réponse, contre ${u} d’habitude`,
  csat: (v, u) => `la satisfaction monte à ${v}, contre ${u} d’habitude`,
  aiReply: (v, u) => `l’IA a répondu en ${v}, contre ${u} d’habitude`,
};
const priority: IndicatorKey[] = [
  "autonomy",
  "failures",
  "gaps",
  "handover",
  "csat",
  "aiReply",
];

function phrase(reading: IndicatorReading, table: typeof badPhrase) {
  const make = table[reading.definition.key];
  const { band } = reading.signal;
  if (!make || !band || reading.current.value === null) return null;
  const { kind } = reading.definition;
  const round = (v: number) => (kind === "count" ? Math.round(v) : v);
  return make(
    formatValue(kind, reading.current.value),
    formatValue(kind, round(band.median)),
  );
}

export function buildVerdict(
  readings: IndicatorReading[],
  week: WeekAggregate,
): Verdict {
  const r = byKey(readings);
  const { conversations, outcome } = week;
  if (!conversations)
    return {
      tone: "empty",
      label: "Semaine sans activité",
      sentence:
        "Aucune conversation cette semaine : vérifiez que WhatsApp est connecté et que vos clients connaissent ce numéro.",
    };
  const autonomy = `${outcome.autonomous} des ${conversations} conversations`;
  if (is(r.autonomy, "insufficient-history"))
    return {
      tone: "new",
      label: "Historique insuffisant",
      sentence: `Premières semaines : l’IA a mené seule ${autonomy}. Les comparaisons commenceront après 4 semaines complètes.`,
    };
  const ordered = priority.map((key) => r[key]);
  const bad = ordered.filter((reading) => is(reading, "unusual-bad"));
  const good = ordered.filter((reading) => is(reading, "unusual-good"));
  if (bad.length) {
    const [first, second] = bad
      .map((reading) => phrase(reading, badPhrase))
      .filter(Boolean);
    // Le résultat principal reste toujours cité, même quand il est dans sa plage.
    const median = r.autonomy.signal.band?.median;
    const context =
      bad[0].definition.key !== "autonomy" && median !== undefined
        ? ` ; l’IA a mené seule ${percent.format(outcome.autonomous / conversations)} des ${conversations} conversations (${percent.format(median)} d’habitude)`
        : "";
    return {
      tone: "watch",
      label: "À surveiller",
      sentence: `Semaine à surveiller : ${first}${second ? `, et ${second}` : ""}${context}.`,
    };
  }
  if (good.length)
    return {
      tone: "good",
      label: "Bonne semaine",
      sentence: `Bonne semaine : ${phrase(good[0], goodPhrase)}.`,
    };
  if (is(r.autonomy, "low-sample"))
    return {
      tone: "usual",
      label: "Semaine calme",
      sentence: `Semaine calme : ${conversations} conversations, trop peu pour comparer aux semaines habituelles ; l’IA en a mené seule ${outcome.autonomous}.`,
    };
  const band = r.autonomy.signal.band;
  return {
    tone: "usual",
    label: "Dans vos habitudes",
    sentence: `Semaine dans vos habitudes : l’IA a mené seule ${percent.format(outcome.autonomous / conversations)} des ${conversations} conversations${band ? ` (${percent.format(band.median)} d’habitude)` : ""}.`,
  };
}
