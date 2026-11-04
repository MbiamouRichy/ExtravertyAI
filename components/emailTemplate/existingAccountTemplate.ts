import { emailUi as ui, escapeHtml, renderEmail, safeEmailUrl } from "./emailLayout";

// Sent instead of a sign-up confirmation when the address already has an
// account: the sign-up page answers the same way, so only the owner learns it.
export function ExistingAccountTemplate({
  email,
  signInUrl,
  resetUrl,
}: {
  email: string;
  signInUrl: string;
  resetUrl: string;
}) {
  const signIn = safeEmailUrl(signInUrl, "INVALID_SIGN_IN_URL");
  const reset = safeEmailUrl(resetUrl, "INVALID_RESET_URL");
  const address = escapeHtml(email);
  return renderEmail({
    title: "Vous avez déjà un compte",
    preheader: "Quelqu’un a tenté de créer un compte ExtravertyAI avec votre adresse.",
    reason: `Envoyé à ${address} suite à une tentative d’inscription avec cette adresse.`,
    content: [
      ui.pill("neutral", "Sécurité du compte"),
      ui.h1("Vous avez déjà un compte"),
      ui.p(`Une inscription vient d’être tentée avec l’adresse ${ui.strong(address)}, qui possède déjà un compte ExtravertyAI. Aucun nouveau compte n’a été créé.`),
      ui.button(signIn, "Me connecter"),
      ui.p(`Mot de passe oublié&nbsp;? <a class="link" href="${reset}" target="_blank" style="color:#171717">Réinitialisez-le</a>.`, { small: true }),
      ui.note("Ce n’était pas vous&nbsp;? Ignorez cet e-mail&nbsp;: votre compte et votre mot de passe restent inchangés."),
    ].join(""),
  });
}
