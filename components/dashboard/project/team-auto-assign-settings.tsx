"use client";

import { useId, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Shuffle, Loader2 } from "lucide-react";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { setTeamAutoAssignAction } from "@/app/actions/team-auto-assign";

const Schema = z.object({ enabled: z.boolean() });

/**
 * Répartition automatique des nouvelles conversations (offre Business),
 * enregistrée dès qu’on bascule l’interrupteur.
 */
export function TeamAutoAssignSettings({
  projectId,
  initial,
  available,
  disabled,
}: {
  projectId: string;
  initial: boolean;
  /** Offre Business : sinon l’interrupteur reste visible mais inactif. */
  available: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const [saving, setSaving] = useState(false);
  const lock = useRef(false);
  const form = useForm<z.infer<typeof Schema>>({
    resolver: zodResolver(Schema),
    defaultValues: { enabled: initial },
  });

  async function change(enabled: boolean) {
    if (lock.current) return;
    const previous = form.getValues("enabled");
    lock.current = true;
    setSaving(true);
    form.setValue("enabled", enabled);
    try {
      const result = await setTeamAutoAssignAction({ projectId, enabled });
      if (!result.success) throw new Error(result.error);
      toast.success(
        enabled
          ? "Répartition automatique activée"
          : "Répartition automatique désactivée",
      );
    } catch (error) {
      form.setValue("enabled", previous);
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
        Répartition des conversations
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Qui prend en charge les nouveaux prospects quand ils écrivent.
      </p>
      <form
        noValidate
        className="mt-5"
        onSubmit={(event) => event.preventDefault()}
        aria-busy={saving}
      >
        <Controller
          name="enabled"
          control={form.control}
          render={({ field }) => (
            <Field orientation="horizontal" className="items-start gap-4">
              <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
                <Shuffle aria-hidden="true" className="size-4" />
              </span>
              <FieldContent>
                <FieldLabel htmlFor={`${id}-switch`}>
                  Répartition automatique
                </FieldLabel>
                <FieldDescription id={`${id}-description`}>
                  {available
                    ? "Chaque nouvelle conversation est confiée au membre en ligne qui en a le moins en cours, à tour de rôle. Le propriétaire n’est pas inclus. Si personne n’est en ligne, elle reste non assignée."
                    : "Disponible avec l’offre Business : chaque nouvelle conversation est confiée au membre en ligne le moins chargé."}
                </FieldDescription>
              </FieldContent>
              <div className="flex shrink-0 items-center gap-2 pt-0.5">
                {saving && (
                  <Loader2
                    aria-hidden="true"
                    className="size-4 animate-spin text-muted-foreground motion-reduce:animate-none"
                  />
                )}
                <Switch
                  id={`${id}-switch`}
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  checked={field.value}
                  disabled={disabled || saving || !available}
                  aria-describedby={`${id}-description`}
                  onCheckedChange={(checked) => void change(checked)}
                />
              </div>
            </Field>
          )}
        />
      </form>
    </section>
  );
}
