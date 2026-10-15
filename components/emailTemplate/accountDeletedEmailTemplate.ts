import { emailUi as ui, escapeHtml, renderEmail } from "./emailLayout";

// Sent after the account is deleted. No action link: there is nothing left to
// sign in to, and a link in an unexpected email is a phishing pattern.
export function AccountDeletedEmailTemplate({
  email,
  deletedAt,
  projects,
  leftProjects,
}: {
  email: string;
  deletedAt: Date;
  projects: string[];
  leftProjects: number;
}) {
  const address = escapeHtml(email);
  const when = escapeHtml(
    new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(deletedAt) + " UTC",
  );
  const projectList = projects.length
    ? projects.map((name) => escapeHtml(name)).join(", ")
    : "Aucun";
  return renderEmail({
    title: "Votre compte ExtravertyAI a été supprimé",
    preheader: `Le compte ${address} a été supprimé le ${when}. Aucune action n’est nécessaire.`,
    reason: `Envoyé à ${address}. C’est le dernier e-mail lié à ce compte.`,
    content: [
      ui.pill("neutral", "Compte supprimé"),
      ui.h1("Votre compte a bien été supprimé"),
      ui.p(`La suppression du compte ${ui.strong(address)} est terminée. Merci d’avoir utilisé ExtravertyAI.`),
      ui.details([
        ["Date", when],
        ["Projets supprimés", projectList],
        ["Projets quittés", String(leftProjects)],
      ]),
      ui.p(
        "Les abonnements des projets supprimés ont été annulés et leurs numéros WhatsApp déconnectés. Aucun nouveau prélèvement ne sera effectué. Toutes vos sessions ont été fermées.",
      ),
      ui.callout(
        "neutral",
        "<strong>Cette suppression est définitive.</strong> Vos données ne peuvent pas être restaurées. Votre adresse e-mail est libérée et peut servir à créer un nouveau compte.",
      ),
      ui.note(
        "Vous n’êtes pas à l’origine de cette suppression&nbsp;? Elle n’était possible que depuis une session ouverte depuis moins de 10 minutes&nbsp;: changez sans attendre le mot de passe de votre messagerie et des services qui l’utilisent.",
      ),
    ].join(""),
  });
}
