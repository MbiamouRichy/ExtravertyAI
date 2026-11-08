"use server";

import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import {
  PhoneVerificationError,
  confirmVerificationCode,
  sendVerificationCode,
} from "@/lib/phone-verification";
import { ProjectCheckoutSchema } from "@/lib/project-creation-schema";
import { ownProjectNumberConflict } from "@/lib/project-number-conflict";

const SendSchema = z.union([
  // Création : le numéro saisi, normalisé comme à l’enregistrement du projet.
  z.object({ numero: ProjectCheckoutSchema.shape.numero }).strict(),
  // Reprise d’un paiement jamais abouti : le numéro du projet enregistré.
  z.object({ projectId: z.string().cuid() }).strict(),
]);

const ConfirmSchema = z.object({
  verificationId: z.string().uuid(),
  code: z.string().trim().regex(/^\d{6}$/),
});

async function currentUserId() {
  const session = await getSession();
  // Même exigence que pour créer un projet : une adresse e-mail prouvée.
  if (!session?.user?.id || session.user.emailVerified !== true) return null;
  return session.user.id;
}

function failure(error: unknown) {
  if (error instanceof PhoneVerificationError)
    return {
      success: false as const,
      code: error.code,
      error: error.message,
      retryAfterSeconds: error.retryAfterSeconds,
    };
  console.error("[otp] Vérification du numéro indisponible.");
  return {
    success: false as const,
    error: "La vérification est momentanément indisponible. Réessayez dans quelques instants.",
  };
}

/** Envoie par WhatsApp un code au numéro saisi (ou à celui du projet). */
export async function sendNumberCode(input: z.input<typeof SendSchema>) {
  const parsed = SendSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false as const,
      code: "INVALID_NUMBER" as const,
      error: "Saisissez un numéro international valide.",
    };
  const userId = await currentUserId();
  if (!userId) return { success: false as const, error: "Connexion requise." };
  const target = parsed.data;
  // Inutile de prouver un numéro qu’un de vos projets utilise déjà.
  if ("numero" in target) {
    const conflict = await ownProjectNumberConflict(prisma, userId, target.numero);
    if (conflict)
      return { success: false as const, code: "NUMBER_IN_USE" as const, error: conflict };
  }
  try {
    const sent = await sendVerificationCode(prisma, { userId, target });
    return {
      success: true as const,
      verificationId: sent.verificationId,
      expiresAt: sent.expiresAt.toISOString(),
      resendAt: sent.resendAt.toISOString(),
    };
  } catch (error) {
    return failure(error);
  }
}

/** Vérifie le code ; la preuve obtenue permet d’enregistrer le projet. */
export async function confirmNumberCode(input: z.input<typeof ConfirmSchema>) {
  const parsed = ConfirmSchema.safeParse(input);
  if (!parsed.success)
    return {
      success: false as const,
      code: "WRONG_CODE" as const,
      error: "Saisissez les 6 chiffres du code.",
    };
  const userId = await currentUserId();
  if (!userId) return { success: false as const, error: "Connexion requise." };
  try {
    const { verificationId } = await confirmVerificationCode(prisma, {
      userId,
      ...parsed.data,
    });
    return { success: true as const, verificationId };
  } catch (error) {
    return failure(error);
  }
}
