import type { Prisma } from "../src/generated/prisma/client";
import { planFeatures } from "./plan-features";

const MB = 1024 * 1024;

// Safe to show as is to the user.
export class StorageQuotaError extends Error {}

/** « 480 Mo », « 1,2 Go » : même unité que les offres. */
export function formatStorage(bytes: number) {
  const mb = bytes / MB;
  return mb >= 1000
    ? `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(mb / 1000)} Go`
    : `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: mb < 10 ? 1 : 0 }).format(mb)} Mo`;
}

export async function storageUsage(
  db: Pick<Prisma.TransactionClient, "storedFile">,
  projectId: string,
  plan: unknown,
) {
  const { _sum } = await db.storedFile.aggregate({
    where: { projectId },
    _sum: { bytes: true },
  });
  return { used: _sum.bytes ?? 0, limit: planFeatures(plan).storageMb * MB };
}

/**
 * Réserve la place d’un fichier avant son envoi vers le stockage.
 * L’appelant tient le verrou du projet (SELECT … FOR UPDATE) : deux envois
 * simultanés ne peuvent pas dépasser le quota ensemble.
 */
export async function reserveStorage(
  tx: Prisma.TransactionClient,
  input: { projectId: string; plan: unknown; key: string; bytes: number },
) {
  const { used, limit } = await storageUsage(tx, input.projectId, input.plan);
  if (used + input.bytes > limit) {
    throw new StorageQuotaError(
      `Espace de fichiers plein : ${formatStorage(used)} utilisés sur ${formatStorage(limit)}. Supprimez des documents ou changez d’offre.`,
    );
  }
  await tx.storedFile.create({
    data: { key: input.key, projectId: input.projectId, bytes: input.bytes },
  });
}

export async function releaseStorage(
  db: Pick<Prisma.TransactionClient, "storedFile">,
  key: string,
) {
  await db.storedFile.deleteMany({ where: { key } });
}
