"use server";

import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { notifyChatChanged } from "@/lib/chat-realtime";
import {
  ConversationWorkflowError,
  addContactTag,
  createInternalNote,
  removeContactTag,
  setConversationResolved,
} from "@/lib/conversation-workflow";
import {
  InternalNoteContentSchema,
  TagNameSchema,
} from "@/lib/conversation-workflow-schema";
import type { ChatAgent } from "@/lib/chat";

type Failure = { success: false; error: string };

const Target = z.object({
  projectId: z.string().cuid(),
  contactId: z.string().cuid(),
});

const ResolveSchema = Target.extend({
  resolved: z.boolean(),
  seenMessageId: z.string().cuid().optional(),
});
const AddTagSchema = Target.extend({ name: TagNameSchema });
const RemoveTagSchema = Target.extend({ tagId: z.string().cuid() });
const NoteSchema = Target.extend({ content: InternalNoteContentSchema });

// Validation, session et gestion d'erreur communes à chaque action.
async function run<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  label: string,
  action: (data: z.infer<S>, userId: string) => Promise<T>,
): Promise<({ success: true } & T) | Failure> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Demande invalide.",
    };
  }
  const session = await getSession();
  if (!session?.user?.id) {
    return { success: false, error: "Connexion requise." };
  }
  try {
    const result = await action(parsed.data, session.user.id);
    await notifyChatChanged((parsed.data as { projectId: string }).projectId);
    return { success: true, ...result };
  } catch (error) {
    if (error instanceof ConversationWorkflowError) {
      return { success: false, error: error.message };
    }
    console.error(`[chat] Échec : ${label}.`);
    return { success: false, error: `Impossible de ${label}. Réessayez.` };
  }
}

export async function setConversationResolvedAction(
  input: z.input<typeof ResolveSchema>,
) {
  return run(
    ResolveSchema,
    input,
    "modifier la conversation",
    async (data, userId) => {
      const { resolvedAt } = await setConversationResolved(prisma, {
        ...data,
        userId,
      });
      return { resolvedAt: resolvedAt?.toISOString() ?? null };
    },
  );
}

export async function addContactTagAction(input: z.input<typeof AddTagSchema>) {
  return run(
    AddTagSchema,
    input,
    "ajouter l’étiquette",
    async (data, userId) => ({
      tag: await addContactTag(prisma, { ...data, userId }),
    }),
  );
}

export async function removeContactTagAction(
  input: z.input<typeof RemoveTagSchema>,
) {
  return run(
    RemoveTagSchema,
    input,
    "retirer l’étiquette",
    async (data, userId) => {
      await removeContactTag(prisma, { ...data, userId });
      return {};
    },
  );
}

export async function addInternalNoteAction(input: z.input<typeof NoteSchema>) {
  return run(NoteSchema, input, "ajouter la note", async (data, userId) => {
    const note = await createInternalNote(prisma, { ...data, userId });
    const agent: ChatAgent | null = note.author;
    return {
      note: {
        id: note.id,
        content: note.content,
        timestamp: note.createdAt.toISOString(),
        agent,
      },
    };
  });
}
