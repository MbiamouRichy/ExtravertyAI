"use client";

import { useId, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Globe2, Loader2, LocateFixed } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserTimeZone } from "@/components/local-date";
import { setProjectTimeZoneAction } from "@/app/actions/project-time-zone";
import { BROADCAST_WINDOW } from "@/lib/broadcast-shared";
import type { TimeZoneGroup } from "@/lib/time-zones";

const Schema = z.object({
  timeZone: z.string().min(1, "Choisissez un fuseau horaire."),
});
type Values = z.infer<typeof Schema>;

const WINDOW = `${BROADCAST_WINDOW.startHour} h et ${BROADCAST_WINDOW.endHour} h`;

/** Fuseau de l’activité, enregistré dès qu’on le choisit : heures d’envoi des diffusions. */
export function ProjectTimeZoneSettings({
  projectId,
  initial,
  groups,
  disabled,
}: {
  projectId: string;
  initial: string;
  /** Built on the server: the list is identical on both sides of hydration. */
  groups: TimeZoneGroup[];
  disabled?: boolean;
}) {
  const id = useId();
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: { timeZone: initial },
  });
  const current = useWatch({ control: form.control, name: "timeZone" });
  const options = useMemo(
    () => new Map(groups.flatMap((group) => group.options.map((option) => [option.value, option] as const))),
    [groups],
  );
  // Shortcut when this device is elsewhere than the saved zone (empty during SSR).
  const deviceZone = useUserTimeZone();
  const device = deviceZone && deviceZone !== current ? options.get(deviceZone) : undefined;

  async function change(timeZone: string) {
    const previous = form.getValues("timeZone");
    if (lock.current || timeZone === previous) return;
    lock.current = true;
    setSaving(true);
    form.setValue("timeZone", timeZone, { shouldValidate: true });
    try {
      const result = await setProjectTimeZoneAction({ projectId, timeZone });
      if (!result.success) throw new Error(result.error);
      form.setValue("timeZone", result.timeZone);
      const saved = options.get(result.timeZone);
      toast.success("Fuseau horaire enregistré", {
        description: saved
          ? `Les diffusions partent entre ${WINDOW}, ${saved.label} (${saved.offset}).`
          : undefined,
      });
    } catch (error) {
      form.setValue("timeZone", previous);
      toast.error(
        error instanceof Error ? error.message : "Impossible d’enregistrer.",
      );
    } finally {
      lock.current = false;
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-2xl border bg-card p-4 sm:p-6"
    >
      <h2
        id={`${id}-title`}
        className="font-heading text-lg font-semibold tracking-tight"
      >
        Fuseau horaire
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Celui de votre activité et de vos clients, détecté à la création du projet.
      </p>
      <form
        noValidate
        className="mt-5"
        onSubmit={(event) => event.preventDefault()}
        aria-busy={saving}
      >
        <Controller
          name="timeZone"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor={`${id}-zone`}>Fuseau de l’activité</FieldLabel>
              <div className="flex min-w-0 items-center gap-2">
                <Select
                  name={field.name}
                  value={field.value}
                  disabled={disabled || saving}
                  onValueChange={(value) => void change(value)}
                >
                  <SelectTrigger
                    id={`${id}-zone`}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={`${id}-description ${id}-error`}
                    className="h-10 w-full min-w-0 sm:max-w-sm"
                  >
                    <Globe2 aria-hidden="true" className="text-muted-foreground" />
                    <SelectValue placeholder="Choisir un fuseau" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-80">
                    {groups.map((group) => (
                      <SelectGroup key={group.label}>
                        <SelectLabel>{group.label}</SelectLabel>
                        {group.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                            <span className="text-muted-foreground tabular-nums">{option.offset}</span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
                {saving && (
                  <Loader2
                    aria-hidden="true"
                    className="size-4 shrink-0 animate-spin text-muted-foreground motion-reduce:animate-none"
                  />
                )}
              </div>
              <FieldDescription id={`${id}-description`}>
                Les diffusions partent entre {WINDOW} à l’heure de ce fuseau, pour ne
                jamais déranger vos clients la nuit.
              </FieldDescription>
              <FieldError id={`${id}-error`} errors={[fieldState.error]} />
              {device && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || saving}
                  onClick={() => void change(device.value)}
                  className="h-auto min-h-9 w-full justify-start text-left whitespace-normal sm:w-fit"
                >
                  <LocateFixed aria-hidden="true" data-icon="inline-start" />
                  Utiliser celui de cet appareil : {device.label} ({device.offset})
                </Button>
              )}
            </Field>
          )}
        />
      </form>
    </section>
  );
}
