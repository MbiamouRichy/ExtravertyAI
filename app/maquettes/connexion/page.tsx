import type { Metadata } from "next";

import { AuthPage } from "@/components/auth/signInPage";

export const metadata: Metadata = { title: "Connexion" };

// La maquette est désormais l’écran de connexion réel (/sign-in).
export default function ConnexionMaquette() {
  return <AuthPage callbackUrl="/projects" />;
}
