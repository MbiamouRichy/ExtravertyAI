"use client";

import { ChevronDown, Lock } from "lucide-react";

import { getInitials } from "@/components/getInitials";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ChatNotes } from "@/lib/chat";
import { ExpandableText } from "./expandable-text";
import { ScrollFadeArea } from "./scroll-fade-area";

const countLabel = (total: number) =>
  `${total} note${total > 1 ? "s" : ""} interne${total > 1 ? "s" : ""}`;

/**
 * Notes épinglées sous l’en-tête : elles restent visibles quand la conversation
 * avance, et s’ouvrent toutes d’un clic. Jamais montrées au contact.
 */
export function InternalNotesStrip({
  notes,
  formatDate,
}: {
  notes: ChatNotes;
  formatDate: (iso: string) => string;
}) {
  const latest = notes.recent[0];
  if (!latest) return null;
  const authorName = (name?: string | null) => name?.trim() || "Équipe";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          aria-label={`${countLabel(notes.total)}, voir le détail`}
          className="h-9 w-full shrink-0 justify-start gap-2 rounded-none border-b bg-muted/60 px-3 text-xs font-normal sm:px-5"
        >
          <Lock aria-hidden="true" className="size-3.5 shrink-0" />
          <span className="shrink-0 font-medium tabular-nums">
            {countLabel(notes.total)}
          </span>
          <span className="min-w-0 flex-1 truncate text-left text-muted-foreground">
            {authorName(latest.author?.name).split(" ")[0]} : {latest.content}
          </span>
          <ChevronDown aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        collisionPadding={16}
        aria-label="Notes internes de l’équipe"
        className="w-[min(24rem,calc(100vw-2rem))] p-0"
      >
        <p className="border-b px-3 py-2 text-xs text-muted-foreground">
          Visibles par l’équipe, jamais envoyées au contact.
        </p>
        <ScrollFadeArea
          label="Notes internes"
          surface="background"
          viewportClassName="max-h-72"
        >
          <ul className="divide-y">
            {notes.recent.map((note) => (
              <li key={note.id} className="flex gap-2.5 px-3 py-2.5">
                <Avatar size="sm" className="shrink-0">
                  <AvatarImage src={note.author?.image || undefined} alt="" />
                  <AvatarFallback className="text-[9px] font-semibold">
                    {getInitials(authorName(note.author?.name))}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate font-medium">
                      {authorName(note.author?.name)}
                    </span>
                    <time
                      dateTime={note.timestamp}
                      className="shrink-0 text-[11px] text-muted-foreground"
                    >
                      {formatDate(note.timestamp)}
                    </time>
                  </p>
                  <ExpandableText
                    content={note.content}
                    scrollTarget="li"
                    className="mt-0.5 text-sm"
                    toggleClassName="mt-1"
                  />
                </div>
              </li>
            ))}
          </ul>
        </ScrollFadeArea>
        {notes.total > notes.recent.length && (
          <p className="border-t px-3 py-2 text-xs text-muted-foreground">
            {notes.recent.length} notes les plus récentes sur {notes.total}.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
