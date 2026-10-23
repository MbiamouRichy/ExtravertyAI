import { z } from "zod";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import {
  dismissNotifications,
  notificationFeed,
  readNotifications,
} from "@/lib/notifications";
export const dynamic = "force-dynamic";
export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) return new Response(null, { status: 401 });
  try {
    return Response.json(await notificationFeed(prisma, session.user.id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
const schema = z.object({
  items: z
    .array(
      z.object({
        key: z.string().min(1).max(250),
        version: z.string().min(1).max(250),
      }),
    )
    .max(50),
});
export async function POST(request: Request) {
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return new Response(null, { status: 403 });
  const session = await getSession();
  if (!session?.user?.id) return new Response(null, { status: 401 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return new Response(null, { status: 400 });
  try {
    await readNotifications(prisma, session.user.id, input.data.items);
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 503 });
  }
}

/** Supprime des notifications (glissement latéral dans le panneau). */
export async function DELETE(request: Request) {
  if (
    request.headers.get("origin") &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    return new Response(null, { status: 403 });
  const session = await getSession();
  if (!session?.user?.id) return new Response(null, { status: 401 });
  const input = schema.safeParse(await request.json().catch(() => null));
  if (!input.success) return new Response(null, { status: 400 });
  try {
    await dismissNotifications(prisma, session.user.id, input.data.items);
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
