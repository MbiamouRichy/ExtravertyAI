import type {
  PrismaClient,
  InstanceStatus,
} from "@/src/generated/prisma/client";
import { sameWhatsAppNumber } from "@/lib/whatsapp-number";

// Only promote a provider-confirmed connection if nothing changed while the
// request was in flight. In particular, never overwrite a newer webhook.
export async function confirmInstanceConnection(
  db: Pick<PrismaClient, "project">,
  project: {
    id: string;
    instanceName: string;
    instanceStatus: InstanceStatus;
    updatedAt: Date;
  },
): Promise<InstanceStatus> {
  const result = await db.project.updateMany({
    where: {
      id: project.id,
      instanceName: project.instanceName,
      instanceStatus: project.instanceStatus,
      updatedAt: project.updatedAt,
      status: { in: ["active", "trialing"] },
    },
    data: { instanceStatus: "connected" },
  });

  if (result.count > 0) return "connected";

  const current = await db.project.findUniqueOrThrow({
    where: { id: project.id },
    select: { instanceStatus: true },
  });
  return current.instanceStatus;
}

/** Numéro du compte WhatsApp relié (« 241…:12@s.whatsapp.net »), sinon null. */
export function ownerNumberOf(jid: unknown) {
  if (typeof jid !== "string") return null;
  const match = /^([1-9]\d{7,14})(?::\d+)?@s\.whatsapp\.net$/.exec(jid.trim());
  return match ? match[1] : null;
}

/**
 * Un seul essai par numéro WhatsApp : pendant l'essai, le compte relié doit
 * être le numéro déclaré à la création, dans l’une ou l’autre de ses écritures
 * (ancienne numérotation gabonaise comprise). Sans numéro connu, rien n'est bloqué.
 */
export function isForeignTrialNumber(
  project: { numero: string; status: string },
  ownerJid: unknown,
) {
  if (project.status !== "trialing") return false;
  const owner = ownerNumberOf(ownerJid);
  return !!owner && !sameWhatsAppNumber(owner, project.numero);
}

export const FOREIGN_TRIAL_NUMBER_ERROR =
  "Ce compte WhatsApp n’est pas celui du projet. Pendant l’essai, connectez le numéro déclaré à la création du projet.";
