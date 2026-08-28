"use server";

// Importe ton instance serveur better-auth et prisma selon ta structure
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { z } from "zod";

const ThemeSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
});

export async function updateThemeAction(formData: z.infer<typeof ThemeSchema>) {
  try {
    // 1. Vérification de la session (Sécurité)
    const session = await getSession();

    if (!session?.user?.id) {
      return { success: false, error: "Non authentifié" };
    }

    // 2. Validation des données
    const parsed = ThemeSchema.safeParse(formData);
    if (!parsed.success) throw new Error("Thème invalide");

    // 3. Mise à jour en base de données
    await prisma.user.update({
      where: { id: session.user.id },
      data: { theme: parsed.data.theme },
    });

    return { success: true };
  } catch (error: unknown) {
    const errorMessage =
      error instanceof Error ? error.message : "Erreur lors de la mise à jour";
    console.error("Erreur updateThemeAction:", errorMessage);
    return { success: false, error: errorMessage };
  }
}
