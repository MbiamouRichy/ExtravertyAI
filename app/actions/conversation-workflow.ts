"use server";

import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { notifyChatChanged } from "@/lib/chat-realtime";
import {
  ConversationWorkflowError,
  addContactTag,
  assignConversation,
  assignNextConversation,
  assignableMembers,
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
const AssignSchema = Target.extend({ assigneeId: z.string().min(1).max(200).nullable() });
const ProjectSchema = z.object({ projectId: z.string().cuid() });
const AssignNextSchema = ProjectSchema.extend({ assigneeId: z.string().min(1).max(200) });

/** Tableau d’équipe : confie la prochaine conversation en attente à un équipier. */
export async function assignNextConversationAction(
  input: z.input<typeof AssignNextSchema>,
) {
  return run(
    AssignNextSchema,
    input,
    "assigner une conversation",
    async (data, userId) => assignNextConversation(prisma, { ...data, userId }),
  );
}

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
      const { resolvedAt, surveySent } = await setConversationResolved(prisma, {
        ...data,
        userId,
      });
      return { resolvedAt: resolvedAt?.toISOString() ?? null, surveySent };
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

export async function assignConversationAction(
  input: z.input<typeof AssignSchema>,
) {
  return run(
    AssignSchema,
    input,
    "assigner la conversation",
    async (data, userId) => {
      const { assignee } = await assignConversation(prisma, { ...data, userId });
      const agent: ChatAgent | null = assignee;
      return { assignee: agent };
    },
  );
}

// Lecture seule : aucun événement temps réel à diffuser.
export async function listAssignableMembersAction(
  input: z.input<typeof ProjectSchema>,
): Promise<
  | { success: true; members: Array<ChatAgent & { role: string }> }
  | Failure
> {
  const parsed = ProjectSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Demande invalide." };
  const session = await getSession();
  if (!session?.user?.id) return { success: false, error: "Connexion requise." };
  try {
    const members = await assignableMembers(
      prisma,
      parsed.data.projectId,
      session.user.id,
    );
    if (!members.length) return { success: false, error: "Projet indisponible." };
    return { success: true, members };
  } catch {
    console.error("[chat] Échec : lister les membres.");
    return { success: false, error: "Impossible de charger l’équipe. Réessayez." };
  }
}
