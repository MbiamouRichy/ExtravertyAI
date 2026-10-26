"use server";

import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { notifyChatChanged } from "@/lib/chat-realtime";
import { PlanFeatureError } from "@/lib/plan-features";
import { SettingsError } from "@/lib/project-settings";
import {
  CurrencySchema,
  MAX_DEAL_VALUE,
  PipelineError,
  PipelineStageSchema,
  movePipelineStage,
  setDealValue,
  setProjectCurrency,
} from "@/lib/pipeline";

type Failure = { success: false; error: string };

const Target = z.object({
  projectId: z.string().cuid(),
  contactId: z.string().cuid(),
});
const MoveSchema = Target.extend({ stage: PipelineStageSchema });
const ValueSchema = Target.extend({
  value: z.number().int().min(0).max(MAX_DEAL_VALUE).nullable(),
});
const CurrencyInput = z.object({
  projectId: z.string().cuid(),
  currency: CurrencySchema,
});

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
    const result = await action(parsed.data, session.user.id);
    await notifyChatChanged((parsed.data as { projectId: string }).projectId);
    return { success: true, ...result };
  } catch (error) {
    if (
      error instanceof PipelineError ||
      error instanceof PlanFeatureError ||
      error instanceof SettingsError
    ) {
      return { success: false, error: error.message };
    }
    console.error(`[pipeline] Échec : ${label}.`);
    return { success: false, error: `Impossible de ${label}. Réessayez.` };
  }
}

export async function movePipelineStageAction(input: z.input<typeof MoveSchema>) {
  return run(MoveSchema, input, "déplacer le prospect", async (data, userId) => {
    const { changed } = await movePipelineStage(prisma, { ...data, userId });
    return { changed };
  });
}

export async function setDealValueAction(input: z.input<typeof ValueSchema>) {
  return run(ValueSchema, input, "enregistrer le montant", async (data, userId) => {
    await setDealValue(prisma, { ...data, userId });
    return {};
  });
}

export async function setProjectCurrencyAction(input: z.input<typeof CurrencyInput>) {
  return run(CurrencyInput, input, "changer la devise", async (data, userId) => {
    await setProjectCurrency(prisma, { ...data, userId });
    return {};
  });
}
