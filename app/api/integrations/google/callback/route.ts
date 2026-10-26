import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { IntegrationError } from "@/lib/integrations";
import { GOOGLE_NONCE_COOKIE, connectGoogleSheets, verifyState } from "@/lib/google-sheets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sameNonce(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const state = verifyState(params.get("state") ?? "");
  const fallback = new URL("/projects", request.nextUrl.origin);
  if (!state) return NextResponse.redirect(fallback);

  const back = new URL(`/projects/${state.projectId}/integrations`, request.nextUrl.origin);
  const finish = (outcome: string) => {
    back.searchParams.set("google", outcome);
    const response = NextResponse.redirect(back);
    response.cookies.delete({ name: GOOGLE_NONCE_COOKIE, path: "/api/integrations/google" });
    return response;
  };

  const session = await getSession();
  const nonce = request.cookies.get(GOOGLE_NONCE_COOKIE)?.value ?? "";
  if (!session?.user?.id || session.user.id !== state.userId || !nonce || !sameNonce(nonce, state.nonce)) {
    return finish("error");
  }
  const code = params.get("code");
  if (params.get("error") || !code || code.length > 1000) return finish("cancelled");

  try {
    await connectGoogleSheets(prisma, { projectId: state.projectId, userId: state.userId, code });
    return finish("connected");
  } catch (error) {
    if (!(error instanceof IntegrationError)) console.error("[integrations] Connexion Google impossible.");
    return finish("error");
  }
}
