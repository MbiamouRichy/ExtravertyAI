import { FactsStrip } from "./facts-strip";
import { serifItalic } from "./fonts";
import { Hero } from "./hero";
import { MotionProvider } from "./motion";
import {
  AnalyticsSection,
  FeaturesSection,
  FinalCta,
  PipelineSection,
  PricingSection,
  SecuritySection,
} from "./sections";
import { SiteFooter } from "./site-footer";
import { SiteNav } from "./site-nav";

/**
 * Public home page. Everything sits inside one hairline frame so sections
 * read as a single, precise grid rather than stacked cards.
 */
export function VitrinePage() {
  return (
    <MotionProvider>
      <div className={serifItalic.variable}>
        <SiteNav />
        <main id="contenu" className="overflow-x-clip sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl sm:border-x">
            <Hero />
            <FactsStrip />
            <PipelineSection />
            <FeaturesSection />
            <AnalyticsSection />
            <PricingSection />
            <SecuritySection />
            <FinalCta />
          </div>
        </main>
        <SiteFooter />
      </div>
    </MotionProvider>
  );
}
