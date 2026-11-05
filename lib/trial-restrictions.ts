import type { Prisma } from "../src/generated/prisma/client";
import { projectBillingStatus } from "./project-status";

/**
 * Pendant l'essai gratuit, le projet ne sert qu'à se tester : les échanges
 * sont limités au numéro de test enregistré et les exports sont fermés.
 * L'essai ne peut ainsi pas servir à travailler avec de vrais clients.
 */
export const TRIAL_TEST_NUMBER_MAX_CHANGES = 3;

export const TRIAL_EXPORT_BLOCKED =
  "Les exports sont disponibles dès le premier paiement de votre abonnement.";
export const TRIAL_RECIPIENT_BLOCKED =
  "Pendant l’essai, seul votre numéro de test peut recevoir des messages. Enregistrez-le dans les paramètres du projet.";

type TrialProject = {
  status: string;
  automationPaused: boolean;
  statusBeforePause: string | null;
  trialTestNumber: string | null;
  trialTestJid: string | null;
};

export function isTrialRestricted(project: TrialProject) {
  return projectBillingStatus(project) === "trialing";
}

/** Identifiants WhatsApp du numéro de test : par numéro, puis par @lid. */
export function trialTestJids(project: TrialProject) {
  return [
    project.trialTestNumber && `${project.trialTestNumber}@s.whatsapp.net`,
    project.trialTestJid,
  ].filter((jid): jid is string => !!jid);
}

export function trialAllowsJid(project: TrialProject, ...jids: (string | null | undefined)[]) {
  if (!isTrialRestricted(project)) return true;
  const allowed = trialTestJids(project);
  return jids.some((jid) => !!jid && allowed.includes(jid));
}

/** Filtre Prisma des contacts joignables : tous, sauf pendant l'essai. */
export function trialContactWhere(project: TrialProject): Prisma.ContactWhereInput {
  return isTrialRestricted(project)
    ? { remoteJid: { in: trialTestJids(project) } }
    : {};
}
