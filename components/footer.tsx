"use client";
import { LogoIcon } from "@/components/logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { navLinks } from "./header";
import { FacebookIcon } from "./contact";
import { FullWidthDivider } from "./ui/full-width-divider";
import { AutomatiserButton } from "./hero";

const socialLinks = [
  {
    href: "https://www.facebook.com/profile.php?id=61576441577255",
    label: "Facebook",
    icon: <FacebookIcon />,
  },
];

export default function Footer() {
  return (
    <footer className="relative w-full max-w-7xl md:mx-auto">
      <FullWidthDivider className="-top-px" />
      <div className="flex flex-col px-2 w-full">
        <div className="md:px-6 flex flex-col gap-6 border-b py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LogoIcon LogoClassName="w-8" />
            </div>
            <div className="flex items-center">
              {socialLinks.map(({ href, label, icon }) => (
                <Button asChild key={label} size="icon-sm" variant="ghost">
                  <Link title={label} href={href}>
                    {icon}
                  </Link>
                </Button>
              ))}
            </div>
          </div>

          <nav>
            <ul className="flex flex-wrap gap-4 font-medium text-muted-foreground text-sm md:gap-6">
              {navLinks.map((link) => (
                <li key={link.label}>
                  <Link
                    title={link.label}
                    className="hover:text-foreground"
                    href={link.href}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <AutomatiserButton
          href="https://wa.me/24176205629?text=Bonjour,%20je%20veux%20automatiser%20mes%20ventes%20sur%20WhatsApp.%20Pouvez-vous%20m'accompagner%20?[CTA]"
          text="Automatiser mes réponses maintenant"
          className="h-16 w-full mt-6 mb-2"
        />
      </div>
    </footer>
  );
}
