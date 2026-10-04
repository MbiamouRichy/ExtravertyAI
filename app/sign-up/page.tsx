import { AuthPage } from "@/components/auth/signUpPage";
import type { Metadata } from "next";
import { checkoutCallback } from "@/lib/auth-redirects";

export const metadata: Metadata = {
  title: "S'inscrire | ExtravertyAI",
};
export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string | string[] }>;
}) {
  const callbackUrl = checkoutCallback((await searchParams).callbackUrl);
  return <AuthPage callbackUrl={callbackUrl} />;
}
