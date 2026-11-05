import { emailUi as ui, escapeHtml, renderEmail } from "./emailLayout";

const COPY = {
  "email-verification": {
    title: "Votre code de vérification",
    pill: "Vérification de l’adresse",
    intro:
      "Saisissez ce code sur la page ouverte dans ExtravertyAI pour confirmer votre adresse e-mail.",
    preheader: "pour confirmer votre adresse",
    reason: "pour confirmer cette adresse sur ExtravertyAI",
    note: "Vous n’êtes pas à l’origine de cette demande&nbsp;? Ignorez cet e-mail&nbsp;: aucun compte ne sera activé sans ce code.",
  },
  "sign-in": {
    title: "Votre code de connexion",
    pill: "Connexion",
    intro:
      "Saisissez ce code sur la page de connexion d’ExtravertyAI pour accéder à votre compte.",
    preheader: "pour vous connecter",
    reason: "pour vous connecter à ExtravertyAI",
    note: "Vous n’avez pas demandé à vous connecter&nbsp;? Ignorez cet e-mail&nbsp;: personne ne peut entrer dans votre compte sans ce code.",
  },
} as const;

// One-time code: confirms an address, or signs in without a password.
export function VerificationCodeTemplate({
  code,
  email,
  minutes,
  purpose = "email-verification",
}: {
  code: string;
  email: string;
  minutes: number;
  purpose?: keyof typeof COPY;
}) {
  if (!/^\d{4,10}$/.test(code)) throw new Error("INVALID_VERIFICATION_CODE");
  const copy = COPY[purpose];
  const address = escapeHtml(email);
  return renderEmail({
    title: copy.title,
    preheader: `Saisissez ce code dans ExtravertyAI ${copy.preheader}. Il expire dans ${minutes} minutes.`,
    reason: `Envoyé à ${address} ${copy.reason}.`,
    content: [
      ui.pill("info", copy.pill),
      ui.h1(copy.title),
      ui.p(copy.intro),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td align="center" class="details" style="padding:20px 16px;background:#fafafa;border:1px solid #e5e5e5;border-radius:12px"><span class="main" style="font-family:'SFMono-Regular',Menlo,Consolas,monospace;font-size:32px;font-weight:bold;letter-spacing:8px;color:#0a0a0a">${code}</span></td></tr></table>`,
      ui.callout(
        "neutral",
        `<strong>Ce code expire dans ${minutes} minutes</strong> et ne sert qu’une seule fois. Ne le communiquez à personne&nbsp;: notre équipe ne vous le demandera jamais.`,
      ),
      ui.note(copy.note),
    ].join(""),
  });
}
