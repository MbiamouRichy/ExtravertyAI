import type { Metadata } from "next";

import { PricingPage } from "@/components/website/pricing/pricing-page";

export const metadata: Metadata = {
  title: "Tarifs — Offres ExtravertyAI",
  description:
    "Starter, Pro et Business : des offres mensuelles sans engagement pour automatiser votre WhatsApp, avec 10 jours d’essai gratuit.",
  alternates: { canonical: "/tarifs" },
};
export const dynamic = "force-static";

export default function TarifsPage() {
  return <PricingPage />;
}
