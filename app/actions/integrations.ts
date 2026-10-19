"use server";

import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { PlanFeatureError } from "@/lib/plan-features";
import { SettingsError } from "@/lib/project-settings";
import { INTEGRATION_EVENT_IDS } from "@/lib/integration-events";
import {
  IntegrationError,
  WebhookInputSchema,
  createWebhook,
  deleteEndpoint,
  redeliver,
  rotateWebhookSecret,
  sendTestEvent,
  updateEndpoint,
} from "@/lib/integrations";
import { revokeGoogleToken } from "@/lib/google-sheets";

type Failure = { success: false; error: string };

const Project = z.object({ projectId: z.string().cuid() });
const CreateSchema = Project.extend(WebhookInputSchema.shape);
const EndpointTarget = Project.extend({ endpointId: z.string().min(1).max(100) });
const UpdateSchema = EndpointTarget.extend({
  events: z.array(z.enum(INTEGRATION_EVENT_IDS)).min(1, "Choisissez au moins un événement.").optional(),
  enabled: z.boolean().optional(),
});
const DeliveryTarget = Project.extend({ deliveryId: z.string().cuid() });

async function run<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  label: string,
  action: (data: z.infer<S>, userId: string) => Promise<T>,
): Promise<({ success: true } & T) | Failure> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Demande invalide." };
  }
  const session = await getSession();
  if (!session?.user?.id) return { success: false, error: "Connexion requise." };
  try {
    return { success: true, ...(await action(parsed.data, session.user.id)) };
  } catch (error) {
    if (
      error instanceof IntegrationError ||
      error instanceof SettingsError ||
      error instanceof PlanFeatureError
    ) {
      return { success: false, error: error.message };
    }
    console.error(`[integrations] Échec : ${label}.`);
    return { success: false, error: `Impossible de ${label}. Réessayez.` };
  }
}

export async function createWebhookAction(input: z.input<typeof CreateSchema>) {
  return run(CreateSchema, input, "créer le webhook", async (data, userId) =>
    createWebhook(prisma, { ...data, userId }),
  );
}

export async function updateEndpointAction(input: z.input<typeof UpdateSchema>) {
  return run(UpdateSchema, input, "modifier l’intégration", async (data, userId) => {
    await updateEndpoint(prisma, { ...data, userId });
    return {};
  });
}

export async function rotateWebhookSecretAction(input: z.input<typeof EndpointTarget>) {
  return run(EndpointTarget, input, "régénérer le secret", async (data, userId) =>
    rotateWebhookSecret(prisma, { ...data, userId }),
  );
}

export async function deleteEndpointAction(input: z.input<typeof EndpointTarget>) {
  return run(EndpointTarget, input, "supprimer l’intégration", async (data, userId) => {
    await deleteEndpoint(prisma, { ...data, userId }, revokeGoogleToken);
    return {};
  });
}

export async function sendTestEventAction(input: z.input<typeof EndpointTarget>) {
  return run(EndpointTarget, input, "envoyer le test", async (data, userId) => {
    await sendTestEvent(prisma, { ...data, userId });
    return {};
  });
}

export async function redeliverAction(input: z.input<typeof DeliveryTarget>) {
  return run(DeliveryTarget, input, "relancer l’envoi", async (data, userId) => {
    await redeliver(prisma, { ...data, userId });
    return {};
  });
}
