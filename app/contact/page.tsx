import type { Metadata } from "next";

import { ContactPage } from "@/components/website/contact/contact-page";
import { SiteShell } from "@/components/website/site-shell";

export const metadata: Metadata = {
  title: "Contact — Parlons de votre projet | ExtravertyAI",
  description:
    "Discutons de votre activité et de votre service client WhatsApp. Contactez ExtravertyAI à distance par WhatsApp, téléphone ou e-mail.",
  alternates: { canonical: "/contact" },
};
export const dynamic = "force-static";

export default function Page() {
  return (
    <SiteShell>
      <ContactPage />
    </SiteShell>
  );
}
