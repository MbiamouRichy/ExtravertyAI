import { EMAIL_HEADING_FONT } from "../components/emailTemplate/emailFonts";
import {
  emailUi as ui,
  escapeHtml,
  renderEmail,
} from "../components/emailTemplate/emailLayout";
import { z } from "zod";
import {
  formatBand,
  formatValue,
  type Finding,
  type Verdict,
} from "./report-findings";
import { readIndicators, type IndicatorReading } from "./report-indicators";
import { WeekAggregateSchema } from "./report-week";

export const ReportSettingsSchema = z.object({
  reportsEnabled: z.boolean(),
  reportsSkipEmpty: z.boolean(),
  reportsIncludeTips: z.boolean(),
  reportsHourUtc: z.number().int().min(0).max(23),
});
export type ReportSettings = z.infer<typeof ReportSettingsSchema>;
export const WEEK_MS = 7 * 86400000;

// Stored report windows remain half-open UTC intervals shared by the project.
export function reportWindow(now: Date, hourUtc: number) {
  const end = new Date(now);
  end.setUTCHours(0, 0, 0, 0);
  end.setUTCDate(end.getUTCDate() - ((end.getUTCDay() + 6) % 7));
  const due = new Date(end.getTime() + hourUtc * 3600000);
  return {
    start: new Date(end.getTime() - WEEK_MS),
    end,
    due,
    next: now < due ? due : new Date(due.getTime() + WEEK_MS),
  };
}

export const ReportMetricsSchema = z.object({
  received: z.number(),
  sent: z.number(),
  aiSent: z.number(),
  failed: z.number(),
  activeContacts: z.number(),
  newContacts: z.number(),
  changes: z.number(),
  csatResponses: z.number(),
});
export type ReportMetrics = z.infer<typeof ReportMetricsSchema>;

// Version 1 : 8 compteurs comparés à la semaine précédente. `csatResponses` est
// absent des plus anciens : il reste absent (« non mesuré »), jamais 0.
const LegacyMetricsSchema = ReportMetricsSchema.extend({
  csatResponses: z.number().optional(),
});
const ReportSnapshotV1Schema = z.object({
  version: z.literal(1),
  current: LegacyMetricsSchema,
  previous: LegacyMetricsSchema,
  partial: z.boolean(),
  tips: z.array(z.string()),
});

const FindingSchema = z.object({
  id: z.string().max(40),
  title: z.string().max(300),
  evidence: z.array(z.string().max(400)).max(4),
  impact: z.number().min(0),
  confidence: z.enum(["high", "medium", "low"]),
  // Chemin relatif au projet, jamais une URL : le lien est reconstruit à l'affichage.
  action: z.object({
    label: z.string().max(60),
    href: z.string().regex(/^\/[a-z/?=&_-]*$/),
  }),
});
const ReportSnapshotV2Schema = z.object({
  version: z.literal(2),
  /** Jusqu'à 20 semaines, la semaine du rapport en dernier, recalculées au moment du rapport. */
  weeks: z.array(WeekAggregateSchema).min(1).max(20),
  partial: z.boolean(),
  verdict: z.object({
    tone: z.enum(["watch", "good", "usual", "new", "empty"]),
    label: z.string().max(60),
    sentence: z.string().max(400),
  }),
  findings: z.array(FindingSchema).max(3),
});

export const ReportSnapshotSchema = z.preprocess(
  (value) =>
    value && typeof value === "object" && !("version" in value)
      ? { ...value, version: 1 }
      : value,
  z.discriminatedUnion("version", [
    ReportSnapshotV1Schema,
    ReportSnapshotV2Schema,
  ]),
);
export type ReportSnapshot = z.infer<typeof ReportSnapshotSchema>;
export type ReportSnapshotV2 = z.infer<typeof ReportSnapshotV2Schema>;

export const reportMetricLabels: Record<keyof ReportMetrics, string> = {
  received: "Messages reçus",
  sent: "Messages envoyés",
  aiSent: "Réponses IA envoyées",
  failed: "Échecs d’envoi",
  activeContacts: "Contacts actifs",
  newContacts: "Nouveaux contacts",
  changes: "Réglages de l’agent modifiés",
  csatResponses: "Notes de satisfaction reçues",
};
export function reportDelta(current: number, previous: number) {
  if (previous === 0)
    return current === 0 ? "Stable" : "Sans référence comparable";
  const delta = ((current - previous) / previous) * 100;
  return `${delta > 0 ? "+" : ""}${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(delta)} %`;
}
export function reportRange(start: Date, end: Date, timeZone = "UTC") {
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  });
  return `${fmt.format(start)} – ${fmt.format(new Date(end.getTime() - 1))}`;
}

/** Lecture courte d'un indicateur, partagée par l'e-mail (texte et HTML). */
export function indicatorLine(reading: IndicatorReading) {
  const { definition, current, signal } = reading;
  const value =
    current.value === null ? "—" : formatValue(definition.kind, current.value);
  const status =
    signal.status === "unusual-bad"
      ? "inhabituel"
      : signal.status === "unusual-good"
        ? "mieux que d’habitude"
        : signal.status === "low-sample"
          ? "effectif faible"
          : signal.status === "insufficient-history"
            ? "historique court"
            : null;
  const habit =
    signal.band &&
    !["low-sample", "insufficient-history"].includes(signal.status)
      ? `habitude ${formatValue(definition.kind, definition.kind === "count" ? Math.round(signal.band.median) : signal.band.median)}, plage ${formatBand(definition.kind, signal.band)}`
      : null;
  return {
    label: definition.label,
    value,
    note: [status, habit].filter(Boolean).join(" · "),
    bad: signal.status === "unusual-bad",
  };
}

