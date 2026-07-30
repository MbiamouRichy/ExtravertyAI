import { cn } from "@/lib/utils";
import { HeroSection } from "@/components/website/hero";
import AvantApres from "@/components/website/avantApres";
import Footer from "@/components/website/footer";
import { Faq } from "@/components/website/faq";
import { Tarifs } from "@/components/website/pricing-section";
import Demo from "@/components/website/demo";
import { Header } from "@/components/website/header";
import type { Metadata } from "next";
export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  title: {
    default: "ExtravertyAI - Automatisation WhatsApp & Support Client IA",
    template: "%s | ExtravertyAI",
  },
  description:
    "Automatisez votre support client WhatsApp avec ExtravertyAI. Réponses instantanées, augmentation des ventes et expérience client améliorée.",

  keywords: [
    "ExtravertyAI",
    "extravertyia",
    "extraverty ia",
    "ia libreville",
    " WhatsApp automation libreville",
    "automatisation WhatsApp pour business au Gabon",
    "bot WhatsApp",
    "automatisation WhatsApp",
    "chatbot WhatsApp",
    "marketing WhatsApp",
    "tunnel de vente automatisé",
    "automation whatsapp libreville",
    "Gabon automatisation",
    "ia gabon",
    "extraverty",
    "IA WhatsApp afrique",
    "automatisation WhatsApp",
    "chatbot IA whatsapp",
    "support client automatisé",
    "automation business",
    "intelligence artificielle entreprise",
    "bot WhatsApp gabon",
    "service client IA",
    "automatisation marketing",
    "no code automation gabon",
  ],

  authors: [{ name: "ExtravertyAI" }],

  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },

  twitter: {
    card: "summary_large_image",
    images: ["/og-image.png"],
  },

  openGraph: {
    title: "ExtravertyAI",
    description: "Automatisez votre support client sur whatsapp avec l'IA",
    url: "https://extravertyai.com",
    siteName: "ExtravertyAI",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
      },
    ],
    locale: "fr_FR",
    type: "website",
  },
};
export const dynamic = "force-static";

export default function page() {
  return (
    <>
      <Header />
      <div className="relative h-full overflow-hidden">
        <main
          className={cn(
            "relative md:mx-auto max-w-7xl h-full grow",
            // X Borders
            "before:absolute before:-inset-y-14 before:-left-px before:w-px before:bg-border",
            "after:absolute after:-inset-y-14 after:-right-px after:w-px after:bg-border",
          )}
        >
          <HeroSection />
          {/* <LogosSection /> */}
          <Demo />
          <AvantApres />
          <Tarifs />
          <Faq />
          <Footer />
        </main>
      </div>
    </>
  );
}
