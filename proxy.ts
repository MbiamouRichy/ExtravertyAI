import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Vérification optimiste : sans cookie de session, un visiteur reçoit une vraie
// redirection 307 vers la connexion, sans que la page protégée soit rendue.
// Ce filtre ne remplace rien : chaque page, action et route revérifie la
// session et l’appartenance au projet auprès de la base.
export function proxy(request: NextRequest) {
  // Les actions serveur (POST) gardent leur propre réponse d’erreur.
  if (request.method !== "GET" && request.method !== "HEAD") return NextResponse.next();
  if (getSessionCookie(request)) return NextResponse.next();

  const target = request.nextUrl.clone();
  target.searchParams.delete("_rsc");
  const signIn = new URL("/sign-in", request.url);
  // Chemin relatif uniquement ; la page de connexion le revalide en plus.
  signIn.searchParams.set("callbackUrl", `${target.pathname}${target.search}`);
  return NextResponse.redirect(signIn);
}

export const config = {
  matcher: ["/projects/:path*"],
};
