import {
  EMAIL_BODY_FONT,
  EMAIL_FONT_CSS,
  EMAIL_FONT_HEAD,
  EMAIL_HEADING_FONT,
} from "./emailFonts";

// Shared building blocks for every transactional email. Helpers take HTML
// strings: callers must escape untrusted values with escapeHtml/safeEmailUrl.
// Literal sRGB values mirror the neutral shadcn palette in app/globals.css,
// because email clients cannot resolve CSS variables or OKLCH tokens.

export const EMAIL_SITE_URL = "https://extravertyai.com";
export const EMAIL_LOGO_URL = `${EMAIL_SITE_URL}/logo-email.png`;

export type EmailTone = "neutral" | "success" | "warning" | "danger" | "info";

const tones: Record<EmailTone, { soft: string; border: string; text: string; dot: string }> = {
  neutral: { soft: "#f5f5f5", border: "#e5e5e5", text: "#404040", dot: "#737373" },
  success: { soft: "#f0fdf4", border: "#bbf7d0", text: "#15803d", dot: "#22c55e" },
  warning: { soft: "#fffbeb", border: "#fde68a", text: "#92400e", dot: "#f59e0b" },
  danger: { soft: "#fef2f2", border: "#fecaca", text: "#b91c1c", dot: "#ef4444" },
  info: { soft: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", dot: "#3b82f6" },
};

const H = `font-family:${EMAIL_HEADING_FONT};`;

export function escapeHtml(value: string) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );
}

/** Accepts only credential-free http(s) URLs and returns them escaped for attributes. */
export function safeEmailUrl(value: string, errorCode: string) {
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
    throw new Error(errorCode);
  return escapeHtml(url.href);
}

export const emailUi = {
  pill(tone: EmailTone, label: string) {
    const t = tones[tone];
    return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td class="tone-${tone}" style="padding:6px 12px;background:${t.soft};border:1px solid ${t.border};border-radius:999px;color:${t.text};font-size:12px;font-weight:bold;letter-spacing:0.3px"><span style="color:${t.dot}">&#9679;</span>&nbsp; ${label}</td></tr></table>`;
  },
  h1(html: string) {
    return `<h1 class="main email-title" style="margin:0 0 16px;${H}font-size:28px;font-weight:800;line-height:1.2;letter-spacing:-0.6px;color:#0a0a0a">${html}</h1>`;
  },
  h2(html: string) {
    return `<h2 class="main" style="margin:32px 0 8px;${H}font-size:18px;font-weight:700;line-height:1.3;color:#0a0a0a">${html}</h2>`;
  },
  p(html: string, options: { muted?: boolean; small?: boolean; margin?: string } = {}) {
    const color = options.muted ? "#737373" : "#0a0a0a";
    return `<p class="${options.muted ? "muted" : "main"}" style="margin:${options.margin ?? "0 0 16px"};font-size:${options.small ? "13px" : "15px"};line-height:1.7;color:${color}">${html}</p>`;
  },
  strong(html: string) {
    return `<strong class="main" style="color:#0a0a0a">${html}</strong>`;
  },
  chip(html: string) {
    return `<span class="chip" style="display:inline-block;padding:1px 8px;background:#f5f5f5;border:1px solid #e5e5e5;border-radius:6px;color:#0a0a0a;font-size:13px;font-weight:bold;word-break:break-all">${html}</span>`;
  },
  button(href: string, label: string, tone: "primary" | "danger" = "primary") {
    const bg = tone === "danger" ? "#dc2626" : "#171717";
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:8px 0 28px"><a class="email-button${tone === "danger" ? " email-button-danger" : ""}" href="${href}" target="_blank" style="display:inline-block;padding:15px 26px;background:${bg};color:#fafafa;border-radius:10px;font-size:15px;font-weight:bold;text-decoration:none;mso-padding-alt:15px 26px">${label} &rarr;</a></td></tr></table>`;
  },
  callout(tone: EmailTone, html: string) {
    const t = tones[tone];
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr><td class="tone-${tone}" style="padding:14px 16px;background:${t.soft};border:1px solid ${t.border};border-radius:10px;color:${t.text};font-size:14px;line-height:1.65">${html}</td></tr></table>`;
  },
  /** Key facts block: rows of [label, value] HTML. */
  details(rows: [string, string][]) {
    const body = rows
      .map(
        ([label, value], index) =>
          `<tr><td class="muted${index ? " divider" : ""}" style="padding:${index ? "12px" : "0"} 12px 0 0;${index ? "border-top:1px solid #e5e5e5;" : ""}font-size:13px;color:#737373;white-space:nowrap" valign="top">${label}</td><td class="main${index ? " divider" : ""}" align="right" style="padding:${index ? "12px" : "0"} 0 ${index === rows.length - 1 ? "0" : "12px"};${index ? "border-top:1px solid #e5e5e5;" : ""}font-size:14px;font-weight:bold;color:#0a0a0a;word-break:break-word">${value}</td></tr>`,
      )
      .join("");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="details" style="margin:8px 0 24px;background:#fafafa;border:1px solid #e5e5e5;border-radius:12px"><tr><td style="padding:18px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${body}</table></td></tr></table>`;
  },
  fallback(href: string) {
    return `<p class="muted divider" style="margin:0;padding-top:20px;border-top:1px solid #e5e5e5;font-size:12px;line-height:1.65;color:#737373">Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur&nbsp;:<br><a class="link" href="${href}" target="_blank" style="color:#171717;word-break:break-all">${href}</a></p>`;
  },
  note(html: string) {
    return `<p class="muted" style="margin:20px 0 0;font-size:12px;line-height:1.65;color:#737373">${html}</p>`;
  },
};

