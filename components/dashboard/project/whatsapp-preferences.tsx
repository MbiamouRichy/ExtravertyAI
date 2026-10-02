"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import { saveWhatsAppPreferences } from "@/app/actions/project-settings";

const schema = z.object({
  alwaysOnline: z.boolean(),
  readMessages: z.boolean(),
  typing: z.boolean(),
});
type Preferences = z.infer<typeof schema>;
const options = [
  {
    key: "alwaysOnline",
    title: "Afficher le statut en ligne",
    description:
      "Garder votre compte visible comme étant en ligne sur WhatsApp.",
  },
  {
    key: "readMessages",
    title: "Marquer les messages comme lus",
    description: "Envoyer un accusé de lecture à la réception des messages.",
  },
  {
    key: "typing",
    title: "Afficher l’indicateur de frappe",
    description:
      "Afficher une courte présence de saisie avant les envois de l’application.",
  },
] as const;

export function WhatsAppPreferences({
  projectId,
  initial,
  version,
  disabled,
  onVersionChange,
}: {
  projectId: string;
  initial: Preferences & { pending: boolean; error: string | null };
  version: number;
  disabled: boolean;
  onVersionChange: (version: number) => void;
}) {
  const router = useRouter();
  const form = useForm<Preferences>({
    resolver: zodResolver(schema),
    defaultValues: initial,
  });
  const lock = useRef(false);
  const currentVersion = useRef(version);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const { reset } = form;
  useEffect(() => {
    currentVersion.current = Math.max(currentVersion.current, version);
  }, [version]);
  useEffect(() => {
    if (!lock.current) {
      reset(initial);
    }
  }, [initial, reset]);

  async function change(key: keyof Preferences, checked: boolean) {
    if (lock.current || disabled) return;
    const previous = form.getValues();
    lock.current = true;
    setSaving(true);
    setStatus("Application du réglage…");
    form.setValue(key, checked, { shouldValidate: true });
    try {
      const values = schema.parse(form.getValues());
      const result = await saveWhatsAppPreferences({
        projectId,
        expectedVersion: currentVersion.current,
        ...values,
      });
      if (!result.success) throw new Error(result.error);
      currentVersion.current = result.version;
      onVersionChange(result.version);
      const message = result.pending
        ? "Réglage enregistré. Synchronisation WhatsApp en attente ; une nouvelle tentative sera automatique."
        : "Réglage appliqué.";
      setStatus("Réglage enregistré.");
      if (result.pending) toast.info(message);
      else toast.success(message);
    } catch (error) {
      reset(previous);
      const message =
        error instanceof Error
          ? error.message
          : "Impossible de confirmer le réglage. Réessayez.";
      setStatus(message);
      toast.error(message);
    } finally {
      lock.current = false;
      setSaving(false);
      router.refresh();
    }
  }

  return (
    <form onSubmit={(event) => event.preventDefault()} aria-busy={saving}>
      <FieldGroup className="gap-0 divide-y">
        {options.map((option) => (
          <Controller
            key={option.key}
            name={option.key}
            control={form.control}
            render={({ field, fieldState }) => (
              <Field
                orientation="horizontal"
                data-invalid={fieldState.invalid}
                className="justify-between gap-5 py-5"
              >
                <div>
                  <FieldLabel htmlFor={`whatsapp-${option.key}`}>
                    {option.title}
                  </FieldLabel>
                  <FieldDescription id={`whatsapp-${option.key}-description`}>
                    {option.description}
                  </FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </div>
                <Checkbox
                  id={`whatsapp-${option.key}`}
                  name={field.name}
                  ref={field.ref}
                  onBlur={field.onBlur}
                  checked={field.value}
                  onCheckedChange={(checked) =>
                    void change(option.key, checked === true)
                  }
                  disabled={disabled || saving}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={`whatsapp-${option.key}-description`}
                />
              </Field>
            )}
          />
        ))}
      </FieldGroup>
      <p role="status" className="mt-3 text-sm text-muted-foreground">
        {saving
          ? status
          : initial.pending
            ? "Réglages enregistrés. Synchronisation WhatsApp en attente."
            : status ||
              "Chaque modification est enregistrée et appliquée automatiquement."}
      </p>
    </form>
  );
}
