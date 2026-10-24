"use client";

import type { ReactNode } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { FileText, Globe, PencilLine } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { parseProjectPhone } from "@/lib/project-creation-schema";

import {
  CONNECTION_METHODS,
  LANGUAGE_OPTIONS,
  TONE_OPTIONS,
  TRIAL_DAYS,
  type WizardStepId,
} from "./data";
import type { ProjectWizardValues } from "./schema";

interface LaunchReviewStepProps {
  connected: boolean;
  onEdit: (step: WizardStepId) => void;
}

export function LaunchReviewStep({ connected, onEdit }: LaunchReviewStepProps) {
  const { control } = useFormContext<ProjectWizardValues>();
  const [
    name,
    description,
    languageId,
    country,
    numero,
    methodId,
    agentName,
    toneId,
    useEmojis,
    humanHandover,
    sources,
  ] = useWatch({
    control,
    name: [
      "name",
      "description",
      "language",
      "country",
      "numero",
      "connectionMethod",
      "agentName",
      "tone",
      "useEmojis",
      "humanHandover",
      "sources",
    ],
  });
  const phone = parseProjectPhone(numero, country);
  const tone = TONE_OPTIONS.find((option) => option.value === toneId);
  const language = LANGUAGE_OPTIONS.find((option) => option.value === languageId);
  const method = CONNECTION_METHODS.find((option) => option.value === methodId);

  const next = [
    `Vous choisissez votre forfait : ${TRIAL_DAYS} jours offerts, sans engagement.`,
    connected
      ? "Votre numéro est déjà lié : rien d’autre à faire côté WhatsApp."
      : `Vous liez le numéro par ${method?.label.toLowerCase() ?? "QR code"} depuis votre téléphone.`,
    "L’agent répond à vos clients jour et nuit. Votre équipe reprend la main quand elle veut.",
  ];

  return (
    <div className="space-y-10">
      <div className="grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-2">
        <ReviewCell
          title="Projet"
          onEdit={() => onEdit("essentials")}
          className="sm:col-span-2"
        >
          <p className="font-heading text-xl font-semibold tracking-tight">{name}</p>
          <p className="mt-1.5 line-clamp-3 text-sm text-muted-foreground">
            {description}
          </p>
          <p className="mt-3 font-mono text-[11px] text-muted-foreground">
            Langue · <span className="text-foreground">{language?.label}</span>
          </p>
        </ReviewCell>

        <ReviewCell title="WhatsApp" onEdit={() => onEdit("whatsapp")}>
          <p className="font-mono text-base tabular-nums">
            {phone?.formatInternational() ?? numero}
          </p>
          <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 rounded-full",
                connected ? "bg-foreground" : "bg-muted-foreground/50",
              )}
            />
            {connected ? "Connecté" : `À lier après le lancement · ${method?.label}`}
          </p>
        </ReviewCell>

        <ReviewCell title="Agent IA" onEdit={() => onEdit("agent")}>
          <p className="text-base font-medium">{agentName}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {[
              `Ton ${tone?.label.toLowerCase()}`,
              humanHandover ? "Oriente vers un humain" : "Sans relais humain",
              useEmojis ? "Emojis" : "Sans emoji",
            ].map((trait) => (
              <li
                key={trait}
                className="rounded-md border bg-background px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
              >
                {trait}
              </li>
            ))}
          </ul>
        </ReviewCell>

        <ReviewCell
          title="Connaissances"
          onEdit={() => onEdit("agent")}
          className="sm:col-span-2"
        >
          {sources.length ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {sources.map((source) => {
                const Icon = source.kind === "pdf" ? FileText : Globe;
                return (
                  <li key={source.id} className="flex min-w-0 items-center gap-2 text-sm">
                    <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate" title={source.label}>
                      {source.label}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Aucun document : l’agent s’appuie sur votre description. Vous pourrez en
              ajouter à tout moment.
            </p>
          )}
        </ReviewCell>
      </div>

      <section aria-labelledby="launch-next-title">
        <h3
          id="launch-next-title"
          className="font-mono text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase"
        >
          Après le lancement
        </h3>
        <ol className="mt-4 space-y-3">
          {next.map((line, index) => (
            <li key={line} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 text-sm">
              <span
                aria-hidden="true"
                className="flex size-6 items-center justify-center rounded-full border font-mono text-[11px] tabular-nums"
              >
                {index + 1}
              </span>
              <span className="pt-0.5 text-pretty">{line}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function ReviewCell({
  title,
  onEdit,
  className,
  children,
}: {
  title: string;
  onEdit: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section aria-label={title} className={cn("min-w-0 bg-card p-5", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="font-mono text-[11px] font-medium tracking-widest text-muted-foreground uppercase">
          {title}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={onEdit}
          aria-label={`Modifier : ${title}`}
          className="-mr-1.5 text-muted-foreground"
        >
          <PencilLine data-icon="inline-start" />
          Modifier
        </Button>
      </div>
      {children}
    </section>
  );
}
