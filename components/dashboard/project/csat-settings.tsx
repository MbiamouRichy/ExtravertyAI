"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowRight, Loader2, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { setCsatSettingsAction } from "@/app/actions/csat";

const CsatFormSchema = z.object({
  enabled: z.boolean(),
  message: z.string().trim().min(10, "Au moins 10 caractères.").max(500, "500 caractères au maximum."),
});

export function CsatSettings({
  projectId,
  initial,
}: {
  projectId: string;
  initial: { enabled: boolean; message: string; available: boolean };
}) {
  const id = useId();
  const form = useForm<z.input<typeof CsatFormSchema>, unknown, z.output<typeof CsatFormSchema>>({
    resolver: zodResolver(CsatFormSchema),
    defaultValues: { enabled: initial.enabled, message: initial.message },
  });
  const [saving, setSaving] = useState(false);
  const message = useWatch({ control: form.control, name: "message" });

  if (!initial.available) {
    return (
      <section className="rounded-2xl border bg-card p-4 sm:p-6">
        <Star aria-hidden="true" className="size-5" />
        <h2 className="mt-3 font-heading text-lg font-semibold tracking-tight">
          Le questionnaire de satisfaction est disponible avec l’offre Pro ou Business.
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Après chaque conversation résolue, vos clients notent votre service de
          1 à 5 directement dans WhatsApp. Vous suivez la note moyenne dans
          l’analytique.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={`/projects/${projectId}/billing`}>
            Voir les offres
            <ArrowRight data-icon="inline-end" />
          </Link>
        </Button>
      </section>
    );
  }

  return (
    <section aria-labelledby={`${id}-title`} className="rounded-2xl border bg-card p-4 sm:p-6">
      <h2 id={`${id}-title`} className="font-heading text-lg font-semibold tracking-tight">
        Questionnaire de satisfaction
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Envoyé automatiquement quand un membre marque une conversation comme
        résolue : au plus une fois par semaine et par client. Chaque envoi
        consomme un message de votre quota. Une réponse de 1 à 5 est enregistrée
        sans rouvrir la conversation.
      </p>
      <form
        noValidate
        className="mt-6"
        onSubmit={form.handleSubmit(async (values) => {
          setSaving(true);
          const result = await setCsatSettingsAction({ projectId, ...values });
          setSaving(false);
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          form.reset(values);
          toast.success(values.enabled ? "Questionnaire activé" : "Questionnaire désactivé");
        })}
      >
        <FieldGroup className="gap-6">
          <Controller
            name="enabled"
            control={form.control}
            render={({ field }) => (
              <Field orientation="horizontal" className="items-start justify-between gap-4">
                <FieldContent>
                  <FieldLabel htmlFor={`${id}-enabled`}>Envoyer le questionnaire à la résolution</FieldLabel>
                  <FieldDescription>Désactivé par défaut.</FieldDescription>
                </FieldContent>
                <Switch
                  id={`${id}-enabled`}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={saving}
                />
              </Field>
            )}
          />
          <Controller
            name="message"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${id}-message`}>Message envoyé au client</FieldLabel>
                <Textarea
                  {...field}
                  id={`${id}-message`}
                  rows={3}
                  maxLength={500}
                  disabled={saving}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={`${id}-message-help`}
                />
                <FieldDescription id={`${id}-message-help`}>
                  Demandez une note de 1 à 5 : c’est la seule réponse reconnue
                  (« 4 », « 4/5 », « ⭐⭐⭐⭐ »…). {message.trim().length} / 500
                </FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </FieldGroup>
        <div className="mt-6 flex justify-end gap-2">
          {form.formState.isDirty && (
            <Button type="button" variant="ghost" disabled={saving} onClick={() => form.reset()}>
              Annuler
            </Button>
          )}
          <Button type="submit" disabled={saving || !form.formState.isDirty}>
            {saving && <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
            Enregistrer
          </Button>
        </div>
      </form>
    </section>
  );
}
