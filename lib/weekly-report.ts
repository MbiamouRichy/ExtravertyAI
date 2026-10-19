import { EMAIL_HEADING_FONT } from "../components/emailTemplate/emailFonts";
import {
  emailUi as ui,
  escapeHtml,
  renderEmail,
} from "../components/emailTemplate/emailLayout";
import { z } from "zod";

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
  // Absent from snapshots stored before the satisfaction survey existed.
  csatResponses: z.number().default(0),
});
export const ReportSnapshotSchema = z.object({
  current: ReportMetricsSchema,
  previous: ReportMetricsSchema,
  partial: z.boolean(),
  tips: z.array(z.string()),
});
export type ReportMetrics = z.infer<typeof ReportMetricsSchema>;
export type ReportSnapshot = z.infer<typeof ReportSnapshotSchema>;
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
export function reportTips(
  current: ReportMetrics,
  previous: ReportMetrics,
): string[] {
  const tips: string[] = [];
  if (!current.activeContacts)
    tips.push(
      "Aucun échange cette semaine : vérifiez la connexion WhatsApp et la visibilité de votre numéro auprès de vos clients.",
    );
  if (current.failed)
    tips.push(
      `${current.failed} échec(s) d’envoi : contrôlez la connexion WhatsApp et les messages en échec avant toute relance.`,
    );
  if (current.received > previous.received && previous.received > 0)
    tips.push(
      "Le volume entrant progresse : vérifiez que votre équipe peut prendre le relais sur les demandes complexes.",
    );
  if (current.changes)
    tips.push(
      "Des réglages de l’agent ont changé. Relisez un échantillon de réponses avant d’attribuer une évolution à ces changements.",
    );
  if (!tips.length)
    tips.push(
      "Relisez quelques conversations et précisez les consignes de l’agent sur les questions récurrentes. Comparez les résultats sur plusieurs semaines.",
    );
  return tips;
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
export function reportEmail(
  name: string,
  snapshot: ReportSnapshot,
  start: Date,
  end: Date,
  url: string,
) {
  const parsed = new URL(url);
  if (
    !["https:", "http:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  )
    throw new Error("INVALID_REPORT_URL");
  const lines = (
    Object.keys(reportMetricLabels) as (keyof ReportMetrics)[]
  ).map(
    (key) =>
      `${reportMetricLabels[key]} : ${snapshot.current[key]} (${reportDelta(snapshot.current[key], snapshot.previous[key])})`,
  );
  const subject = `Votre rapport hebdomadaire · ${name.replace(/[\r\n]/g, " ")} · ${reportRange(start, end)}`;
  const text = [
    subject,
    "Comparaison avec la semaine précédente · périodes UTC",
    ...lines,
    ...(snapshot.partial
      ? ["Projet récent : les périodes peuvent être incomplètes."]
      : []),
    "Les variations décrivent l’activité ; elles ne prouvent pas un gain de performance. Les échecs reflètent le statut au moment du calcul.",
    ...snapshot.tips,
    `Consulter le rapport et gérer les envois : ${url}`,
  ].join("\n\n");
  // Literal neutral fallbacks match the configured shadcn palette, as in billing
  // emails: email clients cannot resolve the app's CSS variables or OKLCH tokens.
  const fmt = new Intl.NumberFormat("fr-FR");
  const safeName = escapeHtml(name);
  const range = escapeHtml(reportRange(start, end));
  const trend = (key: keyof ReportMetrics) => {
    const current = snapshot.current[key];
    const previous = snapshot.previous[key];
    const arrow =
      current > previous ? "&#9650;" : current < previous ? "&#9660;" : "&#8212;";
    return `<span class="pill" style="display:inline-block;padding:3px 9px;border-radius:999px;background:#f5f5f5;color:#525252;font-size:12px;font-weight:bold;white-space:nowrap">${arrow}&nbsp;${escapeHtml(reportDelta(current, previous))}</span>`;
  };
  const tile = (key: keyof ReportMetrics, side: "left" | "right") =>
    `<td class="tile-cell" width="50%" valign="top" style="padding:${side === "left" ? "0 6px 12px 0" : "0 0 12px 6px"}"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" class="tile" style="background:#fafafa;border:1px solid #e5e5e5;border-radius:12px"><tr><td style="padding:18px">
    <p class="muted" style="margin:0 0 8px;font-size:13px;line-height:1.4;color:#737373">${escapeHtml(reportMetricLabels[key])}</p>
    <p class="main heading" style="margin:0 0 10px;font-family:${EMAIL_HEADING_FONT};font-size:32px;line-height:1.1;font-weight:bold;letter-spacing:-0.5px;color:#0a0a0a">${fmt.format(snapshot.current[key])}</p>
    ${trend(key)}
    </td></tr></table></td>`;
  const secondary = (["failed", "newContacts", "changes"] as const)
    .map(
      (key) =>
        `<tr><th scope="row" align="left" class="main divider" style="padding:14px 8px 14px 0;border-top:1px solid #e5e5e5;font-weight:normal;font-size:14px;color:#0a0a0a">${escapeHtml(reportMetricLabels[key])}</th><td align="right" class="main divider" style="padding:14px 0;border-top:1px solid #e5e5e5;font-weight:bold;font-size:15px;color:${key === "failed" && snapshot.current.failed ? "#b91c1c" : "#0a0a0a"}">${fmt.format(snapshot.current[key])}</td><td align="right" class="divider" style="padding:14px 0 14px 12px;border-top:1px solid #e5e5e5">${trend(key)}</td></tr>`,
    )
    .join("");
  const tips = snapshot.tips
    .map(
      (tip, index) =>
        `<tr><td valign="top" style="padding:0 12px 14px 0;width:26px"><span class="badge" style="display:inline-block;width:24px;height:24px;line-height:24px;border-radius:999px;background:#171717;color:#fafafa;font-size:12px;font-weight:bold;text-align:center">${index + 1}</span></td><td class="main" valign="top" style="padding:2px 0 14px;font-size:14px;line-height:1.6;color:#0a0a0a">${escapeHtml(tip)}</td></tr>`,
    )
    .join("");
  const html = renderEmail({
    title: escapeHtml(subject),
    preheader: `${safeName} · ${range} : ${fmt.format(snapshot.current.received)} messages reçus, ${fmt.format(snapshot.current.aiSent)} réponses IA envoyées.`,
    badge: "BUSINESS",
    maxWidth: 600,
    reason:
      "Envoyé aux Owner et Admin du projet. Aucune conversation ni coordonnée client n’est incluse.",
    content: [
      ui.pill("neutral", "Rapport hebdomadaire"),
      ui.h1("Votre semaine en chiffres"),
      ui.p(ui.strong(safeName), { margin: "0 0 4px" }),
      ui.p(`${range} · UTC · comparé à la semaine précédente`, {
        muted: true,
        small: true,
        margin: "0 0 28px",
      }),
      `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>${tile("received", "left")}${tile("sent", "right")}</tr><tr>${tile("aiSent", "left")}${tile("activeContacts", "right")}</tr></table>`,
      `<table width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;border-collapse:collapse"><caption class="main" style="text-align:left;padding:0 0 4px;font-family:${EMAIL_HEADING_FONT};font-size:16px;font-weight:700;color:#0a0a0a">Autres indicateurs</caption><tbody>${secondary}</tbody></table>`,
      snapshot.partial
        ? `<div style="height:20px"></div>${ui.callout("info", "<strong>Projet récent&nbsp;:</strong> les périodes peuvent être incomplètes.")}`
        : "",
      ui.note(
        "Les variations décrivent l’activité ; elles ne prouvent pas un gain de performance. Les échecs reflètent le statut au moment du calcul.",
      ),
      tips ? `${ui.h2("Pistes d’amélioration")}<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:12px">${tips}</table>` : "",
      `<div style="height:12px"></div>`,
      ui.button(escapeHtml(parsed.href), "Consulter le rapport"),
      ui.p("Vous pouvez aussi y gérer l’envoi des rapports.", {
        muted: true,
        small: true,
        margin: "-16px 0 0",
      }),
    ].join(""),
  });
  return { subject, text, html };
}