export function reportEmail(
  name: string,
  snapshot: ReportSnapshotV2,
  start: Date,
  end: Date,
  url: string,
  includeFindings = true,
) {
  const parsed = new URL(url);
  if (
    !["https:", "http:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  )
    throw new Error("INVALID_REPORT_URL");
  // Les actions pointent vers les pages du projet, à côté de la page Rapports.
  const projectBase = `${parsed.origin}${parsed.pathname.replace(/\/reports\/?$/, "")}`;
  const verdict: Verdict = snapshot.verdict;
  const findings: Finding[] = includeFindings ? snapshot.findings : [];
  const lines = readIndicators(snapshot.weeks, snapshot.weeks.length - 1).map(
    indicatorLine,
  );
  const range = reportRange(start, end);
  const subject = `Votre rapport hebdomadaire · ${name.replace(/[\r\n]/g, " ")} · ${range}`;
  const text = [
    subject,
    `${verdict.label}. ${verdict.sentence}`,
    `${range} · heures UTC · comparée aux 8 semaines précédentes`,
    ...(findings.length
      ? [
          "À faire cette semaine :",
          ...findings.map(
            (finding, index) =>
              `${index + 1}. ${finding.title}\n   ${finding.evidence.join(" · ")}\n   ${finding.action.label} : ${projectBase}${finding.action.href}`,
          ),
        ]
      : []),
    "Indicateurs :",
    ...lines.map(
      (line) =>
        `- ${line.label} : ${line.value}${line.note ? ` (${line.note})` : ""}`,
    ),
    ...(snapshot.partial ? ["Projet récent : la semaine est incomplète."] : []),
    "Données agrégées uniquement : aucun message, numéro ni question client.",
    `Ouvrir le rapport : ${url}`,
  ].join("\n\n");

  // Literal neutral fallbacks match the configured shadcn palette, as in billing
  // emails: email clients cannot resolve the app's CSS variables or OKLCH tokens.
  const safeName = escapeHtml(name);
  const findingRows = findings
    .map(
      (finding, index) =>
        `<tr><td valign="top" style="padding:16px 12px 16px 0;width:26px;border-top:1px solid #e5e5e5" class="divider"><span class="badge" style="display:inline-block;width:24px;height:24px;line-height:24px;border-radius:999px;background:#171717;color:#fafafa;font-size:12px;font-weight:bold;text-align:center">${index + 1}</span></td><td valign="top" class="divider" style="padding:16px 0;border-top:1px solid #e5e5e5">
        <p class="main" style="margin:0 0 4px;font-size:15px;line-height:1.5;font-weight:bold;color:#0a0a0a">${escapeHtml(finding.title)}</p>
        <p class="muted" style="margin:0 0 8px;font-size:13px;line-height:1.6;color:#737373">${escapeHtml(finding.evidence.join(" · "))}</p>
        <a class="link" href="${escapeHtml(`${projectBase}${finding.action.href}`)}" target="_blank" style="font-size:14px;font-weight:bold;color:#171717">${escapeHtml(finding.action.label)} &rarr;</a></td></tr>`,
    )
    .join("");
  const indicatorRows = lines
    .map(
      (line) =>
        `<tr><th scope="row" align="left" class="main divider" style="padding:12px 8px 12px 0;border-top:1px solid #e5e5e5;font-weight:normal;font-size:14px;color:#0a0a0a">${escapeHtml(line.label)}<br><span class="muted" style="font-size:12px;color:#737373">${escapeHtml(line.note)}</span></th><td align="right" valign="top" class="main divider" style="padding:12px 0;border-top:1px solid #e5e5e5;font-family:${EMAIL_HEADING_FONT};font-weight:bold;font-size:18px;color:${line.bad ? "#b91c1c" : "#0a0a0a"};white-space:nowrap">${escapeHtml(line.value)}</td></tr>`,
    )
    .join("");
  const html = renderEmail({
    title: escapeHtml(subject),
    preheader: escapeHtml(verdict.sentence.slice(0, 140)),
    badge: "BUSINESS",
    maxWidth: 600,
    reason:
      "Envoyé aux Owner et Admin du projet. Aucune conversation ni coordonnée client n’est incluse.",
    content: [
      ui.pill(
        verdict.tone === "watch" ? "danger" : "neutral",
        escapeHtml(verdict.label),
      ),
      ui.h1(escapeHtml(verdict.sentence)),
      ui.p(ui.strong(safeName), { margin: "0 0 4px" }),
      ui.p(
        `${escapeHtml(range)} · heures UTC · comparée aux 8 semaines précédentes`,
        {
          muted: true,
          small: true,
          margin: "0 0 8px",
        },
      ),
      findingRows
        ? `${ui.h2("À faire cette semaine")}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:8px;border-collapse:collapse">${findingRows}</table>`
        : "",
      `${ui.h2("Indicateurs")}<table width="100%" cellspacing="0" cellpadding="0" style="margin-top:8px;border-collapse:collapse"><caption class="sr-only" style="display:none">Indicateurs de la semaine</caption><tbody>${indicatorRows}</tbody></table>`,
      snapshot.partial
        ? `<div style="height:20px"></div>${ui.callout("info", "<strong>Projet récent&nbsp;:</strong> la semaine est incomplète.")}`
        : "",
      ui.note(
        "Une valeur n’est « inhabituelle » que hors de la plage normale des 8 semaines précédentes et au-delà d’un effectif minimal. Données agrégées uniquement.",
      ),
      `<div style="height:20px"></div>`,
      ui.button(escapeHtml(parsed.href), "Ouvrir le rapport"),
      ui.p("Vous pouvez aussi y gérer l’envoi des rapports.", {
        muted: true,
        small: true,
        margin: "-16px 0 0",
      }),
    ].join(""),
  });
  return { subject, text, html };
}
