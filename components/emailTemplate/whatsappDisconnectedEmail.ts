import { emailUi as ui, escapeHtml, renderEmail, safeEmailUrl } from "./emailLayout";

/** Alerte aux administrateurs : le numéro WhatsApp du projet n’est plus relié. */
export function WhatsAppDisconnectedEmail({
  projectName,
  reconnectUrl,
}: {
  projectName: string;
  reconnectUrl: string;
}) {
  const href = safeEmailUrl(reconnectUrl, "INVALID_RECONNECT_URL");
  const project = escapeHtml(projectName);
  return renderEmail({
    title: `WhatsApp déconnecté : ${project}`,
    preheader: `Les messages de vos clients n’arrivent plus dans ExtravertyAI. Reconnectez WhatsApp.`,
    reason: `Envoyé aux administrateurs du projet ${project}.`,
    content: [
      ui.pill("danger", "WhatsApp déconnecté"),
      ui.h1(`Reconnectez WhatsApp sur ${project}`),
      ui.p(
        `Le numéro WhatsApp du projet ${ui.strong(project)} n’est plus relié à ExtravertyAI. Tant qu’il n’est pas reconnecté, les nouveaux messages de vos clients n’arrivent pas dans la messagerie et l’assistant ne leur répond pas.`,
      ),
      ui.button(href, "Reconnecter WhatsApp"),
      ui.fallback(href),
      ui.note(
        "Vous l’avez déconnecté vous-même&nbsp;? Ignorez cet e-mail. En attendant la reconnexion, répondez à vos clients depuis votre téléphone.",
      ),
    ].join(""),
  });
}

export function whatsAppDisconnectedText(projectName: string, reconnectUrl: string) {
  return [
    `WhatsApp déconnecté : ${projectName}`,
    "",
    "Le numéro WhatsApp de ce projet n’est plus relié à ExtravertyAI. Tant qu’il n’est pas reconnecté, les nouveaux messages de vos clients n’arrivent pas dans la messagerie et l’assistant ne leur répond pas.",
    "",
    `Reconnecter WhatsApp : ${reconnectUrl}`,
    "",
    "Vous l’avez déconnecté vous-même ? Ignorez cet e-mail.",
  ].join("\n");
}
