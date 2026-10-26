import type { Metadata } from "next";

import { PricingPage } from "@/components/website/pricing/pricing-page";

export const metadata: Metadata = { title: "Tarifs" };

// La maquette est désormais la page Tarifs réelle (/tarifs).
export default function TarifsMaquette() {
  return <PricingPage />;
}
