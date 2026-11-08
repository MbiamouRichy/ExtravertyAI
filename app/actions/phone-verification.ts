"use server";

import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import {
  PhoneVerificationError,
  confirmVerificationCode,
  sendVerificationCode,
  startInboundVerification,
  verificationStatus,
  type VerificationTarget,
} from "@/lib/phone-verification";
import { ProjectCheckoutSchema } from "@/lib/project-creation-schema";
import { ownProjectNumberConflict } from "@/lib/project-number-conflict";
import { allowRequest } from "@/lib/rate-limit";

const TargetSchema = z.union([
  // Création : le numéro saisi, normalisé comme à l’enregistrement du projet.
  z.object({ numero: ProjectCheckoutSchema.shape.numero }).strict(),
  // Reprise d’un paiement jamais abouti : le numéro du projet enregistré.
  z.object({ projectId: z.string().cuid() }).strict(),
]);

const ConfirmSchema = z.object({
  verificationId: z.string().uuid(),
  code: z.string().trim().regex(/^\d{6}$/),
});

const StatusSchema = z.object({ verificationId: z.string().uuid() });

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

/** Numéro saisi validé, sans projet de ce compte qui l’utilise déjà. */
async function checkedTarget(input: unknown) {
  const parsed = TargetSchema.safeParse(input);
  if (!parsed.success)
    return {
      ok: false as const,
      failure: {
        success: false as const,
        code: "INVALID_NUMBER" as const,
        error: "Saisissez un numéro international valide.",
      },
    };
  const userId = await currentUserId();
  if (!userId)
    return {
      ok: false as const,
      failure: { success: false as const, error: "Connexion requise." },
    };
  const target: VerificationTarget = parsed.data;
  if ("numero" in target) {
    // Inutile de prouver un numéro qu’un de vos projets utilise déjà.
    const conflict = await ownProjectNumberConflict(prisma, userId, target.numero);
    if (conflict)
      return {
        ok: false as const,
        failure: {
          success: false as const,
          code: "NUMBER_IN_USE" as const,
          error: conflict,
        },
      };
  }
  return { ok: true as const, userId, target };
}

/**
 * Vérification inversée (par défaut) : un code que le client envoie lui-même
 * depuis son WhatsApp au numéro d’ExtravertyAI.
 */
export async function startNumberMessage(input: z.input<typeof TargetSchema>) {
  const checked = await checkedTarget(input);
  if (!checked.ok) return checked.failure;
  try {
    const started = await startInboundVerification(prisma, {
      userId: checked.userId,
      target: checked.target,
    });
    return {
      success: true as const,
      verificationId: started.verificationId,
      code: started.code,
      text: started.text,
      link: started.link,
      to: started.to,
      expiresAt: started.expiresAt.toISOString(),
    };
  } catch (error) {
    return failure(error);
  }
}

/** La page attend le message du client : la preuve est-elle arrivée ? */
export async function checkNumberMessage(input: z.input<typeof StatusSchema>) {
  const parsed = StatusSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Demande invalide." };
  const userId = await currentUserId();
  if (!userId) return { success: false as const, error: "Connexion requise." };
  // Interrogée toutes les quelques secondes : au-delà, c’est un abus.
  if (!allowRequest(`otp-status:${userId}`, 60, 60 * 1000))
    return { success: false as const, error: "Trop de vérifications. Patientez un instant." };
  const status = await verificationStatus(prisma, { userId, ...parsed.data });
  return { success: true as const, status };
}

/** En secours : envoie par WhatsApp un code au numéro saisi (ou à celui du projet). */
export async function sendNumberCode(input: z.input<typeof TargetSchema>) {
  const checked = await checkedTarget(input);
  if (!checked.ok) return checked.failure;
  try {
    const sent = await sendVerificationCode(prisma, {
      userId: checked.userId,
      target: checked.target,
    });
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

/** Vérifie le code recopié ; la preuve obtenue permet d’enregistrer le projet. */
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
