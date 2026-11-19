import type { Prisma } from "../src/generated/prisma/client";
import { CURRENCIES, MAX_DEAL_VALUE, currencyDigits, formatDealValue } from "./pipeline-shared";
import { SettingsError } from "./project-settings";

export type ProjectCurrency = (typeof CURRENCIES)[number];

/**
 * Change la devise du projet : celle du catalogue, du pipeline et des réponses
 * de l’IA. La devise est corrigée, pas convertie : les montants gardent les
 * chiffres saisis (45 000 XAF devient 45 000 €). Entre devises de précisions
 * différentes (XAF sans centimes, EUR avec), les unités mineures stockées sont
 * donc remises à l’échelle, arrondies au plus proche.
 *
 * L’appelant a vérifié les droits dans la même transaction ; le projet est
 * verrouillé ici, pour qu’aucun montant ne s’enregistre pendant la bascule.
 * Renvoie `true` si la devise a changé.
 */
export async function applyProjectCurrency(
  tx: Prisma.TransactionClient,
  projectId: string,
  currency: ProjectCurrency,
) {
  const [project] = await tx.$queryRaw<{ currency: string }[]>`
    SELECT currency FROM project WHERE id = ${projectId} FOR UPDATE`;
  if (!project) throw new SettingsError("Projet introuvable.");
  if (project.currency === currency) return false;

  const shift = currencyDigits(currency) - currencyDigits(project.currency);
  if (shift > 0) {
    const factor = 10 ** shift;
    const ceiling = Math.floor(MAX_DEAL_VALUE / factor);
    const [prices, deals] = await Promise.all([
      tx.knowledgeEntry.count({ where: { projectId, price: { gt: ceiling } } }),
      tx.contact.count({ where: { projectId, dealValue: { gt: ceiling } } }),
    ]);
    if (prices + deals > 0) {
      throw new SettingsError(
        `Un prix ou un montant dépasse ${formatDealValue(MAX_DEAL_VALUE, currency)}, le maximum en ${currency}. Réduisez-le avant de changer de devise.`,
      );
    }
    await tx.knowledgeEntry.updateMany({
      where: { projectId, price: { not: null } },
      data: { price: { multiply: factor } },
    });
    await tx.contact.updateMany({
      where: { projectId, dealValue: { not: null } },
      data: { dealValue: { multiply: factor } },
    });
  } else if (shift < 0) {
    // Division entière après un demi-pas : l’arrondi au plus proche.
    const factor = 10 ** -shift;
    await tx.knowledgeEntry.updateMany({
      where: { projectId, price: { not: null } },
      data: { price: { increment: factor / 2 } },
    });
    await tx.knowledgeEntry.updateMany({
      where: { projectId, price: { not: null } },
      data: { price: { divide: factor } },
    });
    await tx.contact.updateMany({
      where: { projectId, dealValue: { not: null } },
      data: { dealValue: { increment: factor / 2 } },
    });
    await tx.contact.updateMany({
      where: { projectId, dealValue: { not: null } },
      data: { dealValue: { divide: factor } },
    });
  }

  await tx.project.update({ where: { id: projectId }, data: { currency } });
  return true;
}
