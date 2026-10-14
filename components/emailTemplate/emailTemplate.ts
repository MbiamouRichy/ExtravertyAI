import { emailUi as ui, escapeHtml, renderEmail, safeEmailUrl } from "./emailLayout";

// Sign-up email verification. Better Auth tokens expire after 1 hour by default.
export function EmailTemplate({ url, email }: { url: string; email: string }) {
  const href = safeEmailUrl(url, "INVALID_VERIFICATION_URL");
  const address = escapeHtml(email);
  return renderEmail({
    title: "Confirmez votre adresse e-mail",
    preheader: "Un clic pour activer votre compte ExtravertyAI. Le lien expire dans 1 heure.",
    reason: `Envoyé à ${address} suite à la création d’un compte ExtravertyAI.`,
    content: [
      ui.pill("info", "Dernière étape"),
      ui.h1("Confirmez votre adresse e-mail"),
      ui.p("Bienvenue sur ExtravertyAI&nbsp;! Il ne reste qu’une étape pour activer votre compte et connecter votre premier agent WhatsApp."),
      ui.details([
        ["Adresse", address],
        ["Validité du lien", "1 heure"],
      ]),
      ui.button(href, "Confirmer mon adresse"),
      ui.fallback(href),
      ui.note("Vous n’avez pas créé de compte&nbsp;? Ignorez cet e-mail&nbsp;: aucun compte ne sera activé sans confirmation."),
    ].join(""),
  });
}
