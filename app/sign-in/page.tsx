import { AuthPage } from "@/components/auth/signInPage";
import type { Metadata } from "next";
import { safeAuthCallback } from "@/lib/auth-redirects";

export const metadata: Metadata = {
  title: "Se connecter | ExtravertyAI",
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
