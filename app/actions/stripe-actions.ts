"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { stripe } from "@/lib/stripe";
import { matchesCheckoutPrice } from "@/lib/checkout-price";
import {
  ProjectCheckoutSchema,
  type ProjectCheckoutInput,
} from "@/lib/project-creation-schema";
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

export async function createProjectAndCheckout(data: ProjectCheckoutInput) {
  const session = await getSession();
  if (!session?.user?.id || !session?.user?.email) {
    throw new Error("Session expirée ou non autorisée.");
  }

  const parsed = ProjectCheckoutSchema.safeParse(data);
  if (!parsed.success) {
    return {
      success: false,
      error: "Vérifiez le nom du projet, le numéro WhatsApp et le forfait.",
    };
  }
  data = parsed.data;
  const cleanedNumero = parsed.data.numero;

  const priceId = STRIPE_PRICE_MAPPING[data.plan];
  if (!priceId) {
    throw new Error(
      "Le plan sélectionné est invalide ou mal configuré côté serveur.",
    );
  }

  // Check before creating a project or an external WhatsApp instance.
  try {
    const price = await stripe.prices.retrieve(priceId);
    if (!matchesCheckoutPrice(price, data.plan)) {
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
    throw new Error(
      "Ce numéro WhatsApp est déjà configuré sur l'un de vos projets.",
    );
  }

  const uniqueId = Math.random().toString(36).substring(2, 7);
  const instanceName = `ext_${Date.now()}_${uniqueId}`;

  // 🔒 SÉCURITÉ : Génération d'un token secret unique pour vérifier les webhooks Evolution API
  const instanceToken = crypto.randomBytes(32).toString("hex");

  let isInstanceCreated = false;
  let createdProjectId: string | null = null;

  try {
    // Si votre fonction d'API accepte le token, vous pouvez lui passer instanceToken
    await createEvolutionInstance(instanceName, cleanedNumero);
    isInstanceCreated = true;

    const project = await prisma.project.create({
      data: {
        name: data.name,
        numero: cleanedNumero,
        instanceName: instanceName,
        instanceToken: instanceToken, // Ajout selon le nouveau schéma
        instanceStatus: "connecting",
        plan: data.plan,
        status: "inactive",
        members: {
          create: {
            userId: session.user.id,
            role: "OWNER",
          },
        },
      },
    });
    createdProjectId = project.id;

    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: session.user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      payment_method_collection: "always",
      metadata: {
        projectId: project.id,
      },
      subscription_data: {
        metadata: {
          projectId: project.id,
        },
        trial_period_days: 10,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/projects/${project.id}?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/projects/new?plan=${data.plan}&canceled=true`,
    });

    if (!checkoutSession.url) throw new Error("URL Stripe non générée");

    revalidatePath("/projects");

    return { success: true, url: checkoutSession.url };
  } catch (error) {
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

    return {
      success: false,
      error:
        "Une erreur critique est survenue lors de l'initialisation de votre projet. Veuillez réessayer.",
    };
  }
}
