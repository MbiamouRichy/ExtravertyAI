"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { stripe } from "@/lib/stripe";
import {
  createEvolutionInstance,
  deleteEvolutionInstance,
} from "./evolutiomAPI";

// 🔒 SÉCURITÉ : Mapping des prix côté serveur.
// Le client n'envoie que "starter", "business" ou "pro".
// Impossible pour un hacker de falsifier le prix en envoyant un faux Price ID.
const STRIPE_PRICE_MAPPING: Record<
  "starter" | "business" | "pro",
  string | undefined
> = {
  starter: process.env.STRIPE_STARTER_PLAN_ID,
  business: process.env.STRIPE_BUSINESS_PLAN_ID,
  pro: process.env.STRIPE_PRO_PLAN_ID,
};

// Fonction pure de validation
function validateAndCleanNumero(numero: string): string {
  const cleaned = numero.replace(/[\s()\-]/g, "");
  const phoneRegex = /^\+?[1-9]\d{6,14}$/;

  if (!phoneRegex.test(cleaned)) {
    throw new Error(
      "Format de numéro invalide. Utilisez le format international.",
    );
  }
  return cleaned.startsWith("+") ? cleaned : `+${cleaned}`;
}

export async function createProjectAndCheckout(data: {
  name: string;
  numero: string;
  plan: "starter" | "business" | "pro";
}) {
  // ==========================================
  // 1. AUTHENTIFICATION & AUTORISATION
  // ==========================================
  const session = await getSession();
  if (!session?.user?.id || !session?.user?.email) {
    throw new Error("Session expirée ou non autorisée.");
  }

  // ==========================================
  // 2. VALIDATION DES ENTRÉES & RÉSOLUTION PRIX
  // ==========================================
  const cleanedNumero = validateAndCleanNumero(data.numero);

  const priceId = STRIPE_PRICE_MAPPING[data.plan];
  if (!priceId) {
    throw new Error(
      "Le plan sélectionné est invalide ou mal configuré côté serveur.",
    );
  }

  // Vérification de l'unicité (Isolation Multi-Tenant)
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

  // ==========================================
  // 3. INFRASTRUCTURE & IDENTIFIANTS
  // ==========================================
  const uniqueId = Math.random().toString(36).substring(2, 7);
  const instanceName = `ext_${Date.now()}_${uniqueId}`;

  // Variables pour suivre l'état et permettre le Rollback
  let isInstanceCreated = false;
  let createdProjectId: string | null = null;

  try {
    // ==========================================
    // 4. PROVISIONING (API Externe en premier)
    // ==========================================
    await createEvolutionInstance(instanceName, cleanedNumero);
    isInstanceCreated = true;

    // ==========================================
    // 5. TRANSACTION BASE DE DONNÉES
    // ==========================================
    const project = await prisma.project.create({
      data: {
        name: data.name,
        numero: cleanedNumero,
        instanceName: instanceName,
        instanceStatus: "connecting",
        plan: data.plan,
        status: "inactive", // 💡 Modifié : en attente du webhook Stripe
        members: {
          create: {
            userId: session.user.id,
            role: "OWNER",
          },
        },
      },
    });
    createdProjectId = project.id;

    // ==========================================
    // 6. GÉNÉRATION DE LA SESSION STRIPE
    // ==========================================
    const checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "subscription",
      customer_email: session.user.email,
      line_items: [{ price: priceId, quantity: 1 }],

      // Essai de 10 jours avec obligation de carte
      payment_method_collection: "always",
      metadata: {
        projectId: project.id, // Assure-toi que project.id contient bien l'ID de la BDD
      },
      subscription_data: {
        metadata: {
          projectId: project.id,
        },
        trial_period_days: 10,
      },

      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/projects/${project.id}?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/projects/new?canceled=true`,
    });

    if (!checkoutSession.url) throw new Error("URL Stripe non générée");

    // ==========================================
    // 7. INVALIDATION CACHE & SUCCÈS
    // ==========================================
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/projects");

    return { success: true, url: checkoutSession.url };
  } catch (error) {
    console.error(
      "❌ Échec de la création (Déclenchement du Rollback) :",
      error,
    );

    // ==========================================
    // 8. COMPENSATING TRANSACTIONS (ROLLBACKS)
    // ==========================================
    // Si ça pète à n'importe quelle étape après la création de l'instance, on nettoie.

    if (createdProjectId) {
      try {
        await prisma.project.delete({ where: { id: createdProjectId } });
      } catch (dbError) {
        console.error(
          "CRITIQUE: Échec de la suppression du projet orphelin",
          dbError,
        );
      }
    }

    if (isInstanceCreated) {
      try {
        // Tu dois créer cette fonction dans ton fichier evolutiomAPI.ts
        await deleteEvolutionInstance(instanceName);
      } catch (apiError) {
        console.error(
          "CRITIQUE: Échec de la suppression de l'instance orpheline",
          apiError,
        );
      }
    }

    // On renvoie une erreur générique au client pour ne pas fuiter l'architecture
    return {
      success: false,
      error:
        "Une erreur critique est survenue lors de l'initialisation de votre projet. Veuillez réessayer.",
    };
  }
}
