import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { projectPresence } from "@/lib/presence";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await getSession();
  if (!session?.user?.id) return new Response(null, { status: 401 });
  const { projectId } = await params;
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
    select: { id: true },
  });
  if (!membership) return new Response(null, { status: 404 });
  try {
    return Response.json(
      await projectPresence(prisma, projectId, session.user.id),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return new Response(null, { status: 503 });
  }
}
