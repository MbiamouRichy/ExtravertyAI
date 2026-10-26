import { z } from "zod";
import type { PrismaClient } from "../src/generated/prisma/client";

export const FEEDBACK_MESSAGE_MAX = 2000;
/** Au plus 5 retours par heure et par personne : assez pour un vrai usage. */
const HOURLY_LIMIT = 5;

// Safe to show as is to the user.
export class ProductFeedbackError extends Error {}

export const ProductFeedbackSchema = z.object({
  kind: z.enum(["BUG", "IDEA", "PRAISE"]),
  message: z
    .string()
    .trim()
    .min(10, "Décrivez votre retour en quelques mots (10 caractères minimum).")
    .max(
      FEEDBACK_MESSAGE_MAX,
      `${FEEDBACK_MESSAGE_MAX} caractères au maximum.`,
    ),
  contactOk: z.boolean(),
  // Chemin de la page, jamais l’URL complète : pas de paramètres ni de jetons.
  pagePath: z
    .string()
    .max(200)
    .regex(/^\/[\w\-/[\]]*$/)
    .optional(),
});

export async function submitProductFeedback(
  db: PrismaClient,
  userId: string,
  input: z.infer<typeof ProductFeedbackSchema>,
) {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await db.productFeedback.count({
    where: { userId, createdAt: { gt: since } },
  });
  if (recent >= HOURLY_LIMIT)
    throw new ProductFeedbackError(
      "Merci pour vos nombreux retours ! Réessayez dans une heure.",
    );
  // Le projet n’est rattaché que si la personne en est membre.
  const projectId = input.pagePath?.match(/^\/projects\/(c[a-z0-9]{20,})/)?.[1];
  const membership = projectId
    ? await db.projectMembership.findUnique({
        where: { userId_projectId: { userId, projectId } },
        select: { projectId: true, project: { select: { name: true } } },
      })
    : null;
  const saved = await db.productFeedback.create({
    data: {
      kind: input.kind,
      message: input.message,
      contactOk: input.contactOk,
      pagePath: input.pagePath ?? null,
      userId,
      projectId: membership?.projectId ?? null,
    },
    select: { id: true, user: { select: { name: true, email: true } } },
  });
  // De quoi prévenir l’équipe (e-mail) sans relire la base.
  return {
    id: saved.id,
    kind: input.kind,
    message: input.message,
    contactOk: input.contactOk,
    pagePath: input.pagePath ?? null,
    projectName: membership?.project.name ?? null,
    authorName: saved.user?.name ?? "Utilisateur",
    authorEmail: saved.user?.email ?? "",
  };
}
