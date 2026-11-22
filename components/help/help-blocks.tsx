import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CircleCheck,
  Clock3,
  Hand,
  Info,
  Lightbulb,
  Plus,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";

import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { helpArticleHref } from "@/lib/help-center/articles";
import type { HelpBlock, HelpSection } from "@/lib/help-center/content";
import { parseInline } from "@/lib/help-center/inline";
import { helpStepToWhatsApp } from "@/lib/help-center/markdown";
import { cn } from "@/lib/utils";

import { HelpCopyButton } from "./help-copy-button";
import { HelpFigureView } from "./help-figures";

export function HelpInline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text).map((token, index) => {
        switch (token.type) {
          case "text":
            return <span key={index}>{token.value}</span>;
          case "strong":
            return (
              <strong key={index} className="font-semibold text-foreground">
                {token.value}
              </strong>
            );
          case "ui":
            return (
              <span
                key={index}
                className="rounded-md border bg-muted px-1.5 py-px text-[0.92em] font-medium whitespace-nowrap text-foreground"
              >
                {token.value}
              </span>
            );
          case "link":
            return token.external ? (
              <a
                key={index}
                href={token.href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-foreground underline decoration-muted-foreground/50 underline-offset-4 hover:decoration-foreground"
              >
                {token.value}
                <ArrowUpRight aria-hidden="true" className="ml-0.5 inline size-3.5 align-[-2px]" />
                <span className="sr-only"> (nouvel onglet)</span>
              </a>
            ) : (
              <Link
                key={index}
                href={token.href}
                className="font-medium text-foreground underline decoration-muted-foreground/50 underline-offset-4 hover:decoration-foreground"
              >
                {token.value}
              </Link>
            );
        }
      })}
    </>
  );
}

const CALLOUT: Record<
  Extract<HelpBlock, { type: "callout" }>["tone"],
  { icon: LucideIcon; className: string; iconClassName: string }
> = {
  tip: { icon: Lightbulb, className: "border-info/30 bg-info/5", iconClassName: "text-info" },
  note: { icon: Info, className: "bg-muted/50", iconClassName: "text-muted-foreground" },
  warning: { icon: TriangleAlert, className: "border-destructive/30 bg-destructive/5", iconClassName: "text-destructive" },
  success: { icon: CircleCheck, className: "border-foreground/25 bg-muted/40", iconClassName: "text-foreground" },
};

const NEXT_ICON: Record<string, LucideIcon> = {
  reprendre: Hand,
  connaissances: BookOpen,
  equipe: Users,
};

const PROSE = "text-[15px] leading-7 text-muted-foreground";

