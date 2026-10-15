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
    jar.delete({ name: DELETION_FEEDBACK_COOKIE, path: "/goodbye" });
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
