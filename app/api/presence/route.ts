import { z } from "zod";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { heartbeat } from "@/lib/presence";
const schema = z.object({ tabId: z.string().uuid(), active: z.boolean() });
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
    await heartbeat(
      prisma,
      session.user.id,
      input.data.tabId,
      input.data.active,
    );
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
