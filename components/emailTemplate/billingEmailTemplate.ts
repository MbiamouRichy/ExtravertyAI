import { emailUi as ui, escapeHtml, renderEmail, safeEmailUrl } from "./emailLayout";

type BillingEmailTemplateProps = {
  title: string;
  projectName: string;
  deadline: string;
  message: string;
  reminder: boolean;
  billingUrl: string;
};

export function BillingEmailTemplate(props: BillingEmailTemplateProps) {
  const href = safeEmailUrl(props.billingUrl, "INVALID_BILLING_URL");
  const title = escapeHtml(props.title);
  const name = escapeHtml(props.projectName);
  const deadline = escapeHtml(props.deadline);
  const status = props.reminder ? "Échéance à venir" : "Action requise";
  const next = props.reminder
    ? "Vérifiez votre abonnement et votre moyen de paiement avant l’échéance pour éviter une interruption."
    : "Consultez la facturation du projet pour vérifier votre abonnement et régulariser votre situation.";
  const impact = props.reminder
    ? "Sans paiement confirmé à l’échéance, les envois et les fonctions IA seront suspendus. Votre historique restera accessible."
    : "Les envois et les fonctions IA sont suspendus. Votre historique reste accessible.";
  const tone = props.reminder ? "warning" : "danger";
  return renderEmail({
    title,
    preheader: `${status} pour ${name} · ${deadline}. ${escapeHtml(next)}`,
    reason: `Vous recevez cet e-mail en tant que propriétaire du projet ${name}.`,
    content: [
      ui.pill(tone, status),
      ui.h1(title),
      ui.p(escapeHtml(props.message)),
      ui.details([
        ["Projet", name],
        [props.reminder ? "Fin de l’accès" : "Accès terminé le", deadline],
      ]),
      ui.callout(tone, `<strong>Ce que cela change&nbsp;:</strong> ${impact}`),
      ui.h2("Votre prochaine étape"),
      ui.p(next),
      ui.button(href, "Consulter la facturation"),
      ui.fallback(href),
      ui.note("Déjà réglé&nbsp;? La reprise se fera après confirmation du paiement. Cet e-mail décrit la situation au moment de sa préparation."),
    ].join(""),
  });
}
