"use client";

import { useId, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { BellRing, Loader2, Settings2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  FOLLOW_UP_DELAY_OPTIONS,
  FOLLOW_UP_LIMITS,
  FollowUpSettingsSchema,
  followUpDelayLabel,
  type FollowUpSettings,
  type FollowUpStats,
} from "@/lib/follow-ups-shared";
import { NAME_VARIABLE } from "@/lib/broadcast-shared";
import { formatDealValue } from "@/lib/pipeline-shared";
import { saveFollowUpSettingsAction } from "@/app/actions/follow-ups";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const MAX_OPTIONS = Array.from({ length: FOLLOW_UP_LIMITS.maxRelances }, (_, index) => index + 1);

function relancesLabel(count: number) {
  return `${count} relance${count > 1 ? "s" : ""}`;
}

/** Résumé lisible des règles, affiché au-dessus du tableau. */
function rulesSummary(settings: FollowUpSettings) {
  if (!settings.enabled) return "Les prospects silencieux ne sont pas relancés.";
  const stages = [
    settings.interestedDays > 0 && `« Intéressé » après ${settings.interestedDays} j`,
    settings.quoteDays > 0 && `« Devis envoyé » après ${settings.quoteDays} j`,
  ].filter(Boolean);
  const writer = settings.template ? "avec votre message" : "rédigées par l’IA";
  return `${stages.join(" · ")} · ${relancesLabel(settings.max)} au plus, ${writer}.`;
}

/**
 * Relances automatiques (Business) : résumé, suivi sur 30 jours et réglages.
 * Seuls propriétaires et administrateurs modifient ; le serveur revérifie
 * droits, offre et bornes.
 */
export function FollowUpPanel({
  projectId,
  initial,
  stats,
  currency,
  canManage,
}: {
  projectId: string;
  initial: FollowUpSettings;
  stats: FollowUpStats;
  currency: string;
  canManage: boolean;
}) {
  const id = useId();
  const [saved, setSaved] = useState(initial);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const templateRef = useRef<HTMLTextAreaElement | null>(null);
  const form = useForm<FollowUpSettings>({
    resolver: zodResolver(FollowUpSettingsSchema),
    defaultValues: initial,
  });

  function changeOpen(next: boolean) {
    if (saving) return;
    // Chaque ouverture repart des réglages enregistrés.
    if (next) form.reset(saved);
    setOpen(next);
  }

  function insertName() {
    const current = form.getValues("template");
    const area = templateRef.current;
    const start = area?.selectionStart ?? current.length;
    const end = area?.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${NAME_VARIABLE}${current.slice(end)}`.slice(
      0,
      FOLLOW_UP_LIMITS.templateMax,
    );
    form.setValue("template", next, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
    requestAnimationFrame(() => {
      const caret = Math.min(start + NAME_VARIABLE.length, next.length);
      area?.focus();
      area?.setSelectionRange(caret, caret);
    });
  }

  const submit = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      const result = await saveFollowUpSettingsAction({ projectId, settings: values });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const next = { ...values, template: values.template.trim() };
      setSaved(next);
      form.reset(next);
      setOpen(false);
      toast.success(next.enabled ? "Relances automatiques activées" : "Relances automatiques désactivées");
    } catch {
      toast.error("Impossible d’enregistrer. Réessayez.");
    } finally {
      setSaving(false);
    }
  });

  const metrics = [
    { label: "Relances envoyées", value: stats.sent.toLocaleString("fr-FR") },
    { label: "Réponses obtenues", value: stats.replied.toLocaleString("fr-FR") },
    {
      label: "Ventes après relance",
      value: stats.won.toLocaleString("fr-FR"),
      detail: stats.won > 0 ? formatDealValue(stats.wonValue, currency) : undefined,
    },
  ];

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="grid gap-4 rounded-2xl border bg-card p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-6"
    >
      <div className="flex items-start gap-3">
        <span className="hidden size-9 shrink-0 items-center justify-center rounded-lg border bg-background sm:flex">
          <BellRing aria-hidden="true" className="size-4" />
        </span>
        <div className="min-w-0">
          <h2
            id={`${id}-title`}
            className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-heading text-base font-semibold tracking-tight"
          >
            Relances automatiques
            <span className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 rounded-full",
                  saved.enabled ? "bg-primary" : "bg-muted-foreground/50",
                )}
              />
              {saved.enabled ? "Activées" : "Désactivées"}
            </span>
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{rulesSummary(saved)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end lg:gap-5">
        <dl
          aria-label="Suivi des relances sur 30 jours"
          className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border bg-border text-center sm:min-w-96"
        >
          {metrics.map((metric) => (
            <div key={metric.label} className="flex flex-col-reverse justify-end gap-0.5 bg-background px-2 py-2.5">
              <dt className="text-xs leading-tight text-muted-foreground">{metric.label}</dt>
              <dd className="font-heading text-lg font-semibold tabular-nums leading-tight">
                {metric.value}
                {metric.detail && (
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {metric.detail}
                  </span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        {canManage ? (
          <Dialog open={open} onOpenChange={changeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                <Settings2 data-icon="inline-start" />
                Configurer
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Relances automatiques</DialogTitle>
                <DialogDescription>
                  Un prospect resté silencieux est relancé une fois le délai écoulé
                  depuis le dernier échange, entre 8 h et 20 h à l’heure du projet.
                  Les relances s’arrêtent dès que le client répond ou écrit STOP,
                  que la conversation est résolue ou qu’un membre reprend la main.
                </DialogDescription>
              </DialogHeader>

              <form id={`${id}-form`} noValidate onSubmit={submit} aria-busy={saving}>
                <FieldGroup className="gap-5">
                  <Controller
                    name="enabled"
                    control={form.control}
                    render={({ field }) => (
                      <Field className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-1.5">
                        <FieldLabel
                          htmlFor={`${id}-enabled`}
                          className="col-start-1 row-start-1 min-h-6 items-center"
                        >
                          Relancer les prospects silencieux
                        </FieldLabel>
                        <span className="col-start-2 row-start-1 flex min-h-6 items-center">
                          <Switch
                            id={`${id}-enabled`}
                            name={field.name}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={saving}
                            aria-describedby={`${id}-enabled-description`}
                          />
                        </span>
                        <FieldDescription id={`${id}-enabled-description`} className="col-span-2">
                          Chaque relance consomme un message de votre quota.
                        </FieldDescription>
                      </Field>
                    )}
                  />

                  <div className="grid gap-5 sm:grid-cols-2 sm:gap-4">
                    {(
                      [
                        { name: "interestedDays", label: "Prospects « Intéressé »" },
                        { name: "quoteDays", label: "Prospects « Devis envoyé »" },
                      ] as const
                    ).map((stage) => (
                      <Controller
                        key={stage.name}
                        name={stage.name}
                        control={form.control}
                        render={({ field, fieldState }) => (
                          <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor={`${id}-${stage.name}`}>{stage.label}</FieldLabel>
                            <Select
                              name={field.name}
                              value={String(field.value)}
                              onValueChange={(value) => field.onChange(Number(value))}
                              disabled={saving}
                            >
                              <SelectTrigger
                                id={`${id}-${stage.name}`}
                                ref={field.ref}
                                onBlur={field.onBlur}
                                aria-invalid={fieldState.invalid}
                                aria-describedby={
                                  fieldState.invalid ? `${id}-${stage.name}-error` : undefined
                                }
                                className="w-full"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {FOLLOW_UP_DELAY_OPTIONS.map((days) => (
                                  <SelectItem key={days} value={String(days)}>
                                    {followUpDelayLabel(days)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {fieldState.invalid && (
                              <FieldError id={`${id}-${stage.name}-error`} errors={[fieldState.error]} />
                            )}
                          </Field>
                        )}
                      />
                    ))}
                  </div>

                  <Controller
                    name="max"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <FieldLabel htmlFor={`${id}-max`}>Relances au plus par prospect</FieldLabel>
                        <Select
                          name={field.name}
                          value={String(field.value)}
                          onValueChange={(value) => field.onChange(Number(value))}
                          disabled={saving}
                        >
                          <SelectTrigger
                            id={`${id}-max`}
                            ref={field.ref}
                            onBlur={field.onBlur}
                            aria-invalid={fieldState.invalid}
                            aria-describedby={`${id}-max-description${fieldState.invalid ? ` ${id}-max-error` : ""}`}
                            className="w-full sm:max-w-56"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MAX_OPTIONS.map((count) => (
                              <SelectItem key={count} value={String(count)}>
                                {relancesLabel(count)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FieldDescription id={`${id}-max-description`}>
                          Tant que le client ne répond pas. Sa réponse remet le compteur à zéro.
                        </FieldDescription>
                        {fieldState.invalid && (
                          <FieldError id={`${id}-max-error`} errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />

                  <Controller
                    name="template"
                    control={form.control}
                    render={({ field, fieldState }) => (
                      <Field data-invalid={fieldState.invalid}>
                        <div className="flex items-center justify-between gap-2">
                          <FieldLabel htmlFor={`${id}-template`}>Votre message (facultatif)</FieldLabel>
                          <Button
                            type="button"
                            size="xs"
                            variant="ghost"
                            onClick={insertName}
                            disabled={saving}
                          >
                            Insérer {NAME_VARIABLE}
                          </Button>
                        </div>
                        <Textarea
                          {...field}
                          ref={(element) => {
                            field.ref(element);
                            templateRef.current = element;
                          }}
                          id={`${id}-template`}
                          rows={3}
                          maxLength={FOLLOW_UP_LIMITS.templateMax}
                          disabled={saving}
                          placeholder={`Bonjour ${NAME_VARIABLE}, avez-vous pu regarder notre proposition ? Je reste disponible pour vos questions.`}
                          aria-invalid={fieldState.invalid}
                          aria-describedby={`${id}-template-description${fieldState.invalid ? ` ${id}-template-error` : ""}`}
                        />
                        <FieldDescription id={`${id}-template-description`}>
                          Laissé vide, l’IA rédige chaque relance d’après la conversation et
                          votre base de connaissances, et s’abstient quand une relance serait
                          déplacée.
                        </FieldDescription>
                        {fieldState.invalid && (
                          <FieldError id={`${id}-template-error`} errors={[fieldState.error]} />
                        )}
                      </Field>
                    )}
                  />
                </FieldGroup>
              </form>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={saving || !form.formState.isDirty}
                  onClick={() => form.reset(saved)}
                >
                  Réinitialiser
                </Button>
                <Button type="submit" form={`${id}-form`} disabled={saving || !form.formState.isDirty}>
                  {saving && (
                    <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
                  )}
                  Enregistrer
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : (
          <p className="text-xs text-muted-foreground sm:max-w-44">
            Réglées par les propriétaires et administrateurs du projet.
          </p>
        )}
      </div>
    </section>
  );
}
