import { X } from "lucide-react";

import { Reveal } from "@/components/website/vitrine/motion";
import {
  SectionIntro,
  SectionShell,
  Serif,
} from "@/components/website/vitrine/primitives";

import { COMMITMENTS } from "./data";

export function AboutCommitments() {
  return (
    <SectionShell labelledBy="garde-fous-titre">
      <SectionIntro
        index="02"
        eyebrow="Nos garde-fous"
        titleId="garde-fous-titre"
        title={
          <>
            Ce que votre agent <Serif>ne fera jamais.</Serif>
          </>
        }
        description="Ces règles font partie des consignes de chaque agent. Vous les complétez, vous ne pouvez pas les retirer."
      />
      <ol className="grid gap-px border-t bg-border sm:grid-cols-2">
        {COMMITMENTS.map(({ icon: Icon, never, instead }, index) => (
          <li key={never} className="group bg-background">
            <Reveal delay={(index % 2) * 0.08} className="flex h-full flex-col gap-10 px-4 py-10 sm:px-8 lg:px-12">
              <div className="flex items-center justify-between">
                <span className="relative flex size-10 items-center justify-center rounded-xl border">
                  <Icon aria-hidden="true" className="size-4.5" />
                  <span className="absolute -right-1.5 -bottom-1.5 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <X aria-hidden="true" className="size-3" strokeWidth={3} />
                  </span>
                </span>
                <span className="font-mono text-[11px] text-muted-foreground">02.{index + 1}</span>
              </div>
              <div>
                <p className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                  Jamais
                </p>
                <h3 className="mt-2 font-heading text-xl font-semibold tracking-tight text-pretty decoration-foreground/30 decoration-2 group-hover:line-through">
                  {never}
                </h3>
                <p className="mt-3 max-w-md text-sm text-pretty text-muted-foreground">{instead}</p>
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </SectionShell>
  );
}
