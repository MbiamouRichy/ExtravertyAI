import type { ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";

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

function SummaryLinks({
  items,
  className,
  linkClassName,
}: {
  items: { id: string; title: string }[];
  className?: string;
  linkClassName: string;
}) {
  return (
    <ol className={className}>
      {items.map((item, index) => (
        <li key={item.id}>
          <a href={`#${item.id}`} className={linkClassName}>
            <span className="font-mono text-xs tabular-nums opacity-60">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0">{item.title}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}

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
  const summary = [...sections, { id: "contact", title: "Nous contacter" }];
  return (
    <>
      <SiteNav />
      <main id="contenu">
        <section className="relative isolate border-b px-4 pb-8 pt-10 sm:px-6 md:pb-14 md:pt-20">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 hidden bg-[radial-gradient(var(--border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_70%_70%_at_20%_0%,black,transparent)] bg-size-[22px_22px] md:block"
          />
          <div className="mx-auto w-full max-w-6xl">
            <p className="mb-3 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground md:mb-4">
              <EyebrowIcon aria-hidden="true" className="size-4" />
              Légal
            </p>
            <h1 className="max-w-3xl text-4xl wrap-anywhere text-balance sm:text-5xl md:text-6xl">
              {title}
            </h1>
            <p className="mt-4 max-w-2xl text-pretty text-muted-foreground md:mt-5 md:text-lg">
              {intro}
            </p>
            <p className="mt-4 text-xs text-muted-foreground md:mt-6">
              Mis à jour le <time dateTime={updatedDate}>{updatedLabel}</time>
            </p>

            <ul
              aria-label="En bref"
              className="mt-8 divide-y border-y md:mt-10 md:grid md:grid-cols-3 md:divide-x md:divide-y-0 md:rounded-xl md:border md:bg-background"
            >
              {highlights.map(({ icon: Icon, title: label, text }) => (
                <li key={label} className="flex gap-3 py-3.5 md:p-4">
                  <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{label}</span>
                    <span className="block text-sm text-muted-foreground md:text-xs">{text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-8 px-4 py-8 sm:px-6 md:grid-cols-[14rem_minmax(0,1fr)] md:gap-12 md:py-20 lg:gap-20">
          <details className="group rounded-lg border md:hidden">
            <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-lg px-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
              Sommaire
              <span className="flex items-center gap-2 text-xs font-normal text-muted-foreground">
                {summary.length} sections
                <ChevronDown
                  aria-hidden="true"
                  className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
                />
              </span>
            </summary>
            <nav aria-label="Sommaire">
              <SummaryLinks
                items={summary}
                className="border-t py-1"
                linkClassName="flex min-h-11 items-center gap-3 px-4 py-2 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-inset focus-visible:ring-ring/50"
              />
            </nav>
          </details>

          <nav aria-label="Sommaire" className="hidden md:sticky md:top-24 md:block md:self-start">
            <p className="mb-3 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              Sommaire
            </p>
            <SummaryLinks
              items={summary}
              className="flex flex-col border-l"
              linkClassName="-ml-px flex gap-2 border-l border-transparent px-3 py-1.5 text-sm text-muted-foreground outline-none transition-colors hover:border-foreground hover:text-foreground focus-visible:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </nav>

          <div className="min-w-0 space-y-8 md:space-y-14">
            {sections.map(({ id, icon: Icon, title: heading, body }, index) => (
              <section
                key={id}
                id={id}
                aria-labelledby={`${id}-title`}
                className="scroll-mt-24 border-t pt-8 first:border-t-0 first:pt-0 md:border-t-0 md:pt-0"
              >
                <div className="mb-3 flex items-center gap-3 md:mb-4">
                  <span className="hidden size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50 md:flex">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <h2 id={`${id}-title`} className="flex min-w-0 items-baseline gap-2.5 text-xl tracking-tight md:text-2xl">
                    <span className="font-mono text-xs font-normal text-muted-foreground md:text-sm">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0">{heading}</span>
                  </h2>
                </div>
                <div className="max-w-prose space-y-4 text-[0.9375rem] leading-7 text-muted-foreground wrap-break-word md:text-base [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_strong]:font-medium [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:marker:text-muted-foreground/50">
                  {body}
                </div>
              </section>
            ))}

            <section
              id="contact"
              aria-labelledby="contact-title"
              className="scroll-mt-24 rounded-xl border bg-muted/40 p-5 sm:p-8"
            >
              <h2 id="contact-title" className="text-xl tracking-tight md:text-2xl">
                {contactTitle}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{contactText}</p>
              <Button asChild size="lg" className="mt-5 w-full sm:w-auto">
                <a
                  target="_blank"
                  rel="noopener noreferrer"
                  href={`https://wa.me/24176205629?text=${encodeURIComponent(whatsAppMessage)}`}
                >
                  <WhatsAppIcon data-icon="inline-start" />
                  Écrire sur WhatsApp
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
