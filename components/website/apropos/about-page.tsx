import { FactsStrip } from "@/components/website/vitrine/facts-strip";

import { AboutCommitments } from "./about-commitments";
import { AboutHero } from "./about-hero";
import { AboutPrinciples } from "./about-principles";
import { AboutWhatsApp } from "./about-whatsapp";
import { AboutCta, AboutProcess } from "./about-process";

export function AboutPage() {
  return (
    <>
      <AboutHero />
      <FactsStrip />
      <AboutPrinciples />
      <AboutCommitments />
      <AboutWhatsApp />
      <AboutProcess />
      <AboutCta />
    </>
  );
}
