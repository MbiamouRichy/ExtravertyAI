import { Contact } from "@/components/website/contact";
import { Header } from "@/components/website/header";
import Footer from "@/components/website/footer";
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
      <Header />
      <Contact />
      <Footer />
    </>
  );
}
