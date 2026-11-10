import { AuthPage } from "@/components/auth/signInPage";
import type { Metadata } from "next";
import { safeAuthCallback } from "@/lib/auth-redirects";

export const metadata: Metadata = {
  title: "Se connecter | ExtravertyAI",
  description:
    "Connectez-vous à votre espace ExtravertyAI pour suivre vos conversations WhatsApp et piloter votre assistant IA.",
  alternates: { canonical: "/sign-in" },
};

type SignInPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function SeConnecterPage({
  searchParams,
}: SignInPageProps) {
  const params = await searchParams;

  const callbackUrl = safeAuthCallback(params.callbackUrl);

  return <AuthPage callbackUrl={callbackUrl} />;
}
