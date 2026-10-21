import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Ban, Cog, Database, Lock, Mail, Scale, Share2, ShieldCheck, Trash2 } from "lucide-react";

import { SiteNav } from "@/components/website/vitrine/site-nav";
import { SiteFooter } from "@/components/website/vitrine/site-footer";
import { WhatsAppIcon } from "@/components/social-icon";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Données et confidentialité | ExtravertyAI",
  description:
    "Comment ExtravertyAI collecte, utilise et protège vos données et celles de vos clients.",
  alternates: { canonical: "/donneesEtConfidentialite" },
};
export const dynamic = "force-static";

const LAST_UPDATED = "12 juin 2026";

const highlights = [
  { icon: Ban, title: "Jamais revendues", text: "Ni vos données, ni celles de vos clients." },
  { icon: Lock, title: "Chiffrées en transit", text: "TLS/SSL et accès strictement contrôlés." },
  { icon: Trash2, title: "Supprimables", text: "Accès, export ou suppression à tout moment." },
];

const sections: {
  id: string;
  icon: typeof Database;
  title: string;
  body: ReactNode;
}[] = [
  {
    id: "collecte",
    icon: Database,
    title: "Données collectées",
    body: (
      <>
        <p>
          Dans le cadre de l’utilisation de nos services d’automatisation, nous
          collectons différents types d’informations :
        </p>
        <ul>
          <li>
            <strong>Informations de compte :</strong> nom, adresse e-mail,
            informations de facturation de votre entreprise.
          </li>
          <li>
            <strong>Données d’intégration :</strong> numéros WhatsApp
            professionnels pour la configuration des webhooks nécessaires au
            fonctionnement de nos agents.
          </li>
          <li>
            <strong>Données de traitement :</strong> les flux de messages
            traités par nos systèmes d’intelligence artificielle pour le compte
            de votre support client.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "utilisation",
    icon: Cog,
    title: "Utilisation des données",
    body: (
      <>
        <p>Nous utilisons vos données exclusivement pour :</p>
        <ul>
          <li>Fournir, opérer et maintenir nos services d’agents IA.</li>
          <li>Améliorer la logique de nos systèmes et la précision des réponses automatisées.</li>
          <li>Assurer le support technique et répondre à vos demandes.</li>
          <li>Traiter les transactions via nos prestataires de paiement sécurisés.</li>
        </ul>
      </>
    ),
  },
  {
    id: "partage",
    icon: Share2,
    title: "Partage et tiers",
    body: (
      <p>
        ExtravertyAI ne vend <strong>jamais</strong> vos données personnelles ni
        celles de vos clients. Nous partageons certaines informations uniquement
        avec des fournisseurs d’infrastructure cloud de confiance (hébergement,
        bases de données, modèles de langage) strictement nécessaires à
        l’exécution de notre service, dans le cadre d’accords de confidentialité
        rigoureux.
      </p>
    ),
  },
  {
    id: "securite",
    icon: Lock,
    title: "Sécurité",
    body: (
      <p>
        Nous mettons en œuvre des mesures de sécurité de niveau entreprise pour
        protéger vos informations. Les données en transit sont chiffrées via
        TLS/SSL, et les données au repos sont stockées dans des bases de données
        sécurisées avec des accès strictement contrôlés et authentifiés.
      </p>
    ),
  },
  {
    id: "droits",
    icon: Scale,
    title: "Vos droits",
    body: (
      <p>
        Vous conservez le contrôle total sur vos données. Vous avez le droit de
        demander l’accès, la rectification, la portabilité ou la suppression
        complète de vos données de nos serveurs à tout moment. La suppression
        d’un compte entraîne la purge de toutes les données associées de notre
        base de données principale.
      </p>
    ),
  },
];

export default function PrivacyPolicy() {
  return (
    <>
      <SiteNav />
      <main id="contenu">
        <section className="relative isolate border-b px-4 pb-14 pt-14 sm:px-6 md:pt-20">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[radial-gradient(var(--border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_70%_70%_at_20%_0%,black,transparent)] bg-size-[22px_22px]"
          />
          <div className="mx-auto w-full max-w-6xl">
            <p className="mb-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
              <ShieldCheck aria-hidden="true" className="size-4" />
              Légal
            </p>
            <h1 className="max-w-3xl text-[2.6rem] text-balance sm:text-5xl md:text-6xl">
              Données et confidentialité
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-muted-foreground md:text-lg">
              Nous prenons la protection de vos données et de celles de vos
              clients très au sérieux. Voici, en toute transparence, comment
              nous les gérons.
            </p>
            <p className="mt-6 text-xs text-muted-foreground">
              Dernière mise à jour : <time dateTime="2026-06-12">{LAST_UPDATED}</time>
            </p>

            <ul aria-label="En bref" className="mt-10 grid gap-3 sm:grid-cols-3">
              {highlights.map(({ icon: Icon, title, text }) => (
                <li key={title} className="flex gap-3 rounded-xl border bg-background p-4">
                  <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="block text-xs text-muted-foreground">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-14 sm:px-6 md:grid-cols-[14rem_1fr] md:py-20 lg:gap-20">
          <nav aria-label="Sommaire" className="md:sticky md:top-24 md:self-start">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Sommaire
            </p>
            <ol className="flex gap-1 overflow-x-auto border-b pb-3 md:flex-col md:border-b-0 md:border-l md:pb-0 [scrollbar-width:none]">
              {[...sections, { id: "contact", title: "Nous contacter" }].map((section, index) => (
                <li key={section.id} className="shrink-0">
                  <a
                    href={`#${section.id}`}
                    className="flex gap-2 rounded-md px-3 py-1.5 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 md:-ml-px md:rounded-none md:border-l md:border-transparent md:hover:border-foreground"
                  >
                    <span className="font-mono text-xs tabular-nums opacity-60">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="min-w-0 space-y-14">
            {sections.map(({ id, icon: Icon, title, body }, index) => (
              <section key={id} id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg border bg-muted/50">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <h2 id={`${id}-title`} className="text-2xl tracking-tight">
                    <span className="mr-2 font-mono text-sm font-normal text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {title}
                  </h2>
                </div>
                <div className="max-w-prose space-y-4 text-muted-foreground [&_li]:pl-1 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:marker:text-muted-foreground/50">
                  {body}
                </div>
              </section>
            ))}

            <section
              id="contact"
              aria-labelledby="contact-title"
              className="scroll-mt-24 rounded-2xl bg-primary p-8 text-primary-foreground sm:p-10"
            >
              <Mail aria-hidden="true" className="mb-4 size-6" />
              <h2 id="contact-title" className="text-2xl tracking-tight">
                Une question sur vos données ?
              </h2>
              <p className="mt-3 max-w-md text-sm opacity-75">
                Pour toute question sur cette politique ou pour exercer vos
                droits, notre équipe vous répond directement.
              </p>
              <Button asChild size="lg" variant="secondary" className="mt-6">
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href="https://wa.me/24176205629?text=Bonjour%2C%20j%27ai%20une%20question%20concernant%20la%20politique%20de%20confidentialit%C3%A9%20d%27ExtravertyAI."
                >
                  <WhatsAppIcon data-icon="inline-start" />
                  Discuter avec notre équipe
                </a>
              </Button>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
