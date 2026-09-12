import { NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { getChatPusher } from "@/lib/chat-realtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AuthSchema = z.object({
  socketId: z
    .string()
    .regex(/^\d+\.\d+$/)
    .max(100),
  projectId: z.string().cuid(),
});

export async function POST(request: Request) {
  const session = await getSession();

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  const channel = form?.get("channel_name");
  const socketId = form?.get("socket_id");

  const prefix = "private-project-";

  if (typeof channel !== "string" || !channel.startsWith(prefix)) {
    return NextResponse.json({ error: "Canal invalide." }, { status: 400 });
  }

  const parsed = AuthSchema.safeParse({
    socketId,
    projectId: channel.slice(prefix.length),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Demande invalide." }, { status: 400 });
  }

  const membership = await prisma.projectMembership.findUnique({
    where: {
      userId_projectId: {
        userId: session.user.id,
        projectId: parsed.data.projectId,
      },
    },
    select: { userId: true },
  });

  if (!membership) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  try {
    const authorization = getChatPusher().authorizeChannel(
      parsed.data.socketId,
      channel,
    );

    return NextResponse.json(authorization, {
      headers: {
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Service temporairement indisponible." },
      { status: 503 },
    );
  }
}
