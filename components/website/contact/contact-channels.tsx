"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ArrowUpRight, Check, Clock3, Copy, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { WhatsAppIcon } from "@/components/social-icon";
import { Button } from "@/components/ui/button";
import {
  Eyebrow,
  SectionIntro,
  SectionShell,
  Serif,
} from "@/components/website/vitrine/primitives";

import {
  EMAIL,
  PHONE_DISPLAY,
  PHONE_HREF,
  TEAM_TIME_ZONE,
  WHATSAPP_CHAT_URL,
} from "./data";

export function ContactChannels() {
  return (
    <SectionShell labelledBy="canaux-titre">
      <SectionIntro
        index="01"
        eyebrow="Canaux directs"
        titleId="canaux-titre"
        title={
          <>
            Ou choisissez <Serif>votre canal.</Serif>
          </>
        }
        description="Les mêmes personnes vous répondent, quel que soit le chemin."
      />
      <div className="grid gap-px border-t bg-border lg:grid-cols-12">
        <WhatsAppTile />
        <ChannelTile
          className="lg:col-span-6"
          icon={Phone}
          label="Téléphone"
          value={PHONE_DISPLAY}
          copyValue={PHONE_DISPLAY.replace(/\s/g, "")}
          action={{ label: "Appeler", href: PHONE_HREF }}
        />
        <ChannelTile
          className="lg:col-span-3"
          icon={Mail}
          label="E-mail"
          value={EMAIL}
          copyValue={EMAIL}
          action={{ label: "Écrire", href: `mailto:${EMAIL}` }}
        />
        <TeamClock className="lg:col-span-3" />
      </div>
    </SectionShell>
  );
}

function WhatsAppTile() {
  return (
    <article
      aria-labelledby="canal-whatsapp"
      className="relative isolate flex flex-col gap-8 overflow-hidden bg-background px-4 py-10 sm:flex-row sm:items-end sm:justify-between sm:px-8 lg:col-span-6 lg:row-span-2 lg:px-12"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,color-mix(in_oklch,var(--foreground)_6%,transparent),transparent_65%)]"
      />
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <WhatsAppIcon aria-hidden="true" className="size-5" />
          </span>
          <h3 id="canal-whatsapp" className="font-heading text-xl font-semibold tracking-tight">
            WhatsApp
          </h3>
          <span className="rounded-full border px-2 py-0.5 font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
            Le plus rapide
          </span>
        </div>
        <p className="font-mono text-2xl tracking-tight tabular-nums sm:text-3xl">{PHONE_DISPLAY}</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Là où vos clients vous écrivent déjà, et là où travaillera votre agent.
        </p>
        <Button asChild size="lg" className="group w-fit">
          <a href={WHATSAPP_CHAT_URL} target="_blank" rel="noopener noreferrer">
            Ouvrir la conversation
            <ArrowUpRight
              aria-hidden="true"
              data-icon="inline-end"
              className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
            <span className="sr-only"> (nouvel onglet)</span>
          </a>
        </Button>
      </div>

      <figure className="hidden shrink-0 flex-col items-center gap-3 sm:flex">
        {/* Light tile in both themes so phone cameras read the code reliably. */}
        <div className="rounded-xl border bg-background p-3 text-foreground shadow-lg shadow-foreground/5 dark:bg-foreground dark:text-background">
          <QRCodeSVG
            value={WHATSAPP_CHAT_URL}
            level="M"
            bgColor="transparent"
            fgColor="currentColor"
            role="img"
            aria-label="QR code ouvrant la conversation WhatsApp avec ExtravertyAI"
            className="size-32"
          />
        </div>
        <figcaption className="max-w-36 text-center font-mono text-[11px] leading-snug text-muted-foreground">
          Scannez avec votre téléphone
        </figcaption>
      </figure>
    </article>
  );
}

function ChannelTile({
  icon: Icon,
  label,
  value,
  copyValue,
  action,
  className,
}: {
  icon: typeof Phone;
  label: string;
  value: string;
  copyValue: string;
  action: { label: string; href: string };
  className?: string;
}) {
  return (
    <article className={cn("flex min-w-0 flex-col gap-6 bg-background px-4 py-8 sm:px-8", className)}>
      <div className="flex items-center justify-between">
        <Icon aria-hidden="true" className="size-5" />
        <Eyebrow className="text-[11px]">{label}</Eyebrow>
      </div>
      <p className="truncate font-mono text-base tabular-nums sm:text-lg" title={value}>
        {value}
      </p>
      <div className="mt-auto flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={action.href}>{action.label}</a>
        </Button>
        <CopyButton value={copyValue} label={label} />
      </div>
    </article>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copié`);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copie indisponible : sélectionnez le texte manuellement.");
    }
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={copy} aria-label={`Copier : ${label}`}>
      {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
      {copied ? "Copié" : "Copier"}
    </Button>
  );
}

function subscribeToSeconds(onChange: () => void) {
  const id = setInterval(onChange, 1000);
  return () => clearInterval(id);
}

const nowInSeconds = () => Math.floor(Date.now() / 1000);

const timeFormat = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TEAM_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
});

/** Team local time, rendered on the client only so hydration never differs. */
function TeamClock({ className }: { className?: string }) {
  const seconds = useSyncExternalStore(subscribeToSeconds, nowInSeconds, () => null);
  const date = seconds === null ? null : new Date(seconds * 1000);
  // WAT is UTC+1 all year; getTimezoneOffset is minutes behind UTC.
  const gapHours = date === null ? null : (60 + date.getTimezoneOffset()) / 60;
  const [hours, minutes] = date ? timeFormat.format(date).split(":") : ["--", "--"];

  return (
    <article className={cn("flex min-w-0 flex-col gap-6 bg-background px-4 py-8 sm:px-8", className)}>
      <div className="flex items-center justify-between">
        <Clock3 aria-hidden="true" className="size-5" />
        <Eyebrow className="text-[11px]">Heure de l’équipe</Eyebrow>
      </div>
      <p className="font-heading text-4xl font-bold tracking-tight tabular-nums" aria-live="off">
        <span className="sr-only">Il est </span>
        {hours}
        <span aria-hidden="true" className="motion-safe:animate-pulse">:</span>
        <span className="sr-only"> heures </span>
        {minutes}
        <span className="sr-only"> au Gabon</span>
      </p>
      <p className="mt-auto font-mono text-[11px] text-muted-foreground">
        Gabon · UTC+1
        {gapHours !== null &&
          (gapHours === 0
            ? " · même heure que vous"
            : ` · ${gapHours > 0 ? "+" : "−"}${Math.abs(gapHours).toLocaleString("fr-FR")} h par rapport à vous`)}
      </p>
    </article>
  );
}
