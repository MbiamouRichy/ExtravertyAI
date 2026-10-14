import { emailUi as ui, escapeHtml, renderEmail, safeEmailUrl } from "./emailLayout";

// Better Auth reset tokens expire after 1 hour by default.
export function ResetPasswordTemplate({
  url,
  email,
}: {
  url: string;
  email: string;
}) {
  const href = safeEmailUrl(url, "INVALID_RESET_URL");
  const address = escapeHtml(email);
  return renderEmail({
    title: "Réinitialisez votre mot de passe",
    preheader: "Choisissez un nouveau mot de passe pour votre compte ExtravertyAI. Le lien expire dans 1 heure.",
    reason: `Envoyé à ${address} suite à une demande de réinitialisation.`,
    content: [
      ui.pill("neutral", "Sécurité du compte"),
      ui.h1("Réinitialisez votre mot de passe"),
      ui.p(`Nous avons reçu une demande de réinitialisation du mot de passe pour le compte ${ui.strong(address)}. Choisissez un nouveau mot de passe en cliquant sur le bouton ci-dessous.`),
      ui.button(href, "Choisir un nouveau mot de passe"),
      ui.callout(
        "neutral",
        "<strong>Ce lien expire dans 1 heure</strong> et ne peut servir qu’une seule fois. Ne le partagez avec personne&nbsp;: notre équipe ne vous le demandera jamais.",
      ),
      ui.fallback(href),
      ui.note("Vous n’êtes pas à l’origine de cette demande&nbsp;? Ignorez cet e-mail&nbsp;: votre mot de passe actuel reste inchangé."),
    ].join(""),
  });
}
