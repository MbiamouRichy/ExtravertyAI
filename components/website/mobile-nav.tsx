import { cn } from "@/lib/utils";
import React from "react";
import { Portal, PortalBackdrop } from "@/components/ui/portal";
import { Button } from "@/components/ui/button";
import { navLinks } from "@/components/website/header";
import { XIcon, MenuIcon, LogIn } from "lucide-react";
import { ModeToggle } from "../theming";
import { useRouter } from "next/navigation";

export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter()
  const handleNavigation = (href: string) => {
    router.push(href)
    setOpen(false)
  }
  return (
    <div className="lg:hidden">
      <Button
        aria-controls="mobile-menu"
        aria-expanded={open}
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        className="lg:hidden"
        onClick={() => setOpen(!open)}
        size="icon"
        variant="outline"
      >
        {open ? (
          <XIcon className="size-4.5" />
        ) : (
          <MenuIcon className="size-4.5" />
        )}
      </Button>
      {open && (
        <Portal className="top-14" id="mobile-menu">
          <PortalBackdrop />
          <div
            className={cn(
              "data-[slot=open]:zoom-in-97 ease-out data-[slot=open]:animate-in",
              "size-full p-4",
            )}
            data-slot={open ? "open" : "closed"}
          >
            <div className="grid gap-y-2">
              {navLinks.map((link) => (
                <Button
                  className="justify-start"
                  key={link.label}
                  variant="ghost"
                  onClick={() => handleNavigation(link.href)}
                  title={link.label}
                >
                  {link.label}
                </Button>
              ))}
            </div>
            <div className="mt-10 flex flex-col-reverse gap-2">
              <ModeToggle screen="mobile" />
              <Button
                onClick={() => handleNavigation("/#demo")}
                className="w-full mb-10"
                variant="outline"
                title="Regarder la demo"
              >
                Regarder la demo
              </Button>
              <Button onClick={() => handleNavigation("/sign-in")} className="w-full">
                <LogIn aria-hidden="true" />
                Se connecter
              </Button>
              <Button onClick={() => handleNavigation("/sign-up")} className="w-full">
                S&apos;inscrire
              </Button>
            </div>
          </div>
        </Portal>
      )}
    </div>
  );
}
