import { emailUi as ui, escapeHtml, renderEmail, safeEmailUrl } from "./emailLayout";

// Sent to the CURRENT address so its owner approves the change.
export function ChangeEmailTemplate({
  url,
  newEmail,
}: {
  url: string;
  newEmail: string;
}) {
  const href = safeEmailUrl(url, "INVALID_CHANGE_EMAIL_URL");
  const next = escapeHtml(newEmail);
  return renderEmail({
    title: "Approuvez le changement d’adresse e-mail",
    preheader: `Une demande vise à remplacer l’adresse de votre compte par ${next}. Approuvez-la si elle vient de vous.`,
    reason: "Envoyé à l’adresse actuelle de votre compte, pour protéger son accès.",
    content: [
      ui.pill("warning", "Approbation requise"),
      ui.h1("Approuvez le changement d’adresse e-mail"),
      ui.p("Une demande de modification de l’adresse e-mail de votre compte ExtravertyAI vient d’être effectuée. Par sécurité, elle doit être approuvée depuis votre adresse actuelle."),
      ui.details([
        ["Nouvelle adresse", next],
        ["Validité du lien", "1 heure"],
      ]),
      ui.button(href, "Approuver le changement"),
      ui.callout(
        "danger",
        "<strong>Ce n’est pas vous&nbsp;?</strong> N’utilisez pas ce lien&nbsp;: votre adresse actuelle reste inchangée. Modifiez ensuite votre mot de passe par précaution.",
      ),
      ui.fallback(href),
    ].join(""),
  });
}
