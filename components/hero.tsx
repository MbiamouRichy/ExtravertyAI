import { cn } from "@/lib/utils";

import { Button, buttonVariants } from "@/components/ui/button";
import { ArrowRight, ArrowRightIcon, Video } from "lucide-react";

import Link from "next/link";
import HeroImage, { WhatsAppIcon } from "./heroImage";

export function HeroSection() {
  return (
    <section className="relative w-full">
      <div className="flex flex-col max-w-5xl mx-auto items-center justify-center gap-5 px-4 py-16 md:px-4 md:py-24 lg:py-28">
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

          <div className="absolute inset-y-0 left-4 w-px bg-linear-to-b from-transparent via-border to-border md:left-8" />
          <div className="absolute inset-y-0 right-4 w-px bg-linear-to-b from-transparent via-border to-border md:right-8" />
          <div className="absolute inset-y-0 left-8 w-px bg-linear-to-b from-transparent via-border/50 to-border/50 md:left-12" />
          <div className="absolute inset-y-0 right-8 w-px bg-linear-to-b from-transparent via-border/50 to-border/50 md:right-12" />
        </div>
        <Link
          className={cn(
            "group mx-auto text-xs hidden md:flex w-fit items-center gap-3 rounded-sm border bg-card p-1 shadow",
            "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards transition-all delay-500 duration-500 ease-out",
          )}
          href="commencer"
        >
          <div className="rounded-xs border bg-card px-1.5 py-0.5 shadow-sm">
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
            " text-balance text-center text-3xl text-foreground md:text-5xl lg:text-6xl",
            "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-100 duration-500 ease-out",
          )}
        >
         Automatisez vos réponses WhatsApp et ne perdez plus aucun client
        </h1>

        <p
          className={cn(
            "text-center md:max-w-prose text-muted-foreground text-sm tracking-wider sm:text-lg",
            "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-200 duration-500 ease-out",
          )}
        >
         extravertyAI répond automatiquement à vos messages WhatsApp, qualifie vos prospects et transforme chaque conversation en opportunité de vente — même quand vous dormez.
        </p>

        <div className="fade-in slide-in-from-bottom-10 flex flex-col md:flex-row md:w-fit w-full animate-in items-center justify-center gap-3 fill-mode-backwards pt-2 delay-300 duration-500 ease-out">
          <Button asChild className="w-full md:w-auto" size={"lg"} variant="outline">
            <Link href="" title="/demo">
              <Video data-icon="inline-start" /> Regarder la démo
            </Link>
          </Button>
          <AutomatiserButton/>
        </div>
      </div>
      <HeroImage />
    </section>
  );
}

export const AutomatiserButton = (className: {className?: string}) => {
  return (
    <Link
      className={cn(
        buttonVariants({ variant: "default", size: "lg" }),
        "group w-full md:w-fit",
        {className}
      )}
      href={"/commencer"}
      title="commencer"
    >
      <WhatsAppIcon />
      Automatiser mes reponses
      <ArrowRight data-icon="inline-end" className="-translate-x-0.5 duration-150 ease-out group-hover:translate-x-0.5" />
    </Link>
  );
};