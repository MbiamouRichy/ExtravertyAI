import { emailUi as ui, escapeHtml, EMAIL_SUPPORT, renderEmail, safeEmailUrl } from "./emailLayout";
import { emailRoleLabel } from "./invitationEmail";

export function ProjectMemberConfirmationEmail({
  userName,
  inviterName,
  projectName,
  role,
  projectUrl,
  email,
}: {
  userName: string;
  inviterName: string;
  projectName: string;
  role: string;
  projectUrl: string;
  email: string;
}) {
  const href = safeEmailUrl(projectUrl, "INVALID_PROJECT_URL");
  const name = escapeHtml(userName);
  const inviter = escapeHtml(inviterName);
  const project = escapeHtml(projectName);
  const address = escapeHtml(email);
  return renderEmail({
    title: `Vous avez rejoint ${project}`,
    preheader: `${inviter} vous a ajouté au projet ${project}. Votre accès est déjà actif.`,
    reason: `Envoyé à ${address} suite à votre ajout au projet.`,
    content: [
      ui.pill("success", "Accès activé"),
      ui.h1(`Bienvenue dans l’équipe ${project}`),
      ui.p(`Bonjour ${name},`),
      ui.p(`${ui.strong(inviter)} vous a ajouté au projet ${ui.strong(project)}. Votre accès est déjà actif&nbsp;: connectez-vous pour consulter les conversations et collaborer avec l’équipe.`),
      ui.details([
        ["Projet", project],
        ["Rôle", escapeHtml(emailRoleLabel(role))],
        ["Ajouté par", inviter],
      ]),
      ui.button(href, "Ouvrir le projet"),
      ui.fallback(href),
      ui.note(`Une erreur&nbsp;? Contactez <a class="link" href="mailto:${EMAIL_SUPPORT}" style="color:#737373;text-decoration:underline">notre support</a> ou demandez à ${inviter} de retirer votre accès.`),
    ].join(""),
  });
}
