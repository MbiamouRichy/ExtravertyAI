"use client";
import { cn } from "@/lib/utils";
import { LogoIcon } from "@/components/logo";
import { useScroll } from "@/hooks/use-scroll";
import { Button, buttonVariants } from "@/components/ui/button";
import { MobileNav } from "@/components/website/mobile-nav";
import Link from "next/link";
import { ModeToggle } from "../theming";
import { Separator } from "../ui/separator";

export const navLinks = [
  {
    label: "A propos",
    href: "/apropos",
  },
  {
    label: "Démo",
    href: "/#demo",
  },
  {
    label: "Tarifs",
    href: "/#tarifs",
  },
  {
    label: "Faq",
    href: "/#faq",
  },
  {
    label: "Contact",
    href: "/contact",
  },
];

export function Header() {
  const scrolled = useScroll(10);

  return (
    <header
      className={cn(
        "fixed left-1/2 top-2.5 -translate-x-1/2 backdrop-blur-sm supports-backdrop-filter:bg-background/50 z-50  w-full  max-w-5xl border-border border-b md:rounded-md md:border md:transition-all md:ease-out",
        {
          "md:top-3.5 md:max-w-240 md:shadow": scrolled,
        },
      )}
    >
      <nav
        className={cn(
          "flex h-14 w-full items-center justify-between px-4 md:h-12 md:transition-all md:ease-out",
          {
            "md:px-2": scrolled,
          },
        )}
      >
        <Link
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "border-border border w-auto! hover:bg-muted dark:hover:bg-muted/50",
          )}
          href="/"
        >
          <LogoIcon LogoClassName="w-6" />
          <span className="sr-only">Logo de extravertyAI</span>
        </Link>
        <div className="hidden items-center gap-2 lg:flex">
          <div>
            {navLinks.map((link) => (
              <Button asChild key={link.label} variant="ghost">
                <Link className="text-sm" href={link.href}>
                  {link.label}
                </Link>
              </Button>
            ))}
          </div>
        </div>
        <div className="hidden lg:flex flex-row justify-center gap-2 items-center">
          <ModeToggle screen="desktop" />
          <Separator orientation="vertical" className="h-6 my-auto mx-2" />
          <Button asChild variant={"outline"}>
            <Link href="/sign-in">
              Se connecter
            </Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">
              S&apos;inscrire
            </Link>
          </Button>
        </div>
        <MobileNav />
      </nav>
    </header>
  );
}