export function renderEmail(options: {
  title: string;
  preheader: string;
  content: string;
  /** Small uppercase badge next to the wordmark, e.g. BUSINESS. */
  badge?: string;
  /** Why the recipient gets this email. HTML. */
  reason?: string;
  maxWidth?: number;
}) {
  const width = options.maxWidth ?? 560;
  const year = new Date().getUTCFullYear();
  const tonesDark = `.tone-neutral{background:#262626!important;border-color:#404040!important;color:#d4d4d4!important}.tone-success{background:#052e16!important;border-color:#14532d!important;color:#86efac!important}.tone-warning{background:#451a03!important;border-color:#78350f!important;color:#fcd34d!important}.tone-danger{background:#450a0a!important;border-color:#7f1d1d!important;color:#fca5a5!important}.tone-info{background:#172554!important;border-color:#1e3a8a!important;color:#93c5fd!important}`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark">
<meta name="x-apple-disable-message-reformatting">
<title>${options.title}</title>
${EMAIL_FONT_HEAD}
<style>
${EMAIL_FONT_CSS}
:root{color-scheme:light dark;supported-color-schemes:light dark}
body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
table,td{mso-table-lspace:0;mso-table-rspace:0}
img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic}
@media(max-width:600px){.email-content{padding:28px 20px!important}.email-outer{padding:16px 8px!important}.email-title{font-size:24px!important}.email-button{display:block!important;text-align:center!important}.tile-cell{display:block!important;width:100%!important;padding:0 0 12px!important}}
@media(prefers-color-scheme:dark){.body-bg{background:#0a0a0a!important}.surface{background:#171717!important;border-color:#404040!important}.main{color:#fafafa!important}.muted{color:#a3a3a3!important}.details,.tile{background:#262626!important;border-color:#404040!important}.chip{background:#262626!important;border-color:#404040!important;color:#fafafa!important}.divider{border-color:#404040!important}.pill{background:#404040!important;color:#e5e5e5!important}.badge{background:#e5e5e5!important;color:#171717!important}.email-button{background:#e5e5e5!important;color:#171717!important}.email-button-danger{background:#ef4444!important;color:#fafafa!important}.link{color:#fafafa!important}${tonesDark}}
[data-ogsc] .main{color:#fafafa!important}[data-ogsc] .muted{color:#a3a3a3!important}[data-ogsc] .link{color:#fafafa!important}
</style>
</head>
<body class="body-bg" style="margin:0;padding:0;background:#f5f5f5;color:#0a0a0a;font-family:${EMAIL_BODY_FONT};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${options.preheader}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="body-bg" style="background:#f5f5f5"><tr><td class="email-outer" align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:${width}px">
<tr><td style="padding:0 4px 20px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
<td style="vertical-align:middle;width:46px"><a href="${EMAIL_SITE_URL}" target="_blank"><img src="${EMAIL_LOGO_URL}" alt="ExtravertyAI" width="36" height="36" style="display:block;width:36px;height:36px"></a></td>
<td class="main heading" style="vertical-align:middle;${H}font-size:19px;font-weight:800;letter-spacing:-0.4px;color:#0a0a0a">ExtravertyAI</td>
${options.badge ? `<td align="right" style="vertical-align:middle"><span class="pill" style="display:inline-block;padding:4px 10px;border-radius:999px;background:#e5e5e5;color:#404040;font-size:11px;font-weight:bold;letter-spacing:0.8px">${options.badge}</span></td>` : ""}
</tr></table>
</td></tr>
<tr><td class="email-content surface" style="padding:40px;background:#ffffff;border:1px solid #e5e5e5;border-radius:16px">
${options.content}
</td></tr>
<tr><td align="center" style="padding:24px 16px 0">
${options.reason ? `<p class="muted" style="margin:0 0 10px;font-size:12px;line-height:1.6;color:#737373">${options.reason}</p>` : ""}
<p class="muted" style="margin:0;font-size:12px;line-height:1.6;color:#737373"><a class="link" href="${EMAIL_SITE_URL}" target="_blank" style="color:#737373;text-decoration:underline">extravertyai.com</a><br>&copy; ${year} ExtravertyAI · Une équipe à votre écoute, à distance.</p>
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
