import { Contact } from "@/components/website/contact";
import { SiteNav } from "@/components/website/vitrine/site-nav";
import { SiteFooter } from "@/components/website/vitrine/site-footer";
import type { Metadata } from "next";
export const metadata: Metadata = {
  title: "Contact — Parlons de votre projet | ExtravertyAI",
  description:
    "Discutons de votre activité et de votre service client WhatsApp. Contactez ExtravertyAI à distance par WhatsApp, téléphone ou e-mail.",
  alternates: { canonical: "/contact" },
};
export const dynamic = "force-static";
export default function Page() {
  return (
    <>
      <SiteNav />
      <Contact />
      <SiteFooter />
    </>
  );
}
