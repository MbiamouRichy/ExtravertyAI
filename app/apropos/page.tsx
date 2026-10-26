import type { Metadata } from "next";

import { AboutPage } from "@/components/website/apropos/about-page";
import { SiteShell } from "@/components/website/site-shell";

export const metadata: Metadata = {
  title: "À propos — La relation client, plus simplement | ExtravertyAI",
  description:
    "ExtravertyAI aide les entreprises à mieux accueillir leurs clients sur WhatsApp, grâce à une IA qui travaille avec leurs équipes.",
  alternates: { canonical: "/apropos" },
};
export const dynamic = "force-static";

export default function Page() {
  return (
    <SiteShell>
      <AboutPage />
    </SiteShell>
  );
}
