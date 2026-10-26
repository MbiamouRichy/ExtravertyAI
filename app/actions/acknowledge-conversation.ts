"use server";

import { z } from "zod";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { markConversationRead } from "@/lib/conversation-reads";

const schema = z.object({
  projectId: z.string().cuid(),
  contactId: z.string().cuid(),
  messageId: z.string().min(1).max(200),
});

export async function acknowledgeConversation(input: unknown) {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false };
  try {
    const session = await getSession();
    if (!session?.user?.id) return { success: false };
    const { projectId, contactId, messageId } = parsed.data;
    // Authorization is part of the atomic SQL statement, not a client claim.
    await markConversationRead(
      prisma,
      projectId,
      session.user.id,
      contactId,
      messageId,
    );
    return { success: true };
  } catch {
    return { success: false };
  }
}
