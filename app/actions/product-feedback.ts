"use server";

import { after } from "next/server";
import type { z } from "zod";
import { resend } from "@/lib/resend";
import { ProductFeedbackEmail } from "@/components/emailTemplate/productFeedbackEmail";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import {
  ProductFeedbackError,
  ProductFeedbackSchema,
  submitProductFeedback,
} from "@/lib/product-feedback";

export async function submitProductFeedbackAction(
  input: z.input<typeof ProductFeedbackSchema>,
): Promise<{ success: true } | { success: false; error: string }> {
  const parsed = ProductFeedbackSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Demande invalide.",
    };
  const session = await getSession();
  if (!session?.user?.id)
    return { success: false, error: "Connexion requise." };
  try {
    const feedback = await submitProductFeedback(
      prisma,
      session.user.id,
      parsed.data,
    );
    // E-mail à l’équipe après la réponse : un incident d’envoi ne fait jamais
    // perdre le retour, déjà enregistré.
    const recipients = (process.env.FEEDBACK_NOTIFY_EMAIL ?? "")
      .split(",")
      .map((address) => address.trim())
      .filter(Boolean);
    if (recipients.length)
      after(async () => {
        try {
          const { error } = await resend.emails.send({
            from: "ExtravertyAI <notification@extravertyai.com>",
            to: recipients,
            // Répondre à l’e-mail écrit directement à l’utilisateur, s’il l’accepte.
            ...(feedback.contactOk && feedback.authorEmail
              ? { replyTo: feedback.authorEmail }
              : {}),
            subject: `[${feedback.kind === "BUG" ? "Bug" : feedback.kind === "IDEA" ? "Idée" : "Merci"}] ${feedback.message.replace(/\s+/g, " ").slice(0, 60)}`,
            html: ProductFeedbackEmail(feedback),
          });
          if (error) throw error;
        } catch {
          console.error("[feedback] E-mail de notification non envoyé.", {
            id: feedback.id,
          });
        }
      });
    return { success: true };
  } catch (error) {
    if (error instanceof ProductFeedbackError)
      return { success: false, error: error.message };
    console.error("[feedback] Retour non enregistré.");
    return {
      success: false,
      error: "Votre retour n’a pas pu être envoyé. Réessayez dans un instant.",
    };
  }
}
