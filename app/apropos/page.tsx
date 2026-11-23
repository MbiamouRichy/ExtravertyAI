import type { Metadata } from "next";

import { JsonLd } from "@/components/json-ld";
import { AboutPage } from "@/components/website/apropos/about-page";
import { SiteShell } from "@/components/website/site-shell";
import { pageMetadata } from "@/lib/seo";
import { breadcrumbStructuredData } from "@/lib/structured-data";

export const metadata: Metadata = pageMetadata({
  title: "À propos — La relation client, plus simplement | ExtravertyAI",
  shareTitle: "À propos d’ExtravertyAI",
  description:
    "ExtravertyAI aide les entreprises à mieux accueillir leurs clients sur WhatsApp, grâce à une IA qui travaille avec leurs équipes.",
  path: "/apropos",
});
export const dynamic = "force-static";

export default function Page() {
  return (
    <SiteShell>
      <JsonLd data={breadcrumbStructuredData([{ name: "À propos", path: "/apropos" }])} />
      <AboutPage />
    </SiteShell>
  );
}
