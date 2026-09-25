"use client"
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRightIcon } from "lucide-react";

import Link from "next/link";
import HeroImage from "./heroImage";
import Image from "next/image";


function DashboardPreview({
  decorative = false,
  className,
}: {
  decorative?: boolean;
  className?: string;
}) {
  return (
    <Card
      aria-hidden={decorative ? true : undefined}
      className={cn(
        "pointer-events-none gap-0 select-none border border-border bg-background p-1.5 ring-0 sm:p-2",
        className,
      )}
    >
      <div className="relative aspect-video overflow-hidden rounded-lg border border-border bg-muted">
        <Image
          alt={decorative ? "" : "Aperçu du tableau de bord : indicateurs, graphique d’activité et suivi des documents"}
          className="object-cover object-top dark:hidden"
          fill
          loading="lazy"
          sizes="(min-width: 1280px) 864px, (min-width: 1024px) 75vw, (min-width: 640px) calc(100vw - 64px), calc(100vw - 32px)"
          src="https://storage.efferd.com/screen/dashboard-light.webp"
        />
        <Image
          alt={decorative ? "" : "Aperçu du tableau de bord : indicateurs, graphique d’activité et suivi des documents"}
          className="hidden object-cover object-top dark:block"
          fill
          loading="lazy"
          sizes="(min-width: 1280px) 864px, (min-width: 1024px) 75vw, (min-width: 640px) calc(100vw - 64px), calc(100vw - 32px)"
          src="https://storage.efferd.com/screen/dashboard-dark.webp"
        />
      </div>
    </Card>
  );
}

export function HeroSection() {
  return (
    <section className="relative w-full scroll-mt-24">
      <div className="flex flex-col max-w-5xl mx-auto items-center justify-center gap-5 px-2 pt-28 lg:pt-32 pb-8 md:pb-12 md:px-4">
        {/* X Faded Borders & Shades */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-1 size-full overflow-hidden"
        >
          <div
            className={cn(
              "absolute -inset-x-20 inset-y-0 z-0 rounded-full",
              "bg-[radial-gradient(ellipse_at_center,theme(--color-foreground/.15),transparent,transparent)]",
              "blur-[20px]",
            )}
          />

          {/* <div
            className={cn(
              "absolute inset-0 isolate -z-10",
              "bg-[radial-gradient(20%_80%_at_20%_0%,--theme(--color-foreground/.15),transparent)]",
            )}
          /> */}
        </div>
        <Link
          className={cn(
            "group mx-auto text-sm hidden md:flex w-fit items-center gap-3 rounded-sm border bg-card p-1 shadow",
            "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards transition-all delay-500 duration-500 ease-out",
          )}
          href="/#tarifs"
        >
          <div className="rounded-xs border bg-primary/5 dark:bg-card px-1.5 py-0.5 shadow-sm">
            <p className="font-mono">Actuellement</p>
          </div>

          <span>on casse les prix!</span>
          <span className="block h-5 border-l" />

          <div className="pr-1">
            <ArrowRightIcon className="size-3 -translate-x-0.5 duration-150 ease-out group-hover:translate-x-0.5" />
          </div>
        </Link>

        <h1
          className={cn(
            " text-balance text-center",
            "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-100 duration-500 ease-out",
          )}
        >
          Automatisez vos réponses WhatsApp et gardez le fil de chaque prospect.
        </h1>

        <p
          className={cn(
            "text-center md:max-w-prose text-muted-foreground text-base tracking-wider md:text-lg leading-relaxed",
            "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-200 duration-500 ease-out",
          )}
        >
          ExtravertyAI répond automatiquement à vos messages WhatsApp, qualifie
          vos prospects et transforme chaque conversation en opportunité de
          vente — même quand vous dormez.
        </p>

        <div className="fade-in slide-in-from-bottom-10 flex flex-col-reverse md:flex-row-reverse md:w-fit w-full animate-in items-center justify-center gap-4 fill-mode-backwards pt-2 delay-300 duration-500 ease-out">
          <Button
            asChild
            className="w-full md:w-auto text-sm md:text-base"
            size={"lg"}
            variant="outline"
          >
            <Link href="/#demo" title="demo">
              Regarder la démo
            </Link>
          </Button>
          <Button asChild size="lg" className="w-full md:w-auto text-sm md:text-base">
            <Link href="/sign-up">
              S&apos;inscrire
            </Link>
          </Button>
        </div>
      </div>

      <div className="relative isolate overflow-hidden px-4 py-8 sm:px-8 sm:py-12  lg:pt-16">
        <div className="relative mx-auto max-w-6xl">
          <DashboardPreview
            decorative
            className="absolute inset-x-0 top-12 mx-auto hidden w-3/4 -translate-x-1/6 -rotate-6 opacity-30 lg:block"
          />
          <DashboardPreview
            decorative
            className="absolute inset-x-0 top-12 mx-auto hidden w-3/4 translate-x-1/6 rotate-6 opacity-30 lg:block"
          />
          <DashboardPreview className="relative z-10 mx-auto w-full shadow-xl shadow-foreground/10 lg:w-3/4" />
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-1/3 bg-linear-to-t from-background via-background/80 to-transparent"
        />
      </div>
      <HeroImage />
    </section>
  );
}
