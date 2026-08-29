import { AuthPage } from "@/components/auth/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Se connecter | ExtravertyAI",
};

type SignInPageProps = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function SeConnecterPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;

  // 2. Sécurisation : on s'assure que c'est bien une chaîne de caractères
  // Si callbackUrl n'existe pas, on renvoie vers le dashboard par défaut
  const callbackUrl = typeof params?.callbackUrl === "string"
    ? params.callbackUrl
    : "/projects";

  return <AuthPage callbackUrl={callbackUrl} />;
}