"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import type { Prisma } from "@/src/generated/prisma/client";
import { SettingsError, requireProjectPermission } from "@/lib/project-settings";
import { matchesPolarProduct } from "@/lib/checkout-price";
import { planForPolarProduct, syncPolarSubscription } from "@/lib/billing-polar";
import {
  holderManagesBilling,
  isPaymentHolder,
  maskEmail,
  planChange,
} from "@/lib/billing-plan-change";
import { teamSeats } from "@/lib/plan-features";
import { allowRequest } from "@/lib/rate-limit";
import { TRIAL_END_MANUAL_RETRY_SECONDS } from "@/lib/trial-end";
import {
  changePolarSubscriptionProduct,
  clearPolarPendingUpdate,
  createPolarPortalUrl,
  getPolarCustomer,
  getPolarProduct,
  getPolarSubscription,
  polarProductId,
} from "@/lib/polar";
import { PRICING_PLANS, planRank, pricingPlan, resolvePlanId, type PlanId } from "@/lib/pricing";
import { createPolarCreditCheckout } from "@/lib/polar";
import {
  MAX_CREDIT_PACKS,
  creditPackUnits,
  matchesPolarCreditProduct,
  polarCreditProductId,
} from "@/lib/message-credit";

const PLAN_IDS = PRICING_PLANS.map((plan) => plan.id) as [PlanId, ...PlanId[]];
const ChangePlanInput = z.object({
  projectId: z.string().cuid(),
  plan: z.enum(PLAN_IDS, { error: "Choisissez une offre." }),
});
const ProjectId = z.string().cuid();

const UNAVAILABLE = "Ce forfait est temporairement indisponible. Réessayez plus tard.";

function publicError(error: unknown) {
  if (error instanceof SettingsError) return error.message;
  if (error instanceof z.ZodError)
    return error.issues[0]?.message || "Données invalides.";
  console.error("[billing] Opération de facturation non confirmée.", error);
  return "L’opération n’a pas été confirmée. Réessayez après actualisation.";
}

async function currentUser() {
  const session = await getSession();
  if (!session?.user?.id) throw new SettingsError("Connexion requise.");
  return session.user;
}

function planFromProduct(productId: string | null | undefined) {
  if (!productId) return null;
  try {
    return planForPolarProduct(productId);
  } catch {
    return null;
  }
}

/**
 * Change l'offre d'un projet sans passer par le portail Polar, qui montrerait
 * tous les abonnements du client. Tout est revérifié ici : droits, appartenance
 * de l'abonnement au projet, état, titulaire du paiement, places d'équipe.
 */
