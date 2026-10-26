"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";
import { AnimatePresence, m } from "motion/react";
import { FolderPen, Languages, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EASE_OUT } from "@/components/website/vitrine/motion";

import { DESCRIPTION_EXAMPLES, LANGUAGE_OPTIONS } from "./data";
import type { ProjectWizardValues } from "./schema";

export function ProjectEssentialsStep() {
  const { control, setValue } = useFormContext<ProjectWizardValues>();
  const [description, language] = useWatch({
    control,
    name: ["description", "language"],
  });
  const languageHint = LANGUAGE_OPTIONS.find(
    (option) => option.value === language,
  )?.hint;

  return (
    <FieldGroup className="gap-7">
      <Controller
        name="name"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="project-name">Nom du projet</FieldLabel>
            <InputGroup className="h-11">
              <InputGroupAddon>
                <FolderPen aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                {...field}
                id="project-name"
                type="text"
                autoComplete="organization"
                maxLength={80}
                required
                placeholder="Ex. Maison Luma"
                aria-invalid={fieldState.invalid}
                aria-describedby="project-name-help"
                className="text-base sm:text-sm"
              />
              <InputGroupAddon align="inline-end">
                <InputGroupText aria-hidden="true" className="font-mono text-xs tabular-nums">
                  {field.value.length}/80
                </InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            {fieldState.invalid ? (
              <FieldError id="project-name-help" errors={[fieldState.error]} />
            ) : (
              <FieldDescription id="project-name-help">
                Le nom affiché à vos clients dans les réponses de l’agent.
              </FieldDescription>
            )}
          </Field>
        )}
      />

      <Controller
        name="description"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="project-description">
              Votre activité en quelques mots
            </FieldLabel>
            <InputGroup>
              <InputGroupTextarea
                {...field}
                id="project-description"
                rows={4}
                maxLength={500}
                required
                placeholder="Ce que vous vendez, où, et ce que vos clients demandent le plus souvent."
                aria-invalid={fieldState.invalid}
                aria-describedby="project-description-help"
                className="min-h-28 text-base sm:text-sm"
              />
              <InputGroupAddon align="block-end" className="justify-between border-t">
                <InputGroupText className="text-xs">
                  <Sparkles aria-hidden="true" className="size-3.5" />
                  Lu par l’agent avant chaque réponse
                </InputGroupText>
                <InputGroupText aria-hidden="true" className="font-mono text-xs tabular-nums">
                  {field.value.length}/500
                </InputGroupText>
              </InputGroupAddon>
            </InputGroup>
            {fieldState.invalid ? (
              <FieldError id="project-description-help" errors={[fieldState.error]} />
            ) : (
              <FieldDescription id="project-description-help">
                Entre 20 et 500 caractères. Vous pourrez la détailler plus tard.
              </FieldDescription>
            )}

            <AnimatePresence initial={false}>
              {!description.trim() && (
                <m.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: EASE_OUT }}
                  className="overflow-hidden"
                >
                  <div
                    role="group"
                    aria-label="Exemples de description"
                    className="flex flex-wrap items-center gap-1.5 pt-1"
                  >
                    <span className="mr-1 font-mono text-[11px] text-muted-foreground">
                      Partir d’un exemple :
                    </span>
                    {DESCRIPTION_EXAMPLES.map((example) => (
                      <Button
                        key={example.label}
                        type="button"
                        variant="outline"
                        size="xs"
                        onClick={() =>
                          setValue("description", example.text, {
                            shouldDirty: true,
                            shouldTouch: true,
                            shouldValidate: true,
                          })
                        }
                      >
                        {example.label}
                      </Button>
                    ))}
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </Field>
        )}
      />

      <Controller
        name="language"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="project-language">Langue principale</FieldLabel>
            <Select
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
            >
              <SelectTrigger
                id="project-language"
                ref={field.ref}
                onBlur={field.onBlur}
                aria-invalid={fieldState.invalid}
                aria-describedby="project-language-help"
                className="w-full justify-start data-[size=default]:h-11 *:data-[slot=select-value]:flex-1 sm:max-w-xs"
              >
                <Languages aria-hidden="true" className="text-muted-foreground" />
                <SelectValue placeholder="Choisir une langue" />
              </SelectTrigger>
              <SelectContent position="popper">
                {LANGUAGE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldState.invalid ? (
              <FieldError id="project-language-help" errors={[fieldState.error]} />
            ) : (
              <FieldDescription id="project-language-help">{languageHint}</FieldDescription>
            )}
          </Field>
        )}
      />
    </FieldGroup>
  );
}
