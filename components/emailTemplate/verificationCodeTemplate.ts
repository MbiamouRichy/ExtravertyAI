import { emailUi as ui, escapeHtml, renderEmail } from "./emailLayout";

// One-time code confirming the address of a new or still unverified account.
export function VerificationCodeTemplate({
  code,
  email,
  minutes,
}: {
  code: string;
  email: string;
  minutes: number;
}) {
  if (!/^\d{4,10}$/.test(code)) throw new Error("INVALID_VERIFICATION_CODE");
  const address = escapeHtml(email);
  return renderEmail({
    title: "Votre code de vérification",
    preheader: `Saisissez ce code dans ExtravertyAI pour confirmer votre adresse. Il expire dans ${minutes} minutes.`,
    reason: `Envoyé à ${address} pour confirmer cette adresse sur ExtravertyAI.`,
    content: [
      ui.pill("info", "Vérification de l’adresse"),
      ui.h1("Votre code de vérification"),
      ui.p("Saisissez ce code sur la page ouverte dans ExtravertyAI pour confirmer votre adresse e-mail."),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td align="center" class="details" style="padding:20px 16px;background:#fafafa;border:1px solid #e5e5e5;border-radius:12px"><span class="main" style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:32px;font-weight:bold;letter-spacing:8px;color:#0a0a0a">${code}</span></td></tr></table>`,
      ui.callout(
        "neutral",
        `<strong>Ce code expire dans ${minutes} minutes</strong> et ne sert qu’une seule fois. Ne le communiquez à personne&nbsp;: notre équipe ne vous le demandera jamais.`,
      ),
      ui.note("Vous n’êtes pas à l’origine de cette demande&nbsp;? Ignorez cet e-mail&nbsp;: aucun compte ne sera activé sans ce code."),
    ].join(""),
  });
}
