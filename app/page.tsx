import { cn } from "@/lib/utils";
import { HeroSection } from "@/components/hero";
import AvantApres from "@/components/avantApres";
import Footer from "@/components/footer";
import { Faq } from "@/components/faq";
import { Tarifs } from "@/components/pricing-section";
import Demo from "@/components/demo";

export default function page() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden supports-[overflow:clip]:overflow-clip">
      <main
        className={cn(
          "relative mx-auto grow",
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
  );
}
