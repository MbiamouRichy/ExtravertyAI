"use client";

import { useId, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Hourglass, Loader2 } from "lucide-react";

import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { setWaitingTimeIndicatorAction } from "@/app/actions/waiting-indicator";

const Schema = z.object({ enabled: z.boolean() });

/** Interrupteur du badge « client en attente », enregistré dès qu’on le bascule. */
export function WaitingTimeSettings({
  projectId,
  initial,
  disabled,
}: {
  projectId: string;
  initial: boolean;
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
      const result = await setWaitingTimeIndicatorAction({ projectId, enabled });
      if (!result.success) throw new Error(result.error);
      toast.success(
        enabled
          ? "Temps d’attente affiché dans la messagerie"
          : "Temps d’attente masqué",
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
        Messagerie
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Indicateurs affichés à votre équipe dans la liste des conversations.
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
                <Hourglass aria-hidden="true" className="size-4" />
              </span>
              <FieldContent>
                <FieldLabel htmlFor={`${id}-switch`}>
                  Temps d’attente des clients
                </FieldLabel>
                <FieldDescription id={`${id}-description`}>
                  Affiche depuis combien de temps un client attend une réponse
                  de l’équipe, sur les conversations où l’assistant IA est en
                  pause. Le badge disparaît dès qu’un membre répond.
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
                  disabled={disabled || saving}
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
