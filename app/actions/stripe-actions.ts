"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { stripe } from "@/lib/stripe";
import { checkoutProvider } from "@/lib/billing-provider";
import {
  matchesCheckoutPrice,
  matchesPolarProduct,
} from "@/lib/checkout-price";
import {
  createPolarCheckout,
  getPolarProduct,
  polarProductId,
} from "@/lib/polar";
import {
  ProjectCheckoutSchema,
  type ProjectCheckoutInput,
} from "@/lib/project-creation-schema";
import z from "zod";
import { allowRequest } from "@/lib/rate-limit";
import { can } from "@/lib/project-permissions";
import { resolvePlanId, type PlanId } from "@/lib/pricing";
import { needsInitialCheckout } from "@/lib/billing-display";
import { isTrialAvailable, reserveTrial } from "@/lib/trial-eligibility";
import { getBrowserTimeZone } from "@/lib/server-time-zone";
import {
  createEvolutionInstance,
  deleteEvolutionInstance,
} from "./evolutionAPI";

const STRIPE_PRICE_MAPPING: Record<
  "starter" | "business" | "pro",
  string | undefined
> = {
  starter: process.env.STRIPE_STARTER_PLAN_ID,
  business: process.env.STRIPE_BUSINESS_PLAN_ID,
  pro: process.env.STRIPE_PRO_PLAN_ID,
};

const EMAIL_NOT_VERIFIED_ERROR =
  "Confirmez votre adresse e-mail avant de créer un projet.";
const TRIAL_UNAVAILABLE_ERROR =
  "Ce numéro WhatsApp a déjà bénéficié de l’essai gratuit.";

/** Le client confirme explicitement un paiement sans essai. */
const CheckoutOptionsSchema = z
  .object({ withoutTrial: z.boolean().optional() })
  .optional();

class TrialTakenError extends Error {}

const PROJECTS_PER_HOUR = 5;

