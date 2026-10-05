import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { getBillingAccess } from "@/lib/billing-access";

export const runtime = "nodejs";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const session = await getSession();
  const headers = { "Cache-Control": "private, no-store" };
  if (!session?.user?.id)
    return NextResponse.json(
      { error: "Connexion requise." },
      { status: 401, headers },
    );
  const { projectId } = await params;
  const member = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
    select: { id: true },
  });
  if (!member)
    return NextResponse.json(
      { error: "Projet indisponible." },
      { status: 404, headers },
    );
  return NextResponse.json(await getBillingAccess(prisma, projectId), {
    headers,
  });
}
