import { AuthPage } from "@/components/auth/signInPage";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { safeAuthCallback } from "@/lib/auth-redirects";
import { detectInAppBrowser } from "@/lib/in-app-browser";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "Se connecter | ExtravertyAI",
  shareTitle: "Se connecter à ExtravertyAI",
  description:
    "Connectez-vous à votre espace ExtravertyAI pour suivre vos conversations WhatsApp et piloter votre assistant IA.",
  path: "/sign-in",
});

type SignInPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function SeConnecterPage({
  searchParams,
}: SignInPageProps) {
  const params = await searchParams;

  const callbackUrl = safeAuthCallback(params.callbackUrl);
  // Lu côté serveur : la page arrive déjà adaptée au navigateur intégré.
  const inAppBrowser = detectInAppBrowser((await headers()).get("user-agent"));

  return <AuthPage callbackUrl={callbackUrl} inAppBrowser={inAppBrowser} />;
}