export async function changeProjectPlan(input: unknown) {
  try {
    const { projectId, plan } = ChangePlanInput.parse(input);
    const user = await currentUser();
    const result = await prisma.$transaction(
      async (tx) => {
        // Un changement à la fois par projet : double clic, deux onglets.
        const [lock] = await tx.$queryRaw<{ locked: boolean }[]>`
          SELECT pg_try_advisory_xact_lock(hashtext(${`plan-change:${projectId}`})) AS locked`;
        if (!lock?.locked)
          throw new SettingsError(
            "Un changement d’offre est déjà en cours. Patientez quelques secondes.",
          );
        const { project } = await requireProjectPermission(
          tx,
          projectId,
          user.id,
          "billing.manage",
        );
        if (project.deletionPending)
          throw new SettingsError("Ce projet est en cours de suppression.");
        if (project.internal)
          throw new SettingsError("Ce projet n’a pas d’abonnement.");
        if (!project.stripeCustomerId || !project.stripeSubscriptionId)
          throw new SettingsError(
            "La facturation n’est pas encore activée pour ce projet.",
          );
        const current = await getPolarSubscription(project.stripeSubscriptionId);
        const metadataProject = current.metadata?.projectId;
        if (
          current.customer_id !== project.stripeCustomerId ||
          (typeof metadataProject === "string" && metadataProject !== project.id)
        )
          throw new SettingsError("L’abonnement n’a pas pu être vérifié.");
        if (!["active", "trialing"].includes(current.status))
          throw new SettingsError(
            "Régularisez ou renouvelez l’abonnement avant de changer d’offre.",
          );
        if (current.cancel_at_period_end)
          throw new SettingsError(
            "Réactivez l’abonnement avant de changer d’offre.",
          );
        const from = planFromProduct(current.product_id);
        if (!from) throw new SettingsError("L’abonnement n’a pas pu être vérifié.");
        const holder = current.customer?.email;
        if (!holder || !(await holderManagesBilling(tx, project.id, holder)))
          throw new SettingsError(
            `Ce projet est payé par ${holder ? maskEmail(holder) : "un autre compte"}, qui n’en gère plus la facturation. Contactez le support pour reprendre le paiement à votre nom.`,
          );

        const pending = planFromProduct(current.pending_update?.product_id);
        const target = pricingPlan(plan);
        if (plan === from) {
          if (!pending) throw new SettingsError("C’est déjà l’offre de ce projet.");
          await clearPolarPendingUpdate(current.id);
          await audit(tx, project, user.id, "billing.plan_change_cancelled");
          return {
            message: `Changement annulé : le projet garde l’offre ${target.name}.`,
            synced: null,
          };
        }
        // Idempotent : le même changement déjà programmé ne repart pas.
        if (pending === plan)
          return {
            message: `Le passage à l’offre ${target.name} est déjà prévu au prochain renouvellement.`,
            synced: null,
          };
        const productId = polarProductId(plan);
        if (!productId || !matchesPolarProduct(await getPolarProduct(productId), plan))
          throw new SettingsError(UNAVAILABLE);
        if (planRank(plan) < planRank(from)) {
          const members = await tx.projectMembership.count({
            where: { projectId: project.id },
          });
          if (members > teamSeats(plan))
            throw new SettingsError(
              `L’équipe compte ${members} utilisateurs et l’offre ${target.name} en comprend ${teamSeats(plan)}. Retirez des membres avant de changer d’offre.`,
            );
        }
        const change = planChange(current.status, from, plan)!;
        const updated = await changePolarSubscriptionProduct(
          current.id,
          productId,
          change.proration,
        );
        await audit(tx, project, user.id, `billing.plan_changed.${from}.${plan}`);
        return {
          message:
            change.kind === "upgrade"
              ? `Offre ${target.name} activée. La différence au prorata est prélevée maintenant.`
              : change.kind === "downgrade"
                ? `Passage à l’offre ${target.name} prévu au prochain renouvellement.`
                : `Offre ${target.name} choisie : elle démarrera à la fin de l’essai.`,
          synced: {
            subscription: updated,
            watermark: project.billingEventCreated,
            revision: project.billingRevision,
          },
        };
      },
      { maxWait: 5_000, timeout: 30_000 },
    );
    // Effet immédiat à l'écran ; le webhook Polar reste la source de vérité.
    if (result.synced)
      await syncPolarSubscription(
        prisma,
        result.synced.subscription,
        result.synced.watermark,
        projectId,
        result.synced.revision,
      ).catch((error) =>
        console.error("[billing] Synchronisation après changement d’offre différée.", error),
      );
    revalidatePath(`/projects/${projectId}`, "layout");
    revalidatePath("/projects");
    return { success: true as const, message: result.message };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}

/**
 * Recharge de messages au tarif de l'offre du projet : paiement unique chez
 * Polar. Rien n'est crédité ici ; seul le webhook, après relecture de la
 * commande payée, crédite le projet.
 */
export async function buyMessageCredit(projectId: unknown) {
  try {
    const id = ProjectId.parse(projectId);
    const user = await currentUser();
    const { project } = await prisma.$transaction((tx) =>
      requireProjectPermission(tx, id, user.id, "billing.manage"),
    );
    if (project.deletionPending)
      throw new SettingsError("Ce projet est en cours de suppression.");
    if (project.internal || !project.stripeSubscriptionId)
      throw new SettingsError("La facturation n’est pas encore activée pour ce projet.");
    const paid =
      project.status === "active" ||
      (project.automationPaused &&
        project.status === "paused" &&
        project.statusBeforePause === "active");
    if (!paid)
      throw new SettingsError(
        project.status === "trialing"
          ? "Les messages supplémentaires s’achètent après l’essai."
          : "Régularisez ou renouvelez l’abonnement avant d’acheter des messages.",
      );
    const plan = resolvePlanId(project.plan);
    if (project.extraCredit + creditPackUnits(plan) > MAX_CREDIT_PACKS * creditPackUnits(plan))
      throw new SettingsError("Votre crédit de messages est déjà au maximum.");
    const productId = polarCreditProductId(plan);
    if (!productId || !matchesPolarCreditProduct(await getPolarProduct(productId), plan))
      throw new SettingsError(UNAVAILABLE);
    const origin = process.env.NEXT_PUBLIC_APP_URL;
    if (!origin || !user.email) throw new SettingsError("Le paiement n’est pas configuré.");
    const billingUrl = `${origin}/projects/${project.id}/billing`;
    const url = await createPolarCreditCheckout({
      productId,
      projectId: project.id,
      plan,
      email: user.email,
      successUrl: `${billingUrl}?recharge=ok`,
      returnUrl: billingUrl,
    });
    await audit(prisma, project, user.id, `billing.credit_checkout.${plan}`);
    return { success: true as const, url };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}

/**
 * Relance le premier prélèvement d'un essai épuisé (carte refusée et mise à
 * jour, ou demande en échec). Rien n'est prélevé ici : la demande est remise au
 * worker de facturation, seul à appeler Polar, qui relit l'abonnement avant
 * d'agir. Double clic ou deux onglets : un seul passage, sous verrou.
 */
export async function retryTrialActivation(projectId: unknown) {
  try {
    const id = ProjectId.parse(projectId);
    const user = await currentUser();
    if (!allowRequest(`trial-activation:${user.id}`, 5, 10 * 60_000))
      throw new SettingsError("Trop de relances. Réessayez dans quelques minutes.");
    await prisma.$transaction(async (tx) => {
      const { project } = await requireProjectPermission(tx, id, user.id, "billing.manage");
      if (project.deletionPending)
        throw new SettingsError("Ce projet est en cours de suppression.");
      if (project.internal || !project.stripeSubscriptionId)
        throw new SettingsError("La facturation n’est pas encore activée pour ce projet.");
      const [period] = await tx.$queryRaw<{ id: string; ready: boolean }[]>`
        SELECT id, "updatedAt" <= clock_timestamp()
          - (${TRIAL_END_MANUAL_RETRY_SECONDS}::int * interval '1 second') AS ready
        FROM quota_period
        WHERE "projectId" = ${project.id} AND "isCurrent" AND kind = 'trialing'
          AND "endsOnQuota" AND used >= "limit"
          AND key = ${`trial:${project.stripeSubscriptionId}`}
          AND "trialEndStatus" IN ('PAYMENT_FAILED', 'FAILED')
        FOR UPDATE`;
      if (!period)
        throw new SettingsError("Aucun paiement d’essai n’est à relancer pour ce projet.");
      if (!period.ready)
        throw new SettingsError("Patientez une minute avant de relancer le paiement.");
      await tx.$executeRaw`UPDATE quota_period SET "trialEndStatus" = 'PENDING',
        "trialEndDueAt" = clock_timestamp(), "trialEndAttempts" = 0,
        "updatedAt" = clock_timestamp()
        WHERE id = ${period.id}`;
      await audit(tx, project, user.id, "billing.trial_activation_retry");
    });
    revalidatePath(`/projects/${id}/billing`);
    return {
      success: true as const,
      message: "Paiement relancé : la page se met à jour dès sa confirmation.",
    };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}

async function audit(
  tx: Prisma.TransactionClient,
  project: { id: string; settingsVersion: number },
  actorId: string,
  action: string,
) {
  await tx.settingsAudit.create({
    data: { projectId: project.id, actorId, action, version: project.settingsVersion },
  });
}

/**
 * Moyen de paiement : le portail Polar couvre tout le compte client (toutes
 * ses cartes et tous ses abonnements). Il ne s'ouvre donc qu'au titulaire
 * lui-même, directement sur ses réglages de paiement, jamais à un autre membre.
 */
export async function openProjectPaymentSettings(projectId: string) {
  try {
    ProjectId.parse(projectId);
    const user = await currentUser();
    const { project } = await prisma.$transaction((tx) =>
      requireProjectPermission(tx, projectId, user.id, "billing.manage"),
    );
    if (project.deletionPending)
      throw new SettingsError("Ce projet est en cours de suppression.");
    if (project.internal || !project.stripeCustomerId)
      throw new SettingsError("La facturation n’est pas encore activée pour ce projet.");
    const origin = process.env.NEXT_PUBLIC_APP_URL;
    if (!origin) throw new SettingsError("Le paiement n’est pas configuré.");
    const customer = await getPolarCustomer(project.stripeCustomerId);
    if (customer.id !== project.stripeCustomerId)
      throw new SettingsError("Le moyen de paiement n’a pas pu être vérifié.");
    if (!user.emailVerified || !isPaymentHolder(user.email, customer.email))
      throw new SettingsError(
        `Seul le titulaire du moyen de paiement (${maskEmail(customer.email)}) peut le modifier, depuis son propre compte.`,
      );
    const url = await createPolarPortalUrl(
      customer.id,
      `${origin}/projects/${project.id}/billing#paiement`,
      "payment",
    );
    return { success: true as const, url };
  } catch (error) {
    return { success: false as const, error: publicError(error) };
  }
}
