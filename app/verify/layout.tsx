import type { Metadata } from "next";

// La page est un composant client : son titre est déclaré ici.
export const metadata: Metadata = {
  title: "Vérification de l’adresse e-mail | ExtravertyAI",
  robots: { index: false, follow: false },
};

export default function VerifyLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
