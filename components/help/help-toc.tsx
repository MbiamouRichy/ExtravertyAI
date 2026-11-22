"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { HelpTocEntry } from "@/lib/help-center/articles";
import { cn } from "@/lib/utils";

/** Sommaire de l’article : la section lue est mise en évidence au défilement. */
export function HelpToc({ entries }: { entries: HelpTocEntry[] }) {
  const [active, setActive] = useState(entries[0]?.id);

  useEffect(() => {
    const headings = entries
      .map((entry) => document.getElementById(entry.id))
      .filter((element): element is HTMLElement => element !== null);
    if (headings.length === 0) return;
    // La dernière section passée sous l’en-tête est la section en cours.
    function update() {
      const offset = 120;
      let current = headings[0].id;
      for (const heading of headings) {
        if (heading.getBoundingClientRect().top - offset <= 0) current = heading.id;
        else break;
      }
      // Bas de page atteint : la dernière section, même courte, devient active.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4)
        current = headings[headings.length - 1].id;
      setActive(current);
    }
    let frame = 0;
    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    }
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [entries]);

  if (entries.length < 2) return null;

  return (
    <nav aria-label="Sur cette page" className="grid gap-3 text-sm">
      <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">Sur cette page</p>
      <ul className="grid gap-0.5 border-l">
        {entries.map((entry) => (
          <li key={entry.id}>
            <a
              href={`#${entry.id}`}
              aria-current={active === entry.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l-2 border-transparent py-1 pr-2 leading-snug text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                entry.level === 3 ? "pl-6 text-[13px]" : "pl-3",
                active === entry.id && "border-foreground font-medium text-foreground",
              )}
            >
              {entry.title}
            </a>
          </li>
        ))}
      </ul>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="w-fit text-muted-foreground"
        onClick={() => {
          window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
          document.getElementById("contenu")?.focus({ preventScroll: true });
        }}
      >
        <ArrowUp data-icon="inline-start" />
        Haut de page
      </Button>
    </nav>
  );
}
