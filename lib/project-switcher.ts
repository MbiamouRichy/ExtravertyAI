import type { PrismaClient } from "../src/generated/prisma/client";
import { projectLogoUrl } from "./project-logo";
import { can, roleLabel } from "./project-permissions";

/** Au-delà, le menu renvoie vers la liste complète « Tous mes projets ». */
export const SWITCHER_LIMIT = 30;

export type SwitcherProject = {
  id: string;
  name: string;
  logoUrl: string | null;
  /** Rôle déjà traduit : le navigateur ne reçoit que ce qu’il affiche. */
  role: string;
};

const PLAN_LABELS: Record<string, string> = {
  starter: "Offre Starter",
  pro: "Offre Pro",
  business: "Offre Business",
};

/**
 * Projets du membre connecté pour le sélecteur de la barre latérale, par
 * ordre alphabétique. Seules ses propres appartenances sont lues : un projet
 * dont il n’est pas membre n’y figure jamais.
 */
export async function listSwitcherProjects(
  db: Pick<PrismaClient, "projectMembership">,
  userId: string,
): Promise<SwitcherProject[]> {
  const memberships = await db.projectMembership.findMany({
    where: { userId },
    orderBy: [{ project: { name: "asc" } }, { projectId: "asc" }],
    take: SWITCHER_LIMIT,
    select: {
      role: true,
      project: { select: { id: true, name: true, logoKey: true } },
    },
  });
  return memberships.map(({ role, project }) => ({
    id: project.id,
    name: project.name,
    logoUrl: projectLogoUrl(project.id, project.logoKey),
    role: roleLabel(role),
  }));
}

/**
 * Ligne sous le nom du projet ouvert : l’état de l’offre pour qui peut voir
 * la facturation, sinon le rôle du membre.
 */
export function switcherSubtitle(
  role: string,
  project: { status: string; plan: string; deletionPending: boolean },
) {
  if (!can(role, "billing.view")) return roleLabel(role);
  if (project.deletionPending) return "Suppression en cours";
  if (project.status === "trialing") return "Essai gratuit";
  if (project.status === "active") return PLAN_LABELS[project.plan] ?? "Abonnement actif";
  if (project.status === "paused") return "En pause";
  return "Inactif";
}
