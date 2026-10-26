"use server";

import { z } from "zod";
import { can } from "@/lib/project-permissions";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";

const InputSchema = z.object({
  projectId: z.string().cuid(),
  contactId: z.string().cuid(),
});

/**
 * Renvoie le numéro complet d’un contact, uniquement pour la copie.
 * Réservé aux propriétaires et administrateurs du projet : le rôle et
 * l’appartenance du contact au projet sont vérifiés côté serveur.
 */
export async function revealContactPhone(
  input: unknown,
): Promise<{ success: true; phone: string } | { success: false; error: string }> {
  const parsed = InputSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Demande invalide." };

  const session = await getSession();
  if (!session?.user?.id) return { success: false, error: "Connexion requise." };

  const { projectId, contactId } = parsed.data;
  try {
    const membership = await prisma.projectMembership.findUnique({
      where: { userId_projectId: { userId: session.user.id, projectId } },
      select: { role: true },
    });
    if (!can(membership?.role, "contacts.view")) {
      return {
        success: false,
        error: "Seuls les propriétaires, administrateurs et superviseurs peuvent copier ce numéro.",
      };
    }

    const contact = await prisma.contact.findFirst({
      where: { id: contactId, projectId },
      select: { phone: true },
    });
    const digits = contact?.phone?.replace(/\D/g, "") ?? "";
    if (digits.length < 8 || digits.length > 15) {
      return { success: false, error: "Numéro indisponible." };
    }
    // Aucune journalisation du numéro.
    return { success: true, phone: `+${digits}` };
  } catch {
    return { success: false, error: "Numéro indisponible pour le moment." };
  }
}
