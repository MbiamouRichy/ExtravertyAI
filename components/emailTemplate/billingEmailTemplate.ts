import {
  EMAIL_BODY_FONT,
  EMAIL_FONT_CSS,
  EMAIL_FONT_HEAD,
  EMAIL_HEADING_FONT,
} from "./emailFonts";
type BillingEmailTemplateProps = {
  title: string;
  projectName: string;
  deadline: string;
  message: string;
  reminder: boolean;
  billingUrl: string;
};

function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character]!,
  );
}

// Email clients need literal sRGB fallbacks. These match the neutral semantic
// background/foreground/muted/border/primary palette in app/globals.css.
export function BillingEmailTemplate(props: BillingEmailTemplateProps) {
  const url = new URL(props.billingUrl);
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error("INVALID_BILLING_URL");
  }
  const title = escapeHtml(props.title);
  const name = escapeHtml(props.projectName);
  const deadline = escapeHtml(props.deadline);
  const href = escapeHtml(url.href);
  const status = props.reminder ? "Échéance à venir" : "Action requise";
  const deadlineLabel = props.reminder
    ? "Votre accès se termine le"
    : "Votre accès s’est terminé le";
  const next = props.reminder
    ? "Vérifiez votre abonnement et votre moyen de paiement avant l’échéance pour éviter une interruption."
    : "Consultez la facturation du projet pour vérifier votre abonnement et régulariser votre situation.";
  const impact = props.reminder
    ? "Sans paiement confirmé à l’échéance, les envois et les fonctions IA seront suspendus. Votre historique restera accessible."
    : "Les envois et les fonctions IA sont suspendus. Votre historique reste accessible.";
  // Reminder = warning tone, expired = destructive tone. Dark variants below.
  const tone = props.reminder
    ? { soft: "#fffbeb", border: "#fde68a", text: "#92400e", dot: "#f59e0b" }
    : { soft: "#fef2f2", border: "#fecaca", text: "#b91c1c", dot: "#ef4444" };
  const toneClass = props.reminder ? "tone-warning" : "tone-danger";
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${title}</title>
${EMAIL_FONT_HEAD}
<style>
${EMAIL_FONT_CSS}
:root{color-scheme:light dark;supported-color-schemes:light dark}
body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table,td{mso-table-lspace:0;mso-table-rspace:0}
img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}
@media(max-width:600px){.email-content{padding:28px 20px!important}.email-outer{padding:16px 8px!important}.email-title{font-size:24px!important}.email-button{display:block!important;text-align:center!important}}
@media(prefers-color-scheme:dark){.body-bg{background:#0a0a0a!important}.surface{background:#171717!important;border-color:#404040!important}.main{color:#fafafa!important}.muted{color:#a3a3a3!important}.details{background:#262626!important;border-color:#404040!important}.divider{border-color:#404040!important}.email-button{background:#e5e5e5!important;color:#171717!important}.link{color:#fafafa!important}.tone-warning{background:#451a03!important;border-color:#78350f!important;color:#fcd34d!important}.tone-danger{background:#450a0a!important;border-color:#7f1d1d!important;color:#fca5a5!important}}
[data-ogsc] .main{color:#fafafa!important}[data-ogsc] .muted{color:#a3a3a3!important}[data-ogsc] .link{color:#fafafa!important}
</style>
</head>
<body class="body-bg" style="margin:0;padding:0;background:#f5f5f5;color:#0a0a0a;font-family:${EMAIL_BODY_FONT}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${status} pour ${name} · ${deadline}. ${escapeHtml(next)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="body-bg" style="background:#f5f5f5"><tr><td class="email-outer" align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
<tr><td style="padding:0 4px 20px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;padding-right:10px"><a href="https://extravertyai.com" target="_blank"><img src="https://extravertyai.com/logo-email.png" alt="ExtravertyAI" width="36" height="36" style="display:block;width:36px;height:36px"></a></td>
<td class="main heading" style="vertical-align:middle;font-family:${EMAIL_HEADING_FONT};font-size:19px;font-weight:800;letter-spacing:-0.4px;color:#0a0a0a">ExtravertyAI</td>
</tr></table>
</td></tr>
<tr><td>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="surface" style="background:#ffffff;border:1px solid #e5e5e5;border-radius:16px">
<tr><td class="email-content" style="padding:40px">
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td class="${toneClass}" style="padding:6px 12px;background:${tone.soft};border:1px solid ${tone.border};border-radius:999px;color:${tone.text};font-size:12px;font-weight:bold;letter-spacing:0.3px"><span style="color:${tone.dot}">&#9679;</span>&nbsp; ${status}</td></tr></table>
<h1 class="main email-title" style="font-family:${EMAIL_HEADING_FONT};font-weight:800;margin:0 0 16px;font-size:28px;line-height:1.25;letter-spacing:-0.5px;color:#0a0a0a">${title}</h1>
<p class="main" style="margin:0 0 28px;font-size:16px;line-height:1.65;color:#0a0a0a">Bonjour,<br>Vous recevez cet e-mail en tant que propriétaire du projet <strong>${name}</strong>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="details" style="background:#fafafa;border:1px solid #e5e5e5;border-radius:12px"><tr><td style="padding:20px 22px">
<p class="muted" style="margin:0 0 6px;font-size:13px;color:#737373">${deadlineLabel}</p>
<p class="main heading" style="margin:0 0 14px;font-family:${EMAIL_HEADING_FONT};font-size:22px;line-height:1.4;font-weight:bold;color:#0a0a0a">${deadline}</p>
<p class="muted" style="margin:0;font-size:13px;line-height:1.5;color:#737373">Projet&nbsp;: <span class="main" style="color:#0a0a0a;font-weight:bold">${name}</span></p>
</td></tr></table>
<p class="main" style="margin:24px 0 16px;font-size:16px;line-height:1.65;color:#0a0a0a">${escapeHtml(props.message)}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="${toneClass}" style="padding:14px 16px;background:${tone.soft};border:1px solid ${tone.border};border-radius:10px;color:${tone.text};font-size:14px;line-height:1.6"><strong>Ce que cela change&nbsp;:</strong> ${impact}</td></tr></table>
<h2 class="main" style="font-family:${EMAIL_HEADING_FONT};font-weight:700;margin:32px 0 8px;font-size:17px;color:#0a0a0a">Votre prochaine étape</h2>
<p class="main" style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#0a0a0a">${next}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding-bottom:28px"><a class="email-button" href="${href}" target="_blank" style="display:inline-block;padding:15px 26px;background:#171717;color:#fafafa;border-radius:10px;font-size:15px;font-weight:bold;text-decoration:none;mso-padding-alt:15px 26px">Consulter la facturation &rarr;</a></td></tr></table>
<p class="muted" style="margin:0 0 20px;font-size:13px;line-height:1.65;color:#737373">Déjà réglé&nbsp;? La reprise se fera après confirmation du paiement. Cet e-mail décrit la situation au moment de sa préparation.</p>
<p class="muted divider" style="margin:0;padding-top:20px;border-top:1px solid #e5e5e5;font-size:12px;line-height:1.65;color:#737373">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur&nbsp;:<br><a class="link" href="${href}" style="color:#171717;word-break:break-all">${href}</a></p>
</td></tr></table>
</td></tr>
<tr><td align="center" style="padding:24px 16px 0">
<p class="muted" style="margin:0;font-size:12px;line-height:1.6;color:#737373">Notification de service · <a class="link" href="https://extravertyai.com" target="_blank" style="color:#737373;text-decoration:underline">ExtravertyAI</a><br>Gérez votre abonnement depuis votre espace sécurisé.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
