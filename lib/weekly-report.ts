import { z } from "zod";

export const ReportSettingsSchema = z.object({
  reportsEnabled: z.boolean(),
  reportsSkipEmpty: z.boolean(),
  reportsIncludeTips: z.boolean(),
  reportsHourUtc: z.number().int().min(0).max(23),
});
export type ReportSettings = z.infer<typeof ReportSettingsSchema>;
export const WEEK_MS = 7 * 86400000;

// All intervals are half-open and use UTC, like the analytics dashboard.
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
export function reportRange(start: Date, end: Date) {
  const fmt = new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  return `${fmt.format(start)} – ${fmt.format(new Date(end.getTime() - 1))}`;
}
function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
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
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><style>
  @media(max-width:600px){.content{padding:24px!important}.outer{padding:16px 8px!important}}
  @media(prefers-color-scheme:dark){.outer{background:#0a0a0a!important}.content{background:#171717!important;color:#fafafa!important;border-color:#404040!important}.cta{background:#e5e5e5!important;color:#171717!important}}
  </style></head><body style="margin:0;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" class="outer" style="padding:32px 16px;background:#f5f5f5"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px"><tr><td class="content" style="padding:40px;background:#ffffff;color:#0a0a0a;border:1px solid #e5e5e5;border-radius:16px;line-height:1.6">
  <p style="font-size:13px;font-weight:bold;letter-spacing:1px">EXTRAVERTYAI · BUSINESS</p><h1 style="font-size:28px;line-height:1.2;margin:24px 0 12px">Votre semaine en chiffres</h1><h2 style="font-size:18px;margin:0">${escapeHtml(name)}</h2><p>${escapeHtml(reportRange(start, end))} · UTC<br>Comparaison avec la semaine précédente</p>
  <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px"><caption style="text-align:left;padding:12px 0;font-weight:bold">Vos indicateurs</caption><thead><tr><th scope="col" align="left" style="padding:10px 0">Indicateur</th><th scope="col" align="right">Total</th><th scope="col" align="right">Évolution</th></tr></thead><tbody>${(Object.keys(reportMetricLabels) as (keyof ReportMetrics)[]).map((key) => `<tr><th scope="row" align="left" style="padding:12px 8px 12px 0;border-top:1px solid #e5e5e5;font-weight:normal">${escapeHtml(reportMetricLabels[key])}</th><td align="right" style="border-top:1px solid #e5e5e5;font-weight:bold">${snapshot.current[key]}</td><td align="right" style="border-top:1px solid #e5e5e5;padding-left:12px">${escapeHtml(reportDelta(snapshot.current[key], snapshot.previous[key]))}</td></tr>`).join("")}</tbody></table>
  ${snapshot.partial ? "<p>Projet récent : les périodes peuvent être incomplètes.</p>" : ""}<p style="font-size:12px">Les variations décrivent l’activité ; elles ne prouvent pas un gain de performance. Les échecs reflètent le statut au moment du calcul.</p>${snapshot.tips.length ? `<h2 style="font-size:18px;margin-top:28px">Pistes d’amélioration</h2><ul style="padding-left:20px;font-size:14px">${snapshot.tips.map((tip) => `<li style="margin-bottom:12px">${escapeHtml(tip)}</li>`).join("")}</ul>` : ""}<p style="margin:28px 0"><a class="cta" style="display:inline-block;padding:12px 18px;border-radius:8px;background:#171717;color:#fafafa;text-decoration:none;font-size:14px;font-weight:bold" href="${escapeHtml(parsed.href)}">Consulter le rapport et gérer les envois</a></p><p style="font-size:12px">Envoyé aux Owner et Admin du projet. Aucune conversation ni coordonnée client n’est incluse.</p></td></tr></table></td></tr></table></body></html>`;
  return { subject, text, html };
}
