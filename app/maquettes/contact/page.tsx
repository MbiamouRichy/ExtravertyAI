import type { Metadata } from "next";

import { ContactPage } from "@/components/maquettes/contact/contact-page";

import ContactLoading from "./loading";

export const metadata: Metadata = { title: "Contact" };

export default async function ContactMaquette({
  searchParams,
}: {
  searchParams: Promise<{ apercu?: string | string[] }>;
}) {
  // « ?apercu=chargement » fige l’écran de chargement pour le relire.
  if ((await searchParams).apercu === "chargement") return <ContactLoading />;

  return <ContactPage />;
}
