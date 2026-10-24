import { FactsStrip } from "@/components/website/vitrine/facts-strip";

import { AboutCommitments } from "./about-commitments";
import { AboutHero } from "./about-hero";
import { AboutPrinciples } from "./about-principles";
import { AboutCta, AboutProcess } from "./about-process";

export function AboutPage() {
  return (
    <>
      <AboutHero />
      <FactsStrip />
      <AboutPrinciples />
      <AboutCommitments />
      <AboutProcess />
      <AboutCta />
    </>
  );
}
