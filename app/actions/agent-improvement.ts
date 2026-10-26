"use server";

import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { notifyChatChanged } from "@/lib/chat-realtime";
import { SettingsError } from "@/lib/project-settings";
import { SandboxError, SandboxInputSchema, runAgentTest } from "@/lib/agent-sandbox";
import {
  CorrectionSchema,
  FaqDraftSchema,
  FeedbackError,
  answerGap,
  dismissCorrection,
  dismissGap,
  promoteCorrection,
  rateAiMessage,
} from "@/lib/ai-feedback";

type Failure = { success: false; error: string };

const Project = z.object({ projectId: z.string().cuid() });
const RateSchema = Project.extend({
  messageId: z.string().cuid(),
  rating: z.enum(["UP", "DOWN"]),
  correction: CorrectionSchema.nullable().optional(),
});
const GapAnswerSchema = Project.extend({ gapId: z.string().cuid(), draft: FaqDraftSchema });
const GapTarget = Project.extend({ gapId: z.string().cuid() });
const PromoteSchema = Project.extend({ feedbackId: z.string().cuid(), draft: FaqDraftSchema });
const FeedbackTarget = Project.extend({ feedbackId: z.string().cuid() });

async function run<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  label: string,
  action: (data: z.infer<S>, userId: string) => Promise<T>,
  notify = true,
): Promise<({ success: true } & T) | Failure> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Demande invalide." };
  }
  const session = await getSession();
  if (!session?.user?.id) return { success: false, error: "Connexion requise." };
  try {
    const result = await action(parsed.data, session.user.id);
    if (notify) await notifyChatChanged((parsed.data as { projectId: string }).projectId);
    return { success: true, ...result };
  } catch (error) {
    if (
      error instanceof FeedbackError ||
      error instanceof SandboxError ||
      error instanceof SettingsError
    ) {
      return { success: false, error: error.message };
    }
    console.error(`[agent] Échec : ${label}.`);
    return { success: false, error: `Impossible de ${label}. Réessayez.` };
  }
}

export async function testAgentAction(input: z.input<typeof SandboxInputSchema>) {
  // Nothing is sent or stored in the conversation: no realtime event to emit.
  return run(
    SandboxInputSchema,
    input,
    "tester l’agent",
    async (data, userId) => runAgentTest(prisma, { ...data, userId }),
    false,
  );
}

export async function rateAiMessageAction(input: z.input<typeof RateSchema>) {
  return run(RateSchema, input, "enregistrer votre avis", async (data, userId) => ({
    feedback: await rateAiMessage(prisma, { ...data, userId }),
  }));
}

export async function answerGapAction(input: z.input<typeof GapAnswerSchema>) {
  return run(GapAnswerSchema, input, "enregistrer la réponse", async (data, userId) => {
    await answerGap(prisma, { ...data, userId });
    return {};
  });
}

export async function dismissGapAction(input: z.input<typeof GapTarget>) {
  return run(GapTarget, input, "ignorer la question", async (data, userId) => {
    await dismissGap(prisma, { ...data, userId });
    return {};
  });
}

export async function promoteCorrectionAction(input: z.input<typeof PromoteSchema>) {
  return run(PromoteSchema, input, "ajouter la correction", async (data, userId) => {
    await promoteCorrection(prisma, { ...data, userId });
    return {};
  });
}

export async function dismissCorrectionAction(input: z.input<typeof FeedbackTarget>) {
  return run(FeedbackTarget, input, "ignorer la correction", async (data, userId) => {
    await dismissCorrection(prisma, { ...data, userId });
    return {};
  });
}
