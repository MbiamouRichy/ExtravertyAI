import { cn } from "@/lib/utils";

import { Button, buttonVariants } from "@/components/ui/button";
import { ArrowRight, ArrowRightIcon, StarIcon, Video } from "lucide-react";

import Link from "next/link";
import HeroImage, { WhatsAppIcon } from "./heroImage";
import { VariantProps } from "class-variance-authority";
import { Separator } from "./ui/separator";

export function HeroSection() {
  return (
    <section className="relative w-full">
      <div className="flex flex-col max-w-5xl mx-auto items-center justify-center gap-5 px-2 pt-20 pb-8 md:px-4 md:py-24 lg:py-28">
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
            "group mx-auto text-xs hidden md:flex w-fit items-center gap-3 rounded-sm border bg-card p-1 shadow",
            "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards transition-all delay-500 duration-500 ease-out",
          )}
          href="https://wa.me/24176205629?text=Bonjour,%20Pouvez-vous%20m'expliquer%20la%20mise%20en%20place%20?"

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
            " text-balance text-center ",
            "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-100 duration-500 ease-out",
          )}
        >
          Automatisez vos réponses WhatsApp et ne perdez plus aucun client
        </h1>

        <p
          className={cn(
            "text-center md:max-w-prose text-muted-foreground text-sm tracking-wider md:text-base",
            "fade-in slide-in-from-bottom-10 animate-in fill-mode-backwards delay-200 duration-500 ease-out",
          )}
        >
          ExtravertyAI répond automatiquement à vos messages WhatsApp, qualifie
          vos prospects et transforme chaque conversation en opportunité de
          vente — même quand vous dormez.
        </p>

        <div className="fade-in slide-in-from-bottom-10 flex flex-col-reverse md:flex-row md:w-fit w-full animate-in items-center justify-center gap-3 fill-mode-backwards pt-2 delay-300 duration-500 ease-out">
          <Button
            asChild
            className="w-full md:w-auto"
            size={"lg"}
            variant="outline"
          >
            <Link href="/#demo" title="demo">
              <Video data-icon="inline-start" /> Regarder la démo
            </Link>
          </Button>
          <AutomatiserButton className="w-full md:w-fit" />
        </div>

        <div className="flex flex-col md:flex-row w-full md:justify-center md:items-center gap-4">
          <p className="text-muted-foreground text-sm">
            <span className="text-primary font-bold">+1000</span> messages{" "}
            <br className="hidden md:inline" />
            automatisés par jour
          </p>
          <Separator
            orientation="vertical"
            className="hidden md:block h-8 my-auto"
          />
          <Separator
            orientation="horizontal"
            className="block md:hidden w-11/12! mx-auto"
          />
          <p className="text-muted-foreground text-sm">
            <span className="text-primary font-bold">+32%</span> de prospects{" "}
            {""}
            <br className="hidden md:inline" />
            captés
          </p>
          <Separator
            orientation="vertical"
            className="hidden md:block h-8 my-auto"
          />
          <Separator
            orientation="horizontal"
            className="block md:hidden w-11/12! mx-auto"
          />

          <p className="text-muted-foreground flex flex-row w-auto md:flex-col gap-0.5 text-sm">
            <span>Recommandé 5/5 </span>
            <span className="inline-flex md:w-full items-center">
              {[...Array(5)].map((_, idx) => (
                <StarIcon
                  key={idx}
                  className="w-4 md:w-1/5 fill-yellow-400 text-yellow-400 drop-shadow-sm"
                />
              ))}
            </span>
          </p>
        </div>
      </div>
      <HeroImage />
    </section>
  );
}
type AutomatiserButtonProps = {
  className?: string;
  text?: string;
  href?: string;
  target?: string;
  variant?: VariantProps<typeof buttonVariants>["variant"];
};

export const AutomatiserButton = ({
  className,
  variant = "default",
  text = "Automatiser mes réponses",
  href = "https://wa.me/24176205629?text=Bonjour,%20Pouvez-vous%20m'expliquer%20la%20mise%20en%20place%20?",
  target = "_self",
}: AutomatiserButtonProps) => {
  return (
    <Link
      href={href}
      title={text}
      target={target}
      className={cn(
        buttonVariants({ variant, size: "lg" }),
        "group",
        className,
      )}
    >
      <WhatsAppIcon />
      {text}
      <ArrowRight
        data-icon="inline-end"
        className="-translate-x-0.5 duration-150 ease-out group-hover:translate-x-0.5"
      />
    </Link>
  );
};
