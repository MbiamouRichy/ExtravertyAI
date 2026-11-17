import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import {
  BusinessProfileSchema,
  LINKS_ENTRY_TITLE,
  linksEntryContent,
  normalizeLinks,
  parseLinksContent,
  readStoredProfile,
  sameLinks,
  type BusinessLinks,
  type BusinessProfileInput,
  type StoredBusinessProfile,
} from "./business-profile";
import { writeEntry } from "./knowledge";
import { SettingsError, requireProjectAdmin } from "./project-settings";

type Db = PrismaClient | Prisma.TransactionClient;

/** Entrée « Informations » des liens, si elle existe encore dans ce projet. */
async function linksEntry(db: Db, projectId: string, id: string | null) {
  if (!id) return null;
  return db.knowledgeEntry.findFirst({
    where: { id, projectId, kind: "TEXT" },
    select: { id: true, content: true },
  });
}

/**
 * Fiche affichée dans le parcours : relue du projet et de l’entrée des liens.
 * L’appelant a déjà vérifié que l’utilisateur administre le projet.
 */
export async function loadBusinessProfile(
  db: Db,
  project: { id: string; name: string; businessProfile: unknown },
): Promise<{ profile: BusinessProfileInput; stored: StoredBusinessProfile }> {
  const stored = readStoredProfile(project.businessProfile);
  const entry = await linksEntry(db, project.id, stored.linksEntryId);
  const links: BusinessLinks = entry
    ? parseLinksContent(entry.content)
    : { website: null, socials: [] };
  return {
    stored,
    profile: {
      companyName: project.name,
      sector: stored.sector,
      description: stored.description,
      website: links.website ?? "",
      socials: links.socials.map((url) => ({ url })),
      goals: stored.goals,
      goalDetails: stored.goalDetails,
    },
  };
}

/**
 * Enregistre la fiche (propriétaire et administrateurs) en une transaction :
 * nom du projet, activité, secteur, objectifs, et entrée « Informations » des
 * liens créée, mise à jour ou supprimée dans les limites de l’offre. L’entrée
 * n’est réécrite que si les liens ont changé : un texte ajouté à la main dans
 * Connaissances survit à un simple enregistrement de la fiche.
 *
 * Un nouveau nom fait avancer la version de l’agent (`renamed`) : l’assistant
 * se présente avec ce nom.
 */
export async function writeBusinessProfile(
  db: PrismaClient,
  input: { projectId: string; userId: string; profile: unknown },
) {
  const profile = BusinessProfileSchema.parse(input.profile);
  const links = normalizeLinks({
    website: profile.website,
    socials: profile.socials.map((social) => social.url),
  });
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${input.projectId} FOR UPDATE`;
    const { project } = await requireProjectAdmin(tx, input.projectId, input.userId);
    if (project.deletionPending)
      throw new SettingsError("Ce projet est en cours de suppression.");

    const stored = readStoredProfile(project.businessProfile);
    const entry = await linksEntry(tx, project.id, stored.linksEntryId);
    let linksEntryId = entry?.id ?? null;
    let linksChanged = false;
    const content = linksEntryContent(links);
    if (!content) {
      if (entry) await tx.knowledgeEntry.delete({ where: { id: entry.id } });
      linksChanged = !!entry;
      linksEntryId = null;
    } else if (!entry || !sameLinks(parseLinksContent(entry.content), links)) {
      const saved = await writeEntry(tx, project.plan, {
        projectId: project.id,
        userId: input.userId,
        id: entry?.id,
        entry: { kind: "TEXT", title: LINKS_ENTRY_TITLE, content, price: null, stock: null },
      });
      linksEntryId = saved.id;
      linksChanged = true;
    }

    const businessProfile: StoredBusinessProfile = {
      description: profile.description,
      sector: profile.sector,
      goals: profile.goals,
      goalDetails: profile.goalDetails,
      linksEntryId,
    };
    const renamed = profile.companyName !== project.name;
    const updated = await tx.project.update({
      where: { id: project.id },
      data: {
        businessProfile,
        // Même effet qu’un renommage dans les réglages du projet.
        ...(renamed && {
          name: profile.companyName,
          settingsVersion: { increment: 1 },
          agentConfigVersion: { increment: 1 },
        }),
      },
      select: { agentConfigVersion: true, settingsVersion: true },
    });
    await tx.settingsAudit.create({
      data: {
        projectId: project.id,
        actorId: input.userId,
        action: renamed ? "business.renamed" : "business.updated",
        version: updated.settingsVersion,
      },
    });
    return { renamed, agentVersion: updated.agentConfigVersion, linksChanged };
  });
}
