"use server";

import { cookies } from "next/headers";
import prisma from "@/lib/prisma";
import {
  DELETION_FEEDBACK_COOKIE,
  hashFeedbackToken,
} from "@/lib/account-deletion-records";
import { DeletionFeedbackSchema } from "@/lib/deletion-feedback";

export type DeletionFeedbackResult =
  | { success: true }
  | { success: false; error: string };

// Anonymous by design: the only proof of eligibility is the one-time cookie set
// when the account was deleted. Nothing ties the answer to the former account.
export async function submitDeletionFeedback(
  input: unknown,
): Promise<DeletionFeedbackResult> {
  const parsed = DeletionFeedbackSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: "Vérifiez votre réponse puis réessayez." };

  const jar = await cookies();
  const token = jar.get(DELETION_FEEDBACK_COOKIE)?.value;
  if (!token || token.length > 128)
    return { success: false, error: "Ce questionnaire n’est plus disponible." };

  try {
    const { count } = await prisma.accountDeletionFeedback.updateMany({
      where: {
        tokenHash: hashFeedbackToken(token),
        submittedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        reason: parsed.data.reason,
        comment: parsed.data.comment || null,
        submittedAt: new Date(),
      },
    });
    // The cookie stays until it expires: it also opens the goodbye page, which
    // now shows the thank-you note. Deleting it here would re-render the page
    // in the same round trip and bounce the user home before they read it.
    return count
      ? { success: true }
      : { success: false, error: "Ce questionnaire n’est plus disponible." };
  } catch {
    return {
      success: false,
      error: "Votre réponse n’a pas pu être enregistrée. Réessayez.",
    };
  }
}
