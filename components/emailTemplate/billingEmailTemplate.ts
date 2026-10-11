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
  const next = props.reminder
    ? "Vérifiez votre abonnement et votre moyen de paiement avant l’échéance pour éviter une interruption."
    : "Consultez la facturation du projet pour vérifier votre abonnement et régulariser votre situation.";
  const impact = props.reminder
    ? "Sans paiement confirmé à l’échéance, les envois et les fonctions IA seront suspendus. Votre historique restera accessible."
    : "Les envois et les fonctions IA sont suspendus. Votre historique reste accessible.";
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<title>${title}</title>
<style>
body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table,td{mso-table-lspace:0;mso-table-rspace:0}
@media(max-width:600px){.email-content{padding:28px 20px!important}.email-outer{padding:16px 8px!important}.email-button{display:block!important;text-align:center!important}}
@media(prefers-color-scheme:dark){.body-bg{background:#0a0a0a!important}.surface{background:#171717!important;border-color:#404040!important}.main{color:#fafafa!important}.muted{color:#a3a3a3!important}.details{background:#262626!important}.email-button{background:#e5e5e5!important;color:#171717!important}.link{color:#fafafa!important}}
</style>
</head>
<body class="body-bg" style="margin:0;background:#f5f5f5;color:#0a0a0a;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${status} pour ${name}. ${escapeHtml(next)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td class="email-outer" align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="surface" style="max-width:560px;background:#ffffff;border:1px solid #e5e5e5;border-radius:16px">
<tr><td class="email-content" style="padding:40px">
<p class="main" style="margin:0 0 32px;font-size:18px;font-weight:bold;color:#0a0a0a">ExtravertyAI</p>
<p class="muted" style="margin:0 0 12px;font-size:12px;letter-spacing:1px;color:#737373;text-transform:uppercase">${status}</p>
<h1 class="main" style="margin:0 0 20px;font-size:28px;line-height:1.25;letter-spacing:-0.5px;color:#0a0a0a">${title}</h1>
<p class="main" style="margin:0 0 24px;font-size:16px;line-height:1.65;color:#0a0a0a">Bonjour,<br>Vous recevez cet e-mail en tant que propriétaire du projet <strong>${name}</strong>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="details" style="background:#f5f5f5;border-radius:10px"><tr><td style="padding:20px">
<p class="muted" style="margin:0 0 8px;font-size:13px;color:#737373">Échéance de la période d’accès</p>
<p class="main" style="margin:0;font-size:18px;line-height:1.5;font-weight:bold;color:#0a0a0a">${deadline}</p>
</td></tr></table>
<p class="main" style="margin:24px 0 12px;font-size:16px;line-height:1.65;color:#0a0a0a">${escapeHtml(props.message)}</p>
<p class="muted" style="margin:0 0 24px;font-size:14px;line-height:1.65;color:#737373">${impact}</p>
<h2 class="main" style="margin:0 0 8px;font-size:17px;color:#0a0a0a">Votre prochaine étape</h2>
<p class="main" style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#0a0a0a">${next}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding-bottom:24px"><a class="email-button" href="${href}" style="display:inline-block;padding:16px 24px;background:#171717;color:#fafafa;border-radius:10px;font-size:15px;font-weight:bold;text-decoration:none;mso-padding-alt:16px 24px">Consulter la facturation</a></td></tr></table>
<p class="muted" style="margin:0 0 20px;font-size:13px;line-height:1.65;color:#737373">Déjà réglé ? La reprise se fera après confirmation du paiement. Cet e-mail décrit la situation au moment de sa préparation.</p>
<p class="muted" style="margin:0;font-size:12px;line-height:1.65;color:#737373">Si le bouton ne fonctionne pas, ouvrez ce lien :<br><a class="link" href="${href}" style="color:#171717;word-break:break-all">${href}</a></p>
</td></tr></table>
<p class="muted" style="max-width:520px;margin:20px 0 0;font-size:12px;line-height:1.6;color:#737373">Notification de service · ExtravertyAI<br>Gérez votre abonnement depuis votre espace sécurisé.</p>
</td></tr></table>
</body></html>`;
}
