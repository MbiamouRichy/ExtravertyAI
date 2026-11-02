import type { ReactNode } from "react";
import { Mail, type LucideIcon } from "lucide-react";

import { SiteNav } from "@/components/website/vitrine/site-nav";
import { SiteFooter } from "@/components/website/vitrine/site-footer";
import { WhatsAppIcon } from "@/components/social-icon";
import { Button } from "@/components/ui/button";

export type LegalSection = {
  id: string;
  icon: LucideIcon;
  title: string;
  body: ReactNode;
};

export function LegalPage({
  eyebrowIcon: EyebrowIcon,
  title,
  intro,
  updatedLabel,
  updatedDate,
  highlights,
  sections,
  contactTitle,
  contactText,
  whatsAppMessage,
}: {
  eyebrowIcon: LucideIcon;
  title: string;
  intro: string;
  updatedLabel: string;
  updatedDate: string;
  highlights: { icon: LucideIcon; title: string; text: string }[];
  sections: LegalSection[];
  contactTitle: string;
  contactText: string;
  whatsAppMessage: string;
}) {
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
              <EyebrowIcon aria-hidden="true" className="size-4" />
              Légal
            </p>
            <h1 className="max-w-3xl text-[2.6rem] text-balance sm:text-5xl md:text-6xl">
              {title}
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-muted-foreground md:text-lg">
              {intro}
            </p>
            <p className="mt-6 text-xs text-muted-foreground">
              Dernière mise à jour : <time dateTime={updatedDate}>{updatedLabel}</time>
            </p>

            <ul aria-label="En bref" className="mt-10 grid gap-3 sm:grid-cols-3">
              {highlights.map(({ icon: Icon, title: label, text }) => (
                <li key={label} className="flex gap-3 rounded-xl border bg-background p-4">
                  <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span>
                    <span className="block text-sm font-medium">{label}</span>
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
            {sections.map(({ id, icon: Icon, title: heading, body }, index) => (
              <section key={id} id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex size-9 items-center justify-center rounded-lg border bg-muted/50">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <h2 id={`${id}-title`} className="text-2xl tracking-tight">
                    <span className="mr-2 font-mono text-sm font-normal text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {heading}
                  </h2>
                </div>
                <div className="max-w-prose space-y-4 text-muted-foreground [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:marker:text-muted-foreground/50">
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
                {contactTitle}
              </h2>
              <p className="mt-3 max-w-md text-sm opacity-75">{contactText}</p>
              <Button asChild size="lg" variant="secondary" className="mt-6">
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://wa.me/24176205629?text=${encodeURIComponent(whatsAppMessage)}`}
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
