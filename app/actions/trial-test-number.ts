"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { parseProjectPhone } from "@/lib/project-creation-schema";
import { requireProjectPermission, SettingsError } from "@/lib/project-settings";
import {
  isTrialRestricted,
  TRIAL_TEST_NUMBER_MAX_CHANGES,
} from "@/lib/trial-restrictions";

type Result = { success: true; changesLeft: number } | { success: false; error: string };

const Schema = z.object({
  projectId: z.string().cuid(),
  number: z.string().trim().min(1).max(40),
});

/**
 * Numéro autorisé à échanger avec le projet pendant l'essai. Les changements
 * sont comptés : on ne peut pas faire défiler de vrais clients sur ce numéro.
 */
export async function saveTrialTestNumber(
  input: z.input<typeof Schema>,
): Promise<Result> {
  const parsed = Schema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Demande invalide." };
  const session = await getSession();
  if (!session?.user?.id) return { success: false, error: "Connexion requise." };
  const { projectId, number } = parsed.data;
  try {
    const phone = parseProjectPhone(number.startsWith("+") ? number : `+${number}`);
    if (!phone)
      throw new SettingsError(
        "Saisissez un numéro international valide, indicatif compris (ex. +241 66 12 34 56).",
      );
    const digits = phone.number.slice(1);
    const changesLeft = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM project WHERE id = ${projectId} FOR UPDATE`;
      const { project } = await requireProjectPermission(
        tx,
        projectId,
        session.user.id,
        "project.manage",
      );
      if (project.deletionPending)
        throw new SettingsError("Ce projet est en cours de suppression.");
      if (!isTrialRestricted(project))
        throw new SettingsError(
          "Le numéro de test ne sert que pendant l’essai : votre projet échange déjà avec tous vos contacts.",
        );
      if (digits === project.numero.replace(/^\+/, ""))
        throw new SettingsError(
          "Choisissez un autre numéro que celui de votre WhatsApp professionnel.",
        );
      if (digits === project.trialTestNumber)
        return TRIAL_TEST_NUMBER_MAX_CHANGES - project.trialTestNumberChanges;
      const changes = project.trialTestNumber
        ? project.trialTestNumberChanges + 1
        : project.trialTestNumberChanges;
      if (changes > TRIAL_TEST_NUMBER_MAX_CHANGES)
        throw new SettingsError(
          "Vous avez atteint le nombre de changements autorisés pendant l’essai.",
        );
      await tx.project.update({
        where: { id: projectId },
        // Le @lid appris appartenait à l'ancien numéro.
        data: { trialTestNumber: digits, trialTestJid: null, trialTestNumberChanges: changes },
      });
      await tx.settingsAudit.create({
        data: {
          projectId,
          actorId: session.user.id,
          action: "trial.test_number.updated",
          version: project.settingsVersion,
        },
      });
      return TRIAL_TEST_NUMBER_MAX_CHANGES - changes;
    });
    revalidatePath(`/projects/${projectId}`, "layout");
    return { success: true, changesLeft };
  } catch (error) {
    if (error instanceof SettingsError) return { success: false, error: error.message };
    console.error("[trial] Échec de l’enregistrement du numéro de test.");
    return { success: false, error: "Impossible d’enregistrer. Réessayez." };
  }
}
