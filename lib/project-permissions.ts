/**
 * Droits d’accès d’un membre à un projet : la seule source de vérité, lue par
 * les pages, les actions serveur, les routes et la navigation.
 *
 * Sans import serveur : la navigation l’utilise pour masquer les liens, mais
 * chaque page, action et route revérifie le rôle en base avant d’agir.
 */

/** Du plus large au plus restreint ; même ordre que l’enum Prisma inversé. */
export const PROJECT_ROLES = [
  "OWNER",
  "ADMIN",
  "SUPERVISOR",
  "AGENT",
  "VIEWER",
  "BILLING",
] as const;

export type ProjectRole = (typeof PROJECT_ROLES)[number];

export type ProjectPermission =
  /** Tableau de bord, Analytics et rapports hebdomadaires (agrégats, jamais de message). */
  | "stats.view"
  /** Réglages des rapports programmés (destinataires, jour d’envoi). */
  | "reports.manage"
  /** Lire les conversations, y répondre, les résoudre, les étiqueter et les annoter. */
  | "conversations.handle"
  /** Répartir les conversations en attente entre les équipiers. */
  | "conversations.dispatch"
  /** Liste des contacts, avec leurs numéros. */
  | "contacts.view"
  /** Export des contacts et des conversations, numéro complet. */
  | "contacts.export"
  /** Consulter le pipeline et les diffusions. */
  | "pipeline.view"
  /** Agent IA, base de connaissances, intégrations, pipeline, diffusions, réglages. */
  | "project.manage"
  /** Inviter, retirer et changer le rôle des membres. */
  | "team.manage"
  /** Offre, consommation et factures. */
  | "billing.view"
  /** Souscrire, changer d’offre, gérer le moyen de paiement. */
  | "billing.manage"
  /** Supprimer le projet, transférer la propriété. */
  | "project.own";

const MANAGERS = ["OWNER", "ADMIN"] as const;

const PERMISSIONS: Record<ProjectPermission, readonly ProjectRole[]> = {
  "stats.view": [...MANAGERS, "SUPERVISOR", "VIEWER"],
  "reports.manage": MANAGERS,
  "conversations.handle": [...MANAGERS, "SUPERVISOR", "AGENT"],
  "conversations.dispatch": [...MANAGERS, "SUPERVISOR"],
  "contacts.view": [...MANAGERS, "SUPERVISOR"],
  "contacts.export": MANAGERS,
  "pipeline.view": [...MANAGERS, "SUPERVISOR", "AGENT"],
  "project.manage": MANAGERS,
  "team.manage": MANAGERS,
  "billing.view": [...MANAGERS, "BILLING"],
  "billing.manage": ["OWNER", "BILLING"],
  "project.own": ["OWNER"],
};

export function isProjectRole(value: unknown): value is ProjectRole {
  return PROJECT_ROLES.includes(value as ProjectRole);
}

export function can(
  role: string | null | undefined,
  permission: ProjectPermission,
): boolean {
  return isProjectRole(role) && PERMISSIONS[permission].includes(role);
}

/** Rôles autorisés, pour filtrer directement dans une requête Prisma ou SQL. */
export function rolesWith(permission: ProjectPermission): ProjectRole[] {
  return [...PERMISSIONS[permission]];
}

/** Permission requise par chaque page d’un projet (segment après /projects/:id). */
export const PAGE_PERMISSIONS = {
  "": "stats.view",
  analytics: "stats.view",
  reports: "stats.view",
  chat: "conversations.handle",
  contacts: "project.manage",
  broadcasts: "pipeline.view",
  pipeline: "pipeline.view",
  knowledge: "project.manage",
  setup: "project.manage",
  team: "team.manage",
  integrations: "project.manage",
  settings: "project.manage",
  billing: "billing.view",
} as const satisfies Record<string, ProjectPermission>;

export type ProjectPage = keyof typeof PAGE_PERMISSIONS;

export function canOpenPage(role: string | null | undefined, page: ProjectPage) {
  return can(role, PAGE_PERMISSIONS[page]);
}

/** Première page utile d’un rôle : là où l’envoyer quand une page lui est fermée. */
export function homePath(projectId: string, role: string | null | undefined) {
  const base = `/projects/${projectId}`;
  if (can(role, "stats.view")) return base;
  if (can(role, "conversations.handle")) return `${base}/chat`;
  if (can(role, "billing.view")) return `${base}/billing`;
  return "/projects";
}

/**
 * Rôles qu’un membre peut attribuer (invitation ou changement de rôle).
 * Le propriétaire nomme tout le monde sauf un second propriétaire (transfert
 * dédié) ; un administrateur ne crée ni administrateur ni propriétaire.
 */
export function assignableRoles(role: string | null | undefined): ProjectRole[] {
  if (role === "OWNER") return ["ADMIN", "SUPERVISOR", "AGENT", "VIEWER", "BILLING"];
  if (role === "ADMIN") return ["SUPERVISOR", "AGENT", "VIEWER", "BILLING"];
  return [];
}

/** Un administrateur ne gère que les rôles inférieurs au sien. */
export function canManageMember(
  actorRole: string | null | undefined,
  targetRole: string | null | undefined,
) {
  if (!can(actorRole, "team.manage") || targetRole === "OWNER") return false;
  return actorRole === "OWNER" || targetRole !== "ADMIN";
}

export const ROLE_LABELS: Record<ProjectRole, string> = {
  OWNER: "Propriétaire",
  ADMIN: "Administrateur",
  SUPERVISOR: "Superviseur",
  AGENT: "Agent",
  VIEWER: "Lecteur",
  BILLING: "Facturation",
};

export const ROLE_DESCRIPTIONS: Record<ProjectRole, string> = {
  OWNER: "Accès complet, facturation et suppression du projet.",
  ADMIN: "Réglages, assistant IA, équipe, exports et intégrations.",
  SUPERVISOR: "Toutes les conversations, répartition de l’équipe, statistiques et rapports.",
  AGENT: "Répond aux conversations de la messagerie.",
  VIEWER: "Tableau de bord, analytics et rapports en lecture seule, sans les messages.",
  BILLING: "Offre, paiement et factures uniquement.",
};

export function roleLabel(role: string | null | undefined) {
  return isProjectRole(role) ? ROLE_LABELS[role] : "Membre";
}
