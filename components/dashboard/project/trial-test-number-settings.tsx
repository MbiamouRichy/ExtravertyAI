"use client";

import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { FlaskConical, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { saveTrialTestNumber } from "@/app/actions/trial-test-number";
import { parseProjectPhone } from "@/lib/project-creation-schema";

const Schema = z.object({
  number: z
    .string()
    .trim()
    .min(1, "Saisissez votre numéro de test.")
    .max(40, "Numéro trop long.")
    .refine(
      (value) => !!parseProjectPhone(value.startsWith("+") ? value : `+${value}`),
      "Saisissez un numéro international valide, indicatif compris.",
    ),
});
type Values = z.infer<typeof Schema>;

/** Numéro seul autorisé à écrire au projet et à recevoir ses messages pendant l'essai. */
export function TrialTestNumberSettings({
  projectId,
  initial,
  disabled,
}: {
  projectId: string;
  initial: { number: string | null; changesLeft: number };
  disabled?: boolean;
}) {
  const id = useId();
  const [saved, setSaved] = useState(initial);
  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: { number: saved.number ? `+${saved.number}` : "" },
  });
  const locked = !!saved.number && saved.changesLeft <= 0;

  async function submit(values: Values) {
    const result = await saveTrialTestNumber({ projectId, number: values.number });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    const number = parseProjectPhone(
      values.number.startsWith("+") ? values.number : `+${values.number}`,
    )!.number;
    setSaved({ number: number.slice(1), changesLeft: result.changesLeft });
    form.reset({ number });
    toast.success("Numéro de test enregistré. Écrivez à votre WhatsApp professionnel depuis ce numéro.");
  }

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="rounded-2xl border border-primary/30 bg-card p-4 sm:p-6"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background">
          <FlaskConical aria-hidden="true" className="size-4" />
        </span>
        <h2
          id={`${id}-title`}
          className="min-w-0 font-heading text-lg font-semibold tracking-tight"
        >
          Numéro de test de l’essai
        </h2>
      </div>
      <p className="mt-3 text-sm leading-6 text-pretty text-muted-foreground">
            Pendant l’essai, l’assistant, votre équipe et les diffusions
            n’échangent qu’avec ce numéro : les messages des autres numéros
            sont ignorés et les exports sont fermés. Tout s’ouvre dès le premier
            paiement.
          </p>
      <form
        noValidate
        className="mt-5"
        onSubmit={form.handleSubmit(submit)}
        aria-busy={form.formState.isSubmitting}
      >
        <FieldGroup>
          <Controller
            name="number"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${id}-number`}>
                  Votre numéro WhatsApp personnel
                </FieldLabel>
                <Input
                  {...field}
                  id={`${id}-number`}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="+241 66 12 34 56"
                  aria-invalid={fieldState.invalid}
                  aria-describedby={`${id}-description`}
                  disabled={disabled || locked || form.formState.isSubmitting}
                />
                <FieldDescription id={`${id}-description`}>
                  {locked
                    ? "Vous avez utilisé tous les changements autorisés pendant l’essai."
                    : saved.number
                      ? `Indicatif compris. Encore ${saved.changesLeft} changement${saved.changesLeft > 1 ? "s" : ""} possible${saved.changesLeft > 1 ? "s" : ""} pendant l’essai.`
                      : "Indicatif compris, différent de votre WhatsApp professionnel."}
                </FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              disabled={
                disabled ||
                locked ||
                form.formState.isSubmitting ||
                !form.formState.isDirty
              }
            >
              {form.formState.isSubmitting && (
                <Loader2 aria-hidden="true" className="size-4 animate-spin" />
              )}
              {saved.number ? "Changer de numéro" : "Enregistrer le numéro"}
            </Button>
            {form.formState.isDirty && (
              <Button
                type="button"
                variant="outline"
                disabled={form.formState.isSubmitting}
                onClick={() => form.reset()}
              >
                Annuler
              </Button>
            )}
          </div>
        </FieldGroup>
      </form>
    </section>
  );
}
