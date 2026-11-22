"use server";

import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { HelpFeedbackInputSchema, type HelpFeedbackInput } from "@/lib/help-center/feedback-shared";
import { HelpFeedbackError, helpFeedbackVisitorHash, recordHelpFeedback } from "@/lib/help-feedback";
import { allowRequest } from "@/lib/rate-limit";
import { isBot } from "@/lib/site-analytics";

type Result = { success: true } | { success: false; error: string };

/**
 * Vote « Cet article vous a-t-il aidé ? » du centre d’aide public. Ouvert sans
 * compte : tout est revalidé ici, et le débit est limité par visiteur.
 */
export async function submitHelpFeedbackAction(input: HelpFeedbackInput): Promise<Result> {
  const parsed = HelpFeedbackInputSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message ?? "Demande invalide." };

  const requestHeaders = await headers();
  const userAgent = (requestHeaders.get("user-agent") ?? "").slice(0, 400);
  // Un robot n’a rien à dire sur l’aide : on le remercie sans rien compter.
  if (isBot(userAgent)) return { success: true };
  const ip =
    requestHeaders.get("x-real-ip") ??
    requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (!allowRequest(`help-feedback:${ip}`, 20, 10 * 60_000))
    return { success: false, error: "Trop d’envois en peu de temps. Réessayez dans quelques minutes." };

  const secret = process.env.ANALYTICS_SALT || process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    console.error("[aide] Vote ignoré : aucun secret d’empreinte configuré.");
    return { success: false, error: "Votre avis n’a pas pu être enregistré. Réessayez plus tard." };
  }

  try {
    const session = await getSession();
    const userId = session?.user?.id ?? null;
    await recordHelpFeedback(prisma, parsed.data, {
      visitorHash: helpFeedbackVisitorHash(secret, { userId, ip, userAgent }),
      userId,
    });
    return { success: true };
  } catch (error) {
    if (error instanceof HelpFeedbackError) return { success: false, error: error.message };
    console.error("[aide] Vote non enregistré.", { article: parsed.data.articleSlug });
    return { success: false, error: "Votre avis n’a pas pu être enregistré. Réessayez dans un instant." };
  }
}
