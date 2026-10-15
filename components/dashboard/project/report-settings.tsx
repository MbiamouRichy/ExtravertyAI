"use client";
import { useUserTimeZone } from "@/components/local-date";
import { reportWindow } from "@/lib/weekly-report";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { ReportSettingsSchema, type ReportSettings } from "@/lib/weekly-report";
import { saveReportSettings } from "@/app/actions/reports";

export function ReportSettingsForm({
  projectId,
  referenceDate,
  initial,
  version: initialVersion,
}: {
  projectId: string;
  referenceDate: string;
  initial: ReportSettings;
  version: number;
}) {
  const timeZone = useUserTimeZone();
  const [version, setVersion] = useState(initialVersion);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<ReportSettings>({
    resolver: zodResolver(ReportSettingsSchema),
    defaultValues: initial,
  });
  const toggles = [
    {
      name: "reportsEnabled",
      label: "Rapport hebdomadaire par e-mail",
      description:
        "Envoyé séparément à chaque Owner et Admin dont l’adresse est vérifiée.",
    },
    {
      name: "reportsSkipEmpty",
      label: "Ignorer les semaines sans activité",
      description:
        "Sans message, nouveau contact ni modification de l’agent. Le rapport reste consultable ici.",
    },
    {
      name: "reportsIncludeTips",
      label: "Inclure les pistes d’amélioration",
      description:
        "Des conseils fondés sur vos indicateurs, sans analyse du contenu des conversations.",
    },
  ] as const;
  return (
    <form
      onSubmit={form.handleSubmit((settings) =>
        startTransition(async () => {
          setError(null);
          try {
            const result = await saveReportSettings({
              projectId,
              version,
              settings,
            });
            if (!result.success) {
              setError(result.error);
              toast.error(result.error);
              return;
            }
            setVersion(result.version);
            form.reset(settings);
            toast.success("Programmation enregistrée.");
          } catch {
            const message =
              "Connexion interrompue. Actualisez la page pour vérifier l’enregistrement.";
            setError(message);
            toast.error(message);
          }
        }),
      )}
      className="space-y-6"
    >
      <FieldGroup>
        {toggles.map((item) => (
          <Controller
            key={item.name}
            name={item.name}
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <div className="flex items-center justify-between gap-4">
                  <FieldLabel htmlFor={item.name}>{item.label}</FieldLabel>
                  <Switch
                    id={item.name}
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={pending}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={`${item.name}-description`}
                  />
                </div>
                <FieldDescription id={`${item.name}-description`}>
                  {item.description}
                </FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
        ))}
        <Controller
          name="reportsHourUtc"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="reports-hour">
                Horaire hebdomadaire
              </FieldLabel>
              <Select
                value={String(field.value)}
                onValueChange={(value) => field.onChange(Number(value))}
                disabled={pending || !timeZone}
              >
                <SelectTrigger
                  id="reports-hour"
                  ref={field.ref}
                  onBlur={field.onBlur}
                  aria-invalid={fieldState.invalid}
                  aria-describedby="reports-hour-description"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 24 }, (_, hour) => (
                    <SelectItem key={hour} value={String(hour)}>
                      {timeZone
                        ? new Intl.DateTimeFormat("fr-FR", {
                            timeZone,
                            weekday: "long",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(
                            reportWindow(new Date(referenceDate), hour).next,
                          )
                        : "…"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldDescription id="reports-hour-description">
                Horaire affiché dans votre fuseau ({timeZone || "…"}) pour le
                prochain envoi. Il peut évoluer lors d’un changement d’heure.
              </FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending || !form.formState.isDirty}>
          {pending ? "Enregistrement…" : "Enregistrer"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending || !form.formState.isDirty}
          onClick={() => {
            form.reset();
            setError(null);
          }}
        >
          Annuler les modifications
        </Button>
      </div>
    </form>
  );
}
