"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

const revokeInput = z.discriminatedUnion("scope", [
  z.object({ scope: z.literal("all") }),
  z.object({
    scope: z.literal("one"),
    sessionId: z.string().trim().min(1).max(256),
  }),
]);

export async function disconnectSessions(input: z.infer<typeof revokeInput>) {
  const parsed = revokeInput.safeParse(input);
  if (!parsed.success) return { success: false, error: "Session invalide." };

  try {
    const requestHeaders = await headers();
    const current = await auth.api.getSession({ headers: requestHeaders });
    if (!current)
      return { success: false, error: "Veuillez vous reconnecter." };

    if (parsed.data.scope === "all") {
      await auth.api.revokeSessions({ headers: requestHeaders });
      return { success: true, signedOut: true };
    }

    // Resolve the token on the server and constrain the lookup to its owner.
    const target = await prisma.session.findFirst({
      where: { id: parsed.data.sessionId, userId: current.user.id },
      select: { token: true },
    });
    if (target) {
      await auth.api.revokeSession({
        headers: requestHeaders,
        body: { token: target.token },
      });
    }
    return {
      success: true,
      signedOut: parsed.data.sessionId === current.session.id,
    };
  } catch {
    return {
      success: false,
      error: "Impossible de déconnecter les sessions. Réessayez.",
    };
  }
}