function Block({ block }: { block: HelpBlock }) {
  switch (block.type) {
    case "p":
      return (
        <p className={PROSE}>
          <HelpInline text={block.text} />
        </p>
      );
    case "steps":
      return (
        <ol className="grid gap-3">
          {block.items.map((item, index) => (
            <li key={index} className={cn(PROSE, "flex gap-3")}>
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border bg-background font-mono text-xs font-semibold text-foreground"
              >
                {index + 1}
              </span>
              <span className="min-w-0">
                <HelpInline text={item} />
              </span>
            </li>
          ))}
        </ol>
      );
    case "bullets":
      return (
        <ul className="grid gap-2">
          {block.items.map((item, index) => (
            <li key={index} className={cn(PROSE, "flex gap-3")}>
              <span aria-hidden="true" className="mt-[11px] size-1.5 shrink-0 rounded-full bg-foreground/60" />
              <span className="min-w-0">
                <HelpInline text={item} />
              </span>
            </li>
          ))}
        </ul>
      );
    case "checklist":
      return (
        <ul className="grid gap-2.5 rounded-xl border p-4 sm:p-5">
          {block.items.map((item, index) => (
            <li key={index} className={cn(PROSE, "flex gap-3")}>
              <CircleCheck aria-hidden="true" className="mt-1 size-4 shrink-0 text-foreground" />
              <span className="min-w-0">
                <HelpInline text={item} />
              </span>
            </li>
          ))}
        </ul>
      );
    case "callout": {
      const tone = CALLOUT[block.tone];
      const Icon = tone.icon;
      return (
        <aside className={cn("flex gap-3 rounded-xl border p-4", tone.className)}>
          <Icon aria-hidden="true" className={cn("mt-1 size-4 shrink-0", tone.iconClassName)} />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{block.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              <HelpInline text={block.text} />
            </p>
          </div>
        </aside>
      );
    }
    case "example":
      return (
        <figure className="overflow-hidden rounded-xl border">
          <figcaption className="border-b bg-muted/50 px-4 py-2 text-xs font-semibold text-foreground">{block.title}</figcaption>
          <blockquote className="px-4 py-3 text-sm leading-6 text-foreground">
            <HelpInline text={block.text} />
          </blockquote>
        </figure>
      );
    case "figure":
      return (
        <figure className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
          <div className="rounded-2xl border bg-muted/30 p-3 sm:p-5">
            {/* Les maquettes sont masquées aux lecteurs d’écran : cette description les remplace. */}
            <p className="sr-only">Illustration : {block.description}</p>
            <HelpFigureView figure={block.figure} />
          </div>
          <figcaption className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
            <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            {block.caption}
          </figcaption>
        </figure>
      );
    case "table":
      return (
        <div className="grid gap-2">
          <div className="overflow-hidden rounded-xl border">
            <Table>
              <TableCaption className="sr-only">{block.caption}</TableCaption>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  {block.head.map((cell, index) => (
                    <TableHead key={index} scope="col" className={cn(index === 0 ? "w-[40%]" : "text-center")}>
                      {cell || <span className="sr-only">Critère</span>}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {block.rows.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {row.map((cell, index) =>
                      index === 0 ? (
                        <TableHead key={index} scope="row" className="font-medium whitespace-normal text-foreground">
                          {cell}
                        </TableHead>
                      ) : (
                        <TableCell
                          key={index}
                          className={cn("text-center", cell === "Non" ? "text-muted-foreground" : "text-foreground")}
                        >
                          {cell}
                        </TableCell>
                      ),
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {block.note && <p className="text-xs text-muted-foreground">{block.note}</p>}
        </div>
      );
    case "faq":
      return (
        <div className="divide-y rounded-xl border">
          {block.items.map((item) => (
            <details key={item.question} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3.5 text-sm font-semibold text-foreground outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-details-marker]:hidden">
                {item.question}
                <Plus
                  aria-hidden="true"
                  className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-45 motion-reduce:transition-none"
                />
              </summary>
              <p className="px-4 pb-4 text-sm leading-6 text-muted-foreground">
                <HelpInline text={item.answer} />
              </p>
            </details>
          ))}
        </div>
      );
    case "next":
      return (
        <ul className="grid gap-3 sm:grid-cols-3">
          {block.items.map((item) => {
            const Icon = NEXT_ICON[item.slug] ?? ArrowRight;
            return (
              <li key={item.slug}>
                <Link
                  href={helpArticleHref(item.slug)}
                  className="group flex h-full flex-col gap-2 rounded-xl border p-4 outline-none transition-colors hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Icon aria-hidden="true" className="size-4 text-foreground" />
                  <span className="text-sm font-semibold text-foreground">{item.title}</span>
                  <span className="text-xs leading-5 text-muted-foreground">{item.text}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      );
  }
}

export function HelpSectionView({ section }: { section: HelpSection }) {
  const level = section.level ?? 2;
  const headingId = section.id;
  return (
    <section aria-labelledby={headingId} className={cn("grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5", level === 2 ? "pt-6" : "pt-2")}>
      {section.step ? (
        <div className="grid gap-3 border-t pt-8">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="rounded-full bg-foreground px-2.5 py-0.5 font-mono text-xs font-semibold text-background">
              Étape {section.step.number}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock3 aria-hidden="true" className="size-3.5" />
              {section.step.duration}
            </span>
            <span className="ml-auto">
              <HelpCopyButton text={helpStepToWhatsApp(section)} label={`Étape ${section.step.number}`} />
            </span>
          </div>
          <h2 id={headingId} className="scroll-mt-24 text-2xl tracking-tight md:text-[1.75rem]">
            {section.title}
          </h2>
        </div>
      ) : level === 2 ? (
        <h2 id={headingId} className="scroll-mt-24 text-2xl tracking-tight md:text-[1.75rem]">
          {section.title}
        </h2>
      ) : (
        <h3 id={headingId} className="scroll-mt-24 text-lg tracking-tight md:text-xl">
          {section.title}
        </h3>
      )}
      {section.blocks.map((block, index) => (
        <Block key={index} block={block} />
      ))}
    </section>
  );
}
