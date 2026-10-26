import { emailUi as ui, renderEmail, safeEmailUrl } from "./emailLayout";

export function DeleteAccountEmailTemplate({ url }: { url: string }) {
  const href = safeEmailUrl(url, "INVALID_DELETE_ACCOUNT_URL");
  return renderEmail({
    title: "Confirmez la suppression de votre compte",
    preheader: "Action requise : confirmez la suppression définitive de votre compte ExtravertyAI.",
    reason: "Envoyé suite à une demande de suppression de compte.",
    content: [
      ui.pill("danger", "Action irréversible"),
      ui.h1("Confirmez la suppression de votre compte"),
      ui.p("Nous avons reçu une demande de suppression de votre compte ExtravertyAI. Avant d’aller plus loin, nous devons vérifier qu’elle vient bien de vous."),
      ui.callout(
        "danger",
        "<strong>Cette action est définitive.</strong> Vos projets dont vous êtes propriétaire, la configuration de vos agents et l’historique des conversations seront supprimés. Les abonnements associés seront arrêtés.",
      ),
      ui.button(href, "Supprimer définitivement mon compte", "danger"),
      ui.fallback(href),
      ui.note("Vous n’avez pas demandé cette suppression&nbsp;? Ignorez cet e-mail&nbsp;: votre compte reste actif. Modifiez votre mot de passe si vous soupçonnez une activité suspecte."),
    ].join(""),
  });
}
