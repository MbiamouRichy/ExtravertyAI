import { formatMessageLimit, formatPlanPrice, PRICING_PLANS } from "@/lib/pricing";
import {
  SITE_ALTERNATE_NAMES,
  SITE_CONTACT,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
} from "@/lib/site";

// /llms.txt : fiche de la marque pour les assistants IA (ChatGPT, Claude,
// Perplexity…), au format proposé sur llmstxt.org. Les offres sont lues dans
// `lib/pricing` : la fiche suit les prix réels sans être réécrite.
export const dynamic = "force-static";

function body() {
  const plans = PRICING_PLANS.map(
    (plan) =>
      `- **${plan.name}** — ${formatPlanPrice(plan.priceCents)} par mois : ${plan.description} ${formatMessageLimit(plan.messageLimit)} messages par mois, ${plan.users} utilisateurs.`,
  ).join("\n");

  return `# ${SITE_NAME}

> ${SITE_DESCRIPTION}

${SITE_NAME} est aussi écrit ${SITE_ALTERNATE_NAMES.map((name) => `« ${name} »`).join(", ")}. Le site officiel est ${SITE_URL}.

## Ce que fait ${SITE_NAME}

- Un assistant IA répond aux clients d’une entreprise sur WhatsApp, 24 h/24 et 7 j/7, à partir de la base de connaissances de l’entreprise.
- L’équipe partage une messagerie, reprend une conversation en un clic et reçoit des suggestions de réponses.
- Selon l’offre : compréhension des notes vocales et des images, qualification des prospects, relances, diffusion de messages, statistiques et rapports.
- Le service est en français et s’adresse aux entreprises qui vendent et assurent leur service client sur WhatsApp.

## Offres

${plans}

Détail et comparaison : ${SITE_URL}/#tarifs

## Pages utiles

- [Accueil](${SITE_URL}/) : présentation du produit, démonstration et tarifs
- [À propos](${SITE_URL}/apropos) : l’équipe et sa démarche
- [Contact](${SITE_URL}/contact) : écrire à l’équipe
- [Créer un compte](${SITE_URL}/sign-up)
- [Conditions d’utilisation](${SITE_URL}/conditions)
- [Politique de remboursement](${SITE_URL}/remboursement)
- [Données et confidentialité](${SITE_URL}/donneesEtConfidentialite)

## Contact

- WhatsApp : ${SITE_CONTACT.whatsapp}
`;
}

export function GET() {
  return new Response(body(), {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
