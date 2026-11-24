import { AuthPage } from "@/components/auth/signUpPage";
import type { Metadata } from "next";
import { checkoutCallback } from "@/lib/auth-redirects";
import { pageMetadata } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: "S'inscrire | ExtravertyAI",
  shareTitle: "Essayer ExtravertyAI gratuitement",
  description:
    "Créez votre compte ExtravertyAI et lancez votre assistant IA WhatsApp en quelques minutes, avec un essai gratuit.",
  path: "/sign-up",
});
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const callbackUrl = checkoutCallback((await searchParams).callbackUrl);
  return <AuthPage callbackUrl={callbackUrl} />;
}
