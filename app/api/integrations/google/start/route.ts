import { NextResponse, type NextRequest } from "next/server";
import { can } from "@/lib/project-permissions";
import { z } from "zod";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { planAllows } from "@/lib/plan-features";
import {
  GOOGLE_NONCE_COOKIE,
  authorizationUrl,
  googleConfigured,
  newNonce,
  signState,
} from "@/lib/google-sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const projectId = request.nextUrl.searchParams.get("projectId") ?? "";
  if (!z.string().cuid().safeParse(projectId).success) {
    return NextResponse.json({ error: "Projet indisponible." }, { status: 404 });
  }
  const back = new URL(`/projects/${projectId}/integrations`, request.nextUrl.origin);
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.redirect(
      new URL(`/sign-in?callbackUrl=${encodeURIComponent(back.pathname)}`, request.nextUrl.origin),
    );
  }
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
    select: { role: true, project: { select: { plan: true, deletionPending: true } } },
  });
  if (
    !membership ||
    membership.project.deletionPending ||
    !can(membership.role, "project.manage") ||
    !planAllows(membership.project.plan, "integrations") ||
    !googleConfigured()
  ) {
    back.searchParams.set("google", "unavailable");
    return NextResponse.redirect(back);
  }
  const nonce = newNonce();
  const response = NextResponse.redirect(
    authorizationUrl(signState({ projectId, userId: session.user.id, nonce })),
  );
  // Binds the consent to this browser: a leaked `state` alone is useless.
  response.cookies.set(GOOGLE_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations/google",
    maxAge: 600,
  });
  return response;
}
