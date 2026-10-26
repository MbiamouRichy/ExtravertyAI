"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { notifyChatChanged } from "@/lib/chat-realtime";
import { mediaKind } from "@/lib/chat-media";
import { verifyMediaTicket } from "@/lib/chat-media-server";
import { AudienceSchema, BroadcastDraftSchema, RECIPIENT_FILTER_IDS } from "@/lib/broadcast-shared";
import { allowRequest } from "@/lib/rate-limit";
import {
  BroadcastError,
  cancelBroadcast,
  createBroadcast,
  estimateAudience,
  listOptedOut,
  listRecipients,
  listReplies,
  pauseBroadcast,
  resumeBroadcast,
} from "@/lib/broadcasts";

type Result<T = object> = ({ success: true } & T) | { success: false; error: string };

const ProjectId = z.string().cuid();

const EstimateSchema = z.object({ projectId: ProjectId, audience: AudienceSchema });

const CreateSchema = BroadcastDraftSchema.extend({
  projectId: ProjectId,
  requestId: z.string().uuid(),
  audience: AudienceSchema,
  scheduledAt: z.string().datetime({ offset: true }).nullable(),
  attachment: z.object({ token: z.string().min(1).max(4000) }).nullable(),
});

const TargetSchema = z.object({ projectId: ProjectId, broadcastId: z.string().cuid() });

const RecipientsSchema = TargetSchema.extend({
  filter: z.enum(RECIPIENT_FILTER_IDS),
  query: z.string().max(60).default(""),
  cursor: z.string().cuid().nullable().default(null),
});
const RepliesSchema = TargetSchema.extend({ cursor: z.string().max(200).nullable().default(null) });
const OptOutSchema = z.object({ projectId: ProjectId, cursor: z.string().cuid().nullable().default(null) });

// Validation, session and safe errors shared by every broadcast action.
async function run<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  label: string,
  action: (data: z.infer<S>, userId: string) => Promise<T>,
): Promise<Result<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Demande invalide." };
  }
  const session = await getSession();
  if (!session?.user?.id) return { success: false, error: "Connexion requise." };
  try {
    return { success: true, ...(await action(parsed.data, session.user.id)) };
  } catch (error) {
    if (error instanceof BroadcastError) return { success: false, error: error.message };
    console.error(`[broadcast] Échec : ${label}.`);
    return { success: false, error: "Action impossible pour le moment. Réessayez." };
  }
}

async function refresh(projectId: string) {
  revalidatePath(`/projects/${projectId}/broadcasts`);
  await notifyChatChanged(projectId).catch(() => undefined);
}

export async function estimateAudienceAction(input: z.input<typeof EstimateSchema>) {
  return run(EstimateSchema, input, "estimation de l’audience", (data, userId) => {
    // Counting an audience is costly: a burst of requests is refused.
    if (!allowRequest(`broadcast-estimate:${userId}`, 40, 60_000)) {
      throw new BroadcastError("Trop de calculs d’audience en peu de temps. Patientez quelques secondes.");
    }
    return estimateAudience(prisma, { ...data, userId });
  });
}

/** Recipients, searched by name through the request body: names never end up in URLs. */
export async function listRecipientsAction(input: z.input<typeof RecipientsSchema>) {
  return run(RecipientsSchema, input, "liste des destinataires", (data, userId) =>
    listRecipients(prisma, { ...data, userId }),
  );
}

export async function listRepliesAction(input: z.input<typeof RepliesSchema>) {
  return run(RepliesSchema, input, "liste des réponses", (data, userId) =>
    listReplies(prisma, { ...data, userId }),
  );
}

export async function listOptedOutAction(input: z.input<typeof OptOutSchema>) {
  return run(OptOutSchema, input, "liste des désinscrits", (data, userId) =>
    listOptedOut(prisma, { ...data, userId }),
  );
}

export async function createBroadcastAction(input: z.input<typeof CreateSchema>) {
  return run(CreateSchema, input, "création", async (data, userId) => {
    let media: { key: string; type: "IMAGE" } | null = null;
    if (data.attachment) {
      try {
        const ticket = verifyMediaTicket(data.attachment.token, data.projectId, userId, data.requestId);
        if (mediaKind(ticket.mime) !== "IMAGE") throw new Error("MEDIA_TYPE");
        media = { key: ticket.key, type: "IMAGE" };
      } catch {
        throw new BroadcastError("Image invalide ou expirée. Importez-la à nouveau.");
      }
    }
    const broadcast = await createBroadcast(prisma, {
      ...data,
      userId,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      media,
    });
    await refresh(data.projectId);
    return { broadcastId: broadcast.id };
  });
}

export async function pauseBroadcastAction(input: z.input<typeof TargetSchema>) {
  return run(TargetSchema, input, "mise en pause", async (data, userId) => {
    await pauseBroadcast(prisma, { ...data, userId });
    await refresh(data.projectId);
    return {};
  });
}

export async function resumeBroadcastAction(input: z.input<typeof TargetSchema>) {
  return run(TargetSchema, input, "reprise", async (data, userId) => {
    await resumeBroadcast(prisma, { ...data, userId });
    await refresh(data.projectId);
    return {};
  });
}

export async function cancelBroadcastAction(input: z.input<typeof TargetSchema>) {
  return run(TargetSchema, input, "annulation", async (data, userId) => {
    await cancelBroadcast(prisma, { ...data, userId });
    await refresh(data.projectId);
    return {};
  });
}
