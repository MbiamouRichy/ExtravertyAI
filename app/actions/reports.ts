"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { ReportSettingsSchema } from "@/lib/weekly-report";
import { SettingsError } from "@/lib/project-settings";
import { writeReportSettings } from "@/lib/report-settings";

export async function saveReportSettings(input: unknown) {
  try {
    const parsed = z
      .object({
        projectId: z.string().cuid(),
        version: z.number().int().nonnegative(),
        settings: ReportSettingsSchema,
      })
      .parse(input);
    const session = await getSession();
    if (!session?.user?.id) throw new SettingsError("Connexion requise.");
    const version = await prisma.$transaction((tx) =>
      writeReportSettings(
        tx,
        parsed.projectId,
        session.user.id,
        parsed.version,
        parsed.settings,
      ),
    );
    revalidatePath(`/projects/${parsed.projectId}/reports`);
    return { success: true as const, version };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof SettingsError
          ? error.message
          : "Impossible d’enregistrer les réglages. Réessayez après actualisation.",
    };
  }
}
