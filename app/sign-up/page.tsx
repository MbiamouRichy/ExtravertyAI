import { AuthPage } from "@/components/auth/signUpPage";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { checkoutCallback } from "@/lib/auth-redirects";
import { detectInAppBrowser } from "@/lib/in-app-browser";

export const metadata: Metadata = {
  title: "S'inscrire | ExtravertyAI",
  description:
    "Créez votre compte ExtravertyAI et lancez votre assistant IA WhatsApp en quelques minutes, avec un essai gratuit.",
  alternates: { canonical: "/sign-up" },
};
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const callbackUrl = checkoutCallback((await searchParams).callbackUrl);
  // Lu côté serveur : la page arrive déjà adaptée au navigateur intégré
  // (Facebook, Instagram…), sans bouton Google qui y échouerait.
  const inAppBrowser = detectInAppBrowser((await headers()).get("user-agent"));
  return <AuthPage callbackUrl={callbackUrl} inAppBrowser={inAppBrowser} />;
}
