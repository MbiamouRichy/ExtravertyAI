"use client";
import { LogoIcon } from "@/components/logo";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { navLinks } from "./header";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { FacebookIcon } from "./contact";
import { DecorIcon } from "./ui/decor-icon";
import { FullWidthDivider } from "./ui/full-width-divider";

const socialLinks = [
  {
    href: "#",
    label: "Facebook",
    icon: <FacebookIcon />,
  },
];

export default function Footer() {
  return (
    <footer className="relative w-full ">
      <DecorIcon className="size-4" position="top-left" />
      <DecorIcon className="size-4" position="top-right" />
      <DecorIcon className="size-4" position="bottom-left" />
      <DecorIcon className="size-4" position="bottom-right" />
      <FullWidthDivider className="-top-px" />
      <div className="flex flex-col px-2 w-full">
        <div className="md:px-6 flex flex-col gap-6 py-6">
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

        <div className="md:px-6 flex flex-col md:flex-row items-center justify-center md:justify-between gap-4 border-t py-4 text-muted-foreground text-sm">
          <p>&copy; {new Date().getFullYear()} ExtravertyAI</p>

          <p className="inline-flex items-center gap-1">
            <span>Fait par</span>
            <Link
              title="Richy Mbiamou's website"
              className="inline-flex items-center gap-1 text-foreground/80 hover:text-foreground hover:underline"
              href={"https://richy-mbiamou.vercel.app/"}
              rel="noreferrer"
              target="_blank"
            >
              <Avatar>
                <AvatarImage
                  alt="Richy mbiamou' image profile"
                  src="/richy.png"
                />
                <AvatarFallback>Mb</AvatarFallback>
              </Avatar>
              Mbiamou
            </Link>
          </p>
        </div>
      </div>
      <FullWidthDivider className="-bottom-px" />
    </footer>
  );
}
