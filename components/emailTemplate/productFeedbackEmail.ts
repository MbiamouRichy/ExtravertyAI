import { emailUi, escapeHtml, renderEmail } from "./emailLayout";

const KIND = {
  BUG: { label: "Bug signalé", tone: "danger" },
  IDEA: { label: "Idée", tone: "info" },
  PRAISE: { label: "Ça marche bien", tone: "success" },
} as const;

/** Notification interne : un retour envoyé depuis le bouton « Votre avis ». */
export function ProductFeedbackEmail(input: {
  kind: keyof typeof KIND;
  message: string;
  authorName: string;
  authorEmail: string;
  contactOk: boolean;
  projectName: string | null;
  pagePath: string | null;
}) {
  const kind = KIND[input.kind];
  // Tout contenu saisi par l’utilisateur est échappé.
  const message = escapeHtml(input.message).replace(/\n/g, "<br>");
  return renderEmail({
    title: `Nouveau retour : ${kind.label}`,
    preheader: input.message.slice(0, 120),
    content: [
      emailUi.pill(kind.tone, kind.label),
      emailUi.h1("Nouveau retour sur ExtravertyAI"),
      emailUi.callout("neutral", message),
      emailUi.details([
        ["De", escapeHtml(`${input.authorName} · ${input.authorEmail}`)],
        ["Projet", escapeHtml(input.projectName ?? "—")],
        ["Page", escapeHtml(input.pagePath ?? "—")],
        [
          "Recontact",
          input.contactOk
            ? "Accepté : répondez directement à cet e-mail."
            : "Refusé : ne pas recontacter.",
        ],
      ]),
    ].join(""),
    reason:
      "Vous recevez cet e-mail car votre adresse reçoit les retours produit d’ExtravertyAI.",
  });
}
