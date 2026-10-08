"use client";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { saveProjectPreferences } from "@/app/actions/project-settings";
import { useAutosave } from "@/hooks/use-autosave";
import { AutosaveStatus } from "./autosave-status";

const schema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Le nom doit contenir au moins deux caractères.")
    .max(100),
});
type Values = z.infer<typeof schema>;

export function ProjectNameForm({
  projectId,
  name,
  version,
  disabled,
  onVersionChange,
  onSavingChange,
}: {
  projectId: string;
  name: string;
  version: number;
  disabled: boolean;
  onVersionChange: (version: number) => void;
  onSavingChange: (saving: boolean) => void;
}) {
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name },
  });
  const autosave = useAutosave<Values>(
    version,
    async (values, expectedVersion) => {
      const result = await saveProjectPreferences({
        projectId,
        expectedVersion,
        ...values,
      });
      if (result.success) onVersionChange(result.version);
      return result;
    },
  );
  const saving = autosave.status === "waiting" || autosave.status === "saving";
  useEffect(() => {
    onSavingChange(saving);
  }, [saving, onSavingChange]);
  const { reset } = form;
  useEffect(() => {
    if (!autosave.queue.unsaved) reset({ name });
  }, [name, reset, autosave.queue]);

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void autosave.queue.flush();
      }}
      className="space-y-6 rounded-2xl border bg-card p-5 sm:p-7"
    >
      <div>
        <h2 className="text-lg font-semibold">Votre projet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Les informations partagées dans votre espace de travail.
        </p>
      </div>
      <FieldGroup>
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="project-name">Nom du projet</FieldLabel>
              <Input
                {...field}
                id="project-name"
                autoComplete="off"
                maxLength={100}
                disabled={disabled}
                aria-invalid={fieldState.invalid}
                aria-describedby="project-name-error"
                onBlur={() => {
                  field.onBlur();
                  void autosave.queue.flush();
                }}
                onChange={(event) => {
                  field.onChange(event);
                  const parsed = schema.safeParse({ name: event.target.value });
                  void form.trigger("name");
                  if (parsed.success) autosave.queue.schedule(parsed.data, 600);
                  else autosave.queue.invalidate();
                }}
              />
              <FieldError id="project-name-error" errors={[fieldState.error]} />
            </Field>
          )}
        />
      </FieldGroup>
      <AutosaveStatus status={autosave.status} error={autosave.error} />
    </form>
  );
}