export async function createProjectAndCheckout(
  data: ProjectCheckoutInput,
  options?: { withoutTrial?: boolean },
) {
  const session = await getSession();
  if (!session?.user?.id || !session?.user?.email) {
    throw new Error("Session expirée ou non autorisée.");
  }
  // Un essai gratuit suppose une adresse dont on a prouvé la possession.
  if (session.user.emailVerified !== true)
    return {
      success: false as const,
      code: "EMAIL_NOT_VERIFIED" as const,
      error: EMAIL_NOT_VERIFIED_ERROR,
    };
  const withoutTrial =
    CheckoutOptionsSchema.safeParse(options).data?.withoutTrial === true;
  // Chaque création ouvre une instance WhatsApp et peut réserver l’essai d’un
  // numéro : limite durable en base, et rafale bloquée sur cette instance.
  const recentProjects = await prisma.projectMembership.count({
    where: {
      userId: session.user.id,
      role: "OWNER",
      createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
    },
  });
  if (recentProjects >= PROJECTS_PER_HOUR)
    return {
      success: false as const,
      error: "Trop de projets créés récemment. Réessayez dans une heure.",
    };
  if (!allowRequest(`project-create:${session.user.id}`, 3, 60 * 1000))
    return {
      success: false as const,
      error: "Trop de tentatives. Réessayez dans une minute.",
    };

  const parsed = ProjectCheckoutSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Vérifiez le nom du projet, le numéro WhatsApp et le forfait.",
    };
  }
  data = parsed.data;
  const cleanedNumero = parsed.data.numero;

  if (!checkoutReference(data.plan)) {
    // Variable d'environnement absente : à corriger côté hébergement, pas par le client.
    console.error("CHECKOUT_REFERENCE_MISSING", checkoutProvider(), data.plan);
    return {
      success: false,
      error:
        "Ce forfait n’est pas encore disponible au paiement. Réessayez plus tard ou choisissez une autre offre.",
    };
  }

  // Check before creating a project or an external WhatsApp instance.
  try {
    if (!(await isCheckoutPriceCurrent(data.plan))) {
      return {
        success: false,
        error:
          "Ce forfait est temporairement indisponible. Son tarif de paiement est en cours de mise à jour.",
      };
    }
  } catch {
    return {
      success: false,
      error:
        "Le tarif n’a pas pu être vérifié. Réessayez dans quelques instants.",
    };
  }

  const existingProject = await prisma.project.findFirst({
    where: {
      numero: cleanedNumero,
      members: { some: { userId: session.user.id } },
    },
  });

  if (existingProject) {
    return {
      success: false,
      error: existingProject.stripeSubscriptionId
        ? "Ce numéro WhatsApp est déjà configuré sur l'un de vos projets."
        : `Ce numéro est déjà associé au projet « ${existingProject.name} », dont le paiement n’est pas terminé. Ouvrez sa facturation pour reprendre le paiement.`,
    };
  }

  // Lecture avant toute création externe ; la réservation atomique suit.
  const trial = await isTrialAvailable(prisma, cleanedNumero);
  if (!trial && !withoutTrial)
    return {
      success: false as const,
      code: "TRIAL_UNAVAILABLE" as const,
      error: TRIAL_UNAVAILABLE_ERROR,
    };

  const uniqueId = Math.random().toString(36).substring(2, 7);
  const instanceName = `ext_${Date.now()}_${uniqueId}`;

  // 🔒 SÉCURITÉ : Génération d'un token secret unique pour vérifier les webhooks Evolution API
  const instanceToken = crypto.randomBytes(32).toString("hex");

  let isInstanceCreated = false;
  let createdProjectId: string | null = null;
  // The creator usually works where the business is: their browser's zone is
  // the best first guess (broadcast hours), editable later in the settings.
  const timeZone = (await getBrowserTimeZone()) ?? undefined;

  try {
    // Si votre fonction d'API accepte le token, vous pouvez lui passer instanceToken
    await createEvolutionInstance(instanceName, cleanedNumero);
    isInstanceCreated = true;

    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          name: data.name,
          numero: cleanedNumero,
          instanceName: instanceName,
          instanceToken: instanceToken, // Ajout selon le nouveau schéma
          instanceStatus: "connecting",
          plan: data.plan,
          status: "inactive",
          timeZone,
          members: {
            create: {
              userId: session.user.id,
              role: "OWNER",
            },
          },
        },
      });
      // Deux comptes sur le même numéro : un seul obtient l’essai.
      if (trial && !(await reserveTrial(tx, cleanedNumero, created.id)))
        throw new TrialTakenError();
      return created;
    });
    createdProjectId = project.id;

    const url = await createCheckoutUrl({
      projectId: project.id,
      plan: data.plan,
      email: session.user.email,
      cancelPath: `/projects/new?plan=${data.plan}&canceled=true`,
      trial,
    });

    revalidatePath("/projects");

    return { success: true, url };
  } catch (error) {
    const trialTaken = error instanceof TrialTakenError;
    if (!trialTaken)
      console.error("❌ Échec de la création (Rollback) :", error);

    if (createdProjectId) {
      try {
        await prisma.project.delete({ where: { id: createdProjectId } });
      } catch (dbError) {
        console.error("CRITIQUE: Échec de suppression du projet", dbError);
      }
    }

    if (isInstanceCreated) {
      try {
        await deleteEvolutionInstance(instanceName);
      } catch (apiError) {
        console.error("CRITIQUE: Échec de suppression de l'instance", apiError);
      }
    }

    if (trialTaken)
      return {
        success: false as const,
        code: "TRIAL_UNAVAILABLE" as const,
        error: TRIAL_UNAVAILABLE_ERROR,
      };
    return {
      success: false,
      error:
        "Une erreur critique est survenue lors de l'initialisation de votre projet. Veuillez réessayer.",
    };
  }
}

/** Prix Stripe ou produit Polar du forfait, selon le fournisseur actif. */
function checkoutReference(plan: PlanId) {
  return checkoutProvider() === "polar"
    ? polarProductId(plan)
    : STRIPE_PRICE_MAPPING[plan];
}

async function isCheckoutPriceCurrent(plan: PlanId) {
  const reference = checkoutReference(plan)!;
  return checkoutProvider() === "polar"
    ? matchesPolarProduct(await getPolarProduct(reference), plan)
    : matchesCheckoutPrice(await stripe.prices.retrieve(reference), plan);
}

