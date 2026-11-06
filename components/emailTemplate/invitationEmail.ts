import { emailUi as ui, escapeHtml, renderEmail, safeEmailUrl } from "./emailLayout";
import { roleLabel } from "@/lib/project-permissions";

export function emailRoleLabel(role: string) {
  return roleLabel(role);
}

// Invitations are valid for 7 days (see app/actions/team.ts).
export function ProjectInvitationEmail({
  inviterName,
  projectName,
  role,
  inviteUrl,
  email,
  hasAccount,
}: {
  inviterName: string;
  projectName: string;
  role: string;
  inviteUrl: string;
  email: string;
  /** L’adresse a déjà un compte : pas de création, seulement une confirmation. */
  hasAccount: boolean;
}) {
  const href = safeEmailUrl(inviteUrl, "INVALID_INVITE_URL");
  const inviter = escapeHtml(inviterName);
  const project = escapeHtml(projectName);
  const address = escapeHtml(email);
  return renderEmail({
    title: `Invitation à rejoindre ${project}`,
    preheader: `${inviter} vous invite à collaborer sur ${project} dans ExtravertyAI.`,
    reason: `Envoyé à ${address} à la demande de ${inviter}.`,
    content: [
      ui.pill("info", "Invitation"),
      ui.h1(`Rejoignez ${project} sur ExtravertyAI`),
      ui.p(`${ui.strong(inviter)} vous invite à collaborer sur le projet ${ui.strong(project)}. ${hasAccount ? "Connectez-vous pour accepter ou refuser&nbsp;: aucun accès n’est créé sans votre accord." : "Créez votre compte pour accéder aux conversations et à l’agent IA de l’équipe."}`),
      ui.details([
        ["Projet", project],
        ["Rôle", escapeHtml(emailRoleLabel(role))],
        ["Validité", "7 jours"],
      ]),
      ui.button(href, hasAccount ? "Voir l’invitation" : "Accepter l’invitation"),
      ui.fallback(href),
      ui.note(`Vous ne connaissez pas ${inviter} ou n’attendiez pas cette invitation&nbsp;? Ignorez cet e-mail&nbsp;: aucun accès ne sera créé.`),
    ].join(""),
  });
}
