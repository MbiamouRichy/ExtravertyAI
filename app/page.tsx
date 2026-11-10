import { VitrinePage } from "@/components/website/vitrine/vitrine-page";
import type { Metadata } from "next";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { homeStructuredData, serializeJsonLd } from "@/lib/structured-data";

const HOME_TITLE = "ExtravertyAI - Automatisation WhatsApp & Support Client IA";

// L’adresse de base, les icônes et l’image de partage viennent du
// layout racine ; l’accueil ne précise que ce qui lui est propre.
export const metadata: Metadata = {
  title: HOME_TITLE,
  description: SITE_DESCRIPTION,
  keywords: [
    "ExtravertyAI",
    "extravertyia",
    "extraverty ia",
    "extraverty",
    "extraverty ai",
    "ia extraverty",
    "assistant IA pour entreprise",
    "automatisation WhatsApp",
    "bot WhatsApp",
    "chatbot IA WhatsApp",
    "marketing WhatsApp",
    "tunnel de vente automatisé",
    "support client automatisé",
    "service client IA",
    "automatisation marketing",
    "automatisation sans code",
  ],
  authors: [{ name: SITE_NAME }],
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: SITE_NAME,
    description: "Automatisez votre support client sur WhatsApp avec l’IA",
    url: "/",
    siteName: SITE_NAME,
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
    locale: "fr_FR",
    type: "website",
  },
};
export const dynamic = "force-static";

export default function page() {
  return (
    <>
      <script
        type="application/ld+json"
        // Contenu fixe, sérialisé et échappé : aucun texte venant d’un
        // utilisateur ne passe par ici.
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(homeStructuredData()),
        }}
      />
      <VitrinePage />
    </>
  );
}
