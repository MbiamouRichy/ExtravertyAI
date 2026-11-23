import type { Metadata } from "next";

import { JsonLd } from "@/components/json-ld";
import { ContactPage } from "@/components/website/contact/contact-page";
import { SiteShell } from "@/components/website/site-shell";
import { pageMetadata } from "@/lib/seo";
import { breadcrumbStructuredData } from "@/lib/structured-data";

export const metadata: Metadata = pageMetadata({
  title: "Contact — Parlons de votre projet | ExtravertyAI",
  shareTitle: "Contacter ExtravertyAI",
  description:
    "Discutons de votre activité et de votre service client WhatsApp. Contactez ExtravertyAI à distance par WhatsApp ou par e-mail.",
  path: "/contact",
});
export const dynamic = "force-static";

export default function Page() {
  return (
    <SiteShell>
      <JsonLd data={breadcrumbStructuredData([{ name: "Contact", path: "/contact" }])} />
      <ContactPage />
    </SiteShell>
  );
}
