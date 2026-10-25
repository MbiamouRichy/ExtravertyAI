"use client";

import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { HandHeart, Sparkles, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { EASE_OUT, Reveal } from "@/components/website/vitrine/motion";
import {
  SectionIntro,
  SectionShell,
  Serif,
} from "@/components/website/vitrine/primitives";

import { BUSINESSES, FORMATS } from "./data";

export function AboutPrinciples() {
  return (
    <SectionShell labelledBy="principes-titre">
      <SectionIntro
        index="01"
        eyebrow="Ce qui nous guide"
        titleId="principes-titre"
        title={
          <>
            Utile. Simple. <Serif>Humain.</Serif>
          </>
        }
        description="Trois principes pour qu’un outil trouve vraiment sa place dans votre activité."
      />
      <ul className="grid gap-px border-t bg-border lg:grid-cols-3">
        <Principle
          index={1}
          icon={HandHeart}
          title="Partir de votre réalité"
          text="Chaque activité a son rythme et ses questions. Nous commençons par comprendre vos échanges, pas par plaquer un script."
        >
          <ul aria-label="Exemples d’activités" className="flex flex-wrap gap-1.5">
            {BUSINESSES.map((business) => (
              <li
                key={business}
                className="rounded-full border bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
              >
                {business}
              </li>
            ))}
          </ul>
        </Principle>

        <Principle
          index={2}
          icon={Sparkles}
          title="Rendre l’IA utile"
          text="Moins de questions répétitives, des conversations regroupées. L’agent comprend vos clients comme ils écrivent vraiment."
        >
          <ul aria-label="Formats compris" className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border">
            {FORMATS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex flex-col items-center gap-2 bg-background px-2 py-3 text-center">
                <Icon aria-hidden="true" className="size-4" />
                <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground">
            Notes vocales et images selon l’offre choisie.
          </p>
        </Principle>

        <Principle
          index={3}
          icon={Users}
          title="Garder la main"
          text="L’automatisation accompagne la relation sans la remplacer. Un geste suffit pour que votre équipe reprenne la conversation."
        >
          <HandoverDemo />
        </Principle>
      </ul>
    </SectionShell>
  );
}

function Principle({
  index,
  icon: Icon,
  title,
  text,
  children,
}: {
  index: number;
  icon: typeof Users;
  title: string;
  text: string;
  children: ReactNode;
}) {
  return (
    <li className="bg-background">
      <Reveal delay={(index - 1) * 0.08} className="flex h-full flex-col gap-8 px-4 py-10 sm:px-8 lg:px-10">
        <div className="flex items-center justify-between">
          <Icon aria-hidden="true" className="size-5" />
          <span className="font-mono text-[11px] text-muted-foreground">01.{index}</span>
        </div>
        <div>
          <h3 className="font-heading text-xl font-semibold tracking-tight">{title}</h3>
          <p className="mt-2 text-sm text-pretty text-muted-foreground">{text}</p>
        </div>
        <div className="mt-auto">{children}</div>
      </Reveal>
    </li>
  );
}

/** One switch, the real gesture: pause the AI and let a person answer. */
function HandoverDemo() {
  const [aiActive, setAiActive] = useState(true);
  const id = useId();

  return (
    <div className="rounded-lg border bg-muted/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="text-xs font-medium">
          Réponses de l’IA
        </Label>
        <Switch id={id} checked={aiActive} onCheckedChange={setAiActive} />
      </div>
      <div className="mt-3 flex h-8 items-center overflow-hidden rounded-md border bg-background px-2.5">
        <AnimatePresence mode="wait" initial={false}>
          <m.p
            key={aiActive ? "ai" : "team"}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: EASE_OUT }}
            className="flex items-center gap-2 font-mono text-[11px]"
          >
            <span
              aria-hidden="true"
              className={cn("size-1.5 rounded-full", aiActive ? "bg-foreground" : "bg-muted-foreground")}
            />
            {aiActive ? "L’IA répond à vos clients" : "Votre équipe a repris la main"}
          </m.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
