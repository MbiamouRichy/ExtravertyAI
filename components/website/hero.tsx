"use client"
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { ArrowRightIcon, Video } from "lucide-react";

import Link from "next/link";
import HeroImage from "./heroImage";
import Image from "next/image";
import { FullWidthDivider } from "../ui/full-width-divider";
import { DecorIcon } from "../ui/decor-icon";
import { WhatsAppIcon } from "../social-icon";

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

          <div
            className={cn(
              "absolute inset-0 isolate -z-10",
              "bg-[radial-gradient(20%_80%_at_20%_0%,--theme(--color-foreground/.15),transparent)]",
            )}
          />
        </div>
        <Link
          className={cn(
            "group mx-auto text-sm hidden md:flex w-fit items-center gap-3 rounded-sm border bg-card p-1 shadow",
            "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards transition-all delay-500 duration-500 ease-out",
          )}
          href="https://wa.me/24176205629?text=Bonjour,%20Pouvez-vous%20m'expliquer%20la%20mise%20en%20place%20?"
        >
          <div className="rounded-xs border bg-primary/5 dark:bg-card px-1.5 py-0.5 shadow-sm">
            <p className="font-mono">Actuellement</p>
          </div>

          <span>Nous acceptons de nouveau projets</span>
          <span className="block h-5 border-l" />

          <div className="pr-1">
            <ArrowRightIcon className="size-3 -translate-x-0.5 duration-150 ease-out group-hover:translate-x-0.5" />
          </div>
        </Link>

        <h1
          className={cn(
            " text-balance text-center ",
            "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-100 duration-500 ease-out",
          )}
        >
          Automatisez vos réponses WhatsApp et ne perdez plus aucun client
        </h1>

        <p
          className={cn(
            "text-center md:max-w-prose text-muted-foreground text-base tracking-wider md:text-lg",
            "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-200 duration-500 ease-out",
          )}
        >
          ExtravertyAI répond automatiquement à vos messages WhatsApp, qualifie
          vos prospects et transforme chaque conversation en opportunité de
          vente — même quand vous dormez.
        </p>

        <div className="fade-in slide-in-from-bottom-10 flex flex-col-reverse md:flex-row-reverse md:w-fit w-full animate-in items-center justify-center gap-6 fill-mode-backwards pt-2 delay-300 duration-500 ease-out">
          <Button
            asChild
            className="w-full md:w-auto text-sm md:text-base"
            size={"lg"}
            variant="outline"
          >
            <Link href="/#demo" title="demo">
              <Video data-icon="inline-start" /> Regarder la démo
            </Link>
          </Button>
          <Button asChild className="w-full md:w-auto text-sm md:text-base">
            <Link href="/sign-in">
              <WhatsAppIcon aria-hidden="true" />
              Demarrer maintenant
            </Link>
          </Button>
        </div>
      </div>
      <div className="relative">
        <DecorIcon className="size-4" position="top-left" />
        <DecorIcon className="size-4" position="top-right" />
        <DecorIcon className="size-4" position="bottom-left" />
        <DecorIcon className="size-4" position="bottom-right" />

        <FullWidthDivider className="-top-px" />
        <div className="overflow-hidden *:pointer-events-none *:aspect-video *:select-none">
          <Image
            alt="light app screen"
            className="dark:hidden"
            loading="lazy"
            height="1800"
            src="https://storage.efferd.com/screen/dashboard-light.webp"
            width="1800"
          />
          <Image
            alt="dark app screen"
            className="hidden dark:block"
            loading="lazy"
            height="1800"
            src="https://storage.efferd.com/screen/dashboard-dark.webp"
            width="1800"
          />
        </div>
        <FullWidthDivider className="-bottom-px" />
      </div>
      <HeroImage />
    </section>
  );
}