/** Paiement d'abonnement, avec ou sans essai de 10 jours, pour un projet existant. */
async function createCheckoutUrl(input: {
  projectId: string;
  plan: PlanId;
  email: string;
  cancelPath: string;
  /** Faux : le numéro a déjà eu son essai, le premier mois est payé tout de suite. */
  trial: boolean;
}) {
  const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (!origin) throw new Error("NEXT_PUBLIC_APP_URL manquant");
  const reference = checkoutReference(input.plan);
  if (!reference) throw new Error("Forfait non configuré");
  if (checkoutProvider() === "polar")
    return createPolarCheckout({
      productId: reference,
      projectId: input.projectId,
      plan: input.plan,
      email: input.email,
      successUrl: `${origin}/projects/${input.projectId}?success=true`,
      returnUrl: `${origin}${input.cancelPath}`,
      trial: input.trial,
    });
  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    mode: "subscription",
    customer_email: input.email,
    line_items: [{ price: reference, quantity: 1 }],
    payment_method_collection: "always",
    metadata: { projectId: input.projectId },
    subscription_data: {
      metadata: { projectId: input.projectId },
      ...(input.trial ? { trial_period_days: 10 } : {}),
    },
    // La session ne doit pas survivre à la réservation de l'essai.
    ...(input.trial
      ? { expires_at: Math.floor(Date.now() / 1000) + 60 * 60 }
      : {}),
    success_url: `${origin}/projects/${input.projectId}?success=true`,
    cancel_url: `${origin}${input.cancelPath}`,
  });
  if (!checkoutSession.url) throw new Error("URL Stripe non générée");
  return checkoutSession.url;
}

const ResumeSchema = z.object({
  projectId: z.string().cuid(),
  withoutTrial: z.boolean().optional(),
});

/**
 * Reprend le paiement d'un projet dont le Checkout n'a pas abouti (onglet
 * fermé, carte refusée). Réservé au propriétaire et au rôle Facturation, tant
 * qu'aucun client ni abonnement Stripe n'est rattaché au projet.
 */
export async function resumeProjectCheckout(
  input: z.input<typeof ResumeSchema>,
) {
  const parsed = ResumeSchema.safeParse(input);
  if (!parsed.success)
    return { success: false as const, error: "Demande invalide." };
  const session = await getSession();
  if (!session?.user?.id || !session.user.email)
    return { success: false as const, error: "Connexion requise." };
  if (session.user.emailVerified !== true)
    return {
      success: false as const,
      code: "EMAIL_NOT_VERIFIED" as const,
      error: EMAIL_NOT_VERIFIED_ERROR,
    };
  const { projectId, withoutTrial } = parsed.data;
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
    select: {
      role: true,
      project: {
        select: {
          plan: true,
          numero: true,
          status: true,
          deletionPending: true,
          stripeCustomerId: true,
          stripeSubscriptionId: true,
        },
      },
    },
  });
  if (!membership || !can(membership.role, "billing.manage"))
    return {
      success: false as const,
      error: "Vous n’avez pas les droits nécessaires sur ce projet.",
    };
  const { project } = membership;
  if (project.deletionPending)
    return {
      success: false as const,
      error: "Ce projet est en cours de suppression.",
    };
  if (!needsInitialCheckout(project))
    return {
      success: false as const,
      error:
        "Ce projet a déjà un abonnement : utilisez « Gérer l’abonnement ».",
    };
  // Chaque appel ouvre une session de paiement : pas de rafale.
  if (!allowRequest(`checkout-resume:${projectId}`, 5, 10 * 60 * 1000))
    return {
      success: false as const,
      error: "Trop de tentatives. Réessayez dans quelques minutes.",
    };
  const plan = resolvePlanId(project.plan);
  if (!checkoutReference(plan))
    return {
      success: false as const,
      error: "Ce forfait est temporairement indisponible.",
    };
  try {
    if (!(await isCheckoutPriceCurrent(plan)))
      return {
        success: false as const,
        error:
          "Ce forfait est temporairement indisponible. Son tarif de paiement est en cours de mise à jour.",
      };
    // Réservé à nouveau à chaque reprise : un autre projet a pu l'obtenir.
    const trial = await reserveTrial(prisma, project.numero, projectId);
    if (!trial && !withoutTrial)
      return {
        success: false as const,
        code: "TRIAL_UNAVAILABLE" as const,
        error: TRIAL_UNAVAILABLE_ERROR,
      };
    const url = await createCheckoutUrl({
      projectId,
      plan,
      email: session.user.email,
      cancelPath: `/projects/${projectId}/billing?canceled=true`,
      trial,
    });
    return { success: true as const, url };
  } catch {
    console.error("[billing] Reprise du paiement impossible.");
    return {
      success: false as const,
      error:
        "Le paiement n’a pas pu être préparé. Réessayez dans quelques instants.",
    };
  }
}
