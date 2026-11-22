// Article du centre d'aide à proposer depuis chaque page de l'application.
// Sans dépendance au contenu de l'aide : ce module part dans le navigateur.
// tests/help-app-links.test.ts vérifie que chaque lien mène à un article (et à
// une section) qui existe, avec le bon titre.

export type AppHelpLink = { href: string; title: string };

export const HELP_CENTER_LINK: AppHelpLink = { href: "/aide", title: "Centre d’aide" };

const GUIDE: AppHelpLink = { href: "/aide/demarrer", title: "Mettre votre assistant WhatsApp en ligne" };
const ACCOUNT: AppHelpLink = { href: "/aide/compte", title: "Créer et sécuriser votre compte" };

/** Les étapes du guide de démarrage que l'application ouvre à des moments précis. */
export const GUIDE_STEP_LINKS = {
  project: { href: "/aide/demarrer#etape-2", title: "Créer votre projet" },
  verification: { href: "/aide/demarrer#etape-3", title: "Vérifier votre numéro et démarrer l’essai" },
  setup: { href: "/aide/demarrer#etape-4", title: "Configurer votre assistant" },
  whatsapp: { href: "/aide/demarrer#etape-5", title: "Connecter WhatsApp" },
} as const satisfies Record<string, AppHelpLink>;

/** Un écran de la configuration de l'assistant et sa section du guide. */
export const SETUP_STEP_LINKS = {
  company: { href: "/aide/demarrer#entreprise", title: "Entreprise : présentez votre activité" },
  goals: { href: "/aide/demarrer#objectifs", title: "Objectifs : ce qu’il doit prendre en charge" },
  profile: { href: "/aide/demarrer#profil", title: "Profil : présentez votre assistant" },
  mission: { href: "/aide/demarrer#mission", title: "Mission : ses instructions" },
  knowledge: { href: "/aide/demarrer#connaissances", title: "Connaissances : ce qu’il doit savoir" },
  test: { href: "/aide/demarrer#test", title: "Test : essayez-le comme un client" },
} as const satisfies Record<string, AppHelpLink>;

const ANALYTICS: AppHelpLink = { href: "/aide/statistiques", title: "Dashboard et Analytics" };
const MESSAGING: AppHelpLink = { href: "/aide/messagerie", title: "La messagerie partagée" };

/** Page d'un projet (premier segment après /projects/[id]) → article. */
const PROJECT_PAGE_LINKS: Record<string, AppHelpLink> = {
  "": ANALYTICS,
  analytics: ANALYTICS,
  reports: { href: "/aide/rapports", title: "Rapports et exports" },
  chat: MESSAGING,
  contacts: MESSAGING,
  broadcasts: { href: "/aide/diffusions", title: "Diffusions" },
  pipeline: { href: "/aide/pipeline", title: "Pipeline et relances automatiques" },
  knowledge: { href: "/aide/connaissances", title: "Ajouter des connaissances" },
  setup: GUIDE_STEP_LINKS.setup,
  settings: { href: "/aide/parametres", title: "Paramètres du projet" },
  team: { href: "/aide/equipe", title: "Équipe, rôles et invitations" },
  integrations: { href: "/aide/integrations", title: "Intégrations" },
  billing: { href: "/aide/abonnement", title: "Abonnement et recharges" },
};

/** Liens à vérifier par les tests : toutes les cibles possibles. */
export const ALL_APP_HELP_LINKS: AppHelpLink[] = [
  HELP_CENTER_LINK,
  GUIDE,
  ACCOUNT,
  ...Object.values(GUIDE_STEP_LINKS),
  ...Object.values(SETUP_STEP_LINKS),
  ...Object.values(PROJECT_PAGE_LINKS),
];

/**
 * L'article le plus utile pour la page ouverte. Une page inconnue mène à
 * l'accueil du centre d'aide plutôt qu'à un article sans rapport.
 */
export function helpLinkForAppPath(pathname: string | null | undefined): AppHelpLink {
  const segments = (pathname ?? "").split("?")[0].split("/").filter(Boolean);
  if (segments[0] !== "projects") return HELP_CENTER_LINK;
  if (segments.length === 1) return GUIDE;
  if (segments[1] === "new") return GUIDE_STEP_LINKS.project;
  if (segments[1] === "user") return ACCOUNT;
  return PROJECT_PAGE_LINKS[segments[2] ?? ""] ?? HELP_CENTER_LINK;
}
