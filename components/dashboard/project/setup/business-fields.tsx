"use client";
import { Controller, useFieldArray, type Control } from "react-hook-form";
import { Building2, Globe, Link2, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FacebookIcon, InstagramIcon, WhatsAppIcon } from "@/components/social-icon";
import { ProjectLogoSettings } from "@/components/dashboard/project/project-logo-settings";
import {
  AUTOMATION_GOALS,
  BUSINESS_LIMITS,
  BUSINESS_SECTORS,
  socialNetwork,
  type BusinessProfileInput,
} from "@/lib/business-profile";

type Props = { control: Control<BusinessProfileInput> };

const OPTION_CARD =
  "w-full! min-w-0 cursor-pointer rounded-xl border p-3 font-normal transition-colors hover:bg-muted/40 has-data-[state=checked]:border-primary has-data-[state=checked]:bg-muted/50";

function Counter({ id, value, max }: { id: string; value: number; max: number }) {
  return (
    <p id={id} className="ml-auto shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
      {value.toLocaleString("fr-FR")} / {max.toLocaleString("fr-FR")}
    </p>
  );
}

/**
 * Écran 1 : qui est l’entreprise, et où la trouver en ligne. Le logo s’envoie
 * dès qu’il est choisi (contrôlé côté serveur) : il ne dépend pas du formulaire.
 */
export function CompanyFields({
  control,
  projectId,
  companyName,
  logoUrl,
}: Props & { projectId: string; companyName: string; logoUrl: string | null }) {
  return (
    <>
      <ProjectLogoSettings projectId={projectId} name={companyName} logoUrl={logoUrl} optional />

      <Controller
        name="companyName"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="business-name">Nom de l’entreprise</FieldLabel>
            <InputGroup className="h-11">
              <InputGroupInput
                {...field}
                id="business-name"
                autoComplete="organization"
                maxLength={BUSINESS_LIMITS.nameMax}
                aria-invalid={fieldState.invalid}
                aria-describedby="business-name-error"
                placeholder="Ex. Boutique Awa"
              />
              <InputGroupAddon align="inline-start">
                <Building2 />
              </InputGroupAddon>
            </InputGroup>
            <FieldError id="business-name-error" errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="sector"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="business-sector">Secteur d’activité</FieldLabel>
            <Select name={field.name} value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                id="business-sector"
                ref={field.ref}
                onBlur={field.onBlur}
                aria-invalid={fieldState.invalid}
                aria-describedby="business-sector-error"
                className="h-11! w-full"
              >
                <SelectValue placeholder="Choisir un secteur" />
              </SelectTrigger>
              <SelectContent position="popper" className="max-h-72">
                {BUSINESS_SECTORS.map((sector) => (
                  <SelectItem key={sector.value} value={sector.value}>
                    {sector.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError id="business-sector-error" errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="description"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="business-description">Votre activité</FieldLabel>
            <Textarea
              {...field}
              id="business-description"
              maxLength={BUSINESS_LIMITS.descriptionMax}
              spellCheck
              autoComplete="off"
              aria-invalid={fieldState.invalid}
              aria-describedby="business-description-count business-description-error"
              placeholder="Ex. Prêt-à-porter féminin à Libreville : robes, pagnes et accessoires. Vente en boutique et en ligne, livraison en 24 h."
              className="min-h-28 resize-y text-base leading-relaxed sm:text-sm"
            />
            <div className="flex items-start justify-between gap-3">
              <FieldError id="business-description-error" errors={[fieldState.error]} />
              <Counter
                id="business-description-count"
                value={field.value.length}
                max={BUSINESS_LIMITS.descriptionMax}
              />
            </div>
          </Field>
        )}
      />

      <LinkFields control={control} />
    </>
  );
}

function NetworkIcon({ url }: { url: string }) {
  const id = socialNetwork(url)?.id;
  if (id === "facebook") return <FacebookIcon aria-hidden="true" />;
  if (id === "instagram") return <InstagramIcon aria-hidden="true" />;
  if (id === "whatsapp") return <WhatsAppIcon aria-hidden="true" />;
  return <Link2 aria-hidden="true" />;
}

/** Liens facultatifs : ils rejoignent l’entrée « Informations » des connaissances. */
function LinkFields({ control }: Props) {
  const { fields, append, remove } = useFieldArray({ control, name: "socials" });
  return (
    <FieldSet className="gap-4">
      <div className="space-y-1">
        <FieldLegend variant="label" className="mb-0">
          Présence en ligne{" "}
          <span className="font-normal text-muted-foreground">· facultatif</span>
        </FieldLegend>
        <FieldDescription>
          Ajoutée à vos connaissances : l’assistant la partage sur demande.
        </FieldDescription>
      </div>

      <Controller
        name="website"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="business-website" className="text-muted-foreground">
              Site web
            </FieldLabel>
            <InputGroup className="h-11">
              <InputGroupInput
                {...field}
                id="business-website"
                type="text"
                inputMode="url"
                autoComplete="url"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={BUSINESS_LIMITS.urlMax}
                aria-invalid={fieldState.invalid}
                aria-describedby="business-website-error"
                placeholder="maboutique.com"
              />
              <InputGroupAddon align="inline-start">
                <Globe />
              </InputGroupAddon>
            </InputGroup>
            <FieldError id="business-website-error" errors={[fieldState.error]} />
          </Field>
        )}
      />

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Réseaux sociaux</p>
        {fields.map((item, index) => (
          <Controller
            key={item.id}
            name={`socials.${index}.url`}
            control={control}
            render={({ field, fieldState }) => {
              const network = socialNetwork(field.value)?.label;
              const errorId = `business-social-${index}-error`;
              return (
                <Field data-invalid={fieldState.invalid}>
                  <InputGroup className="h-11">
                    <InputGroupInput
                      {...field}
                      type="text"
                      inputMode="url"
                      autoCapitalize="none"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={BUSINESS_LIMITS.urlMax}
                      aria-label={`Réseau social ${index + 1}`}
                      aria-invalid={fieldState.invalid}
                      aria-describedby={errorId}
                      placeholder="instagram.com/maboutique"
                    />
                    <InputGroupAddon align="inline-start">
                      <NetworkIcon url={field.value} />
                    </InputGroupAddon>
                    <InputGroupAddon align="inline-end">
                      {network && (
                        <InputGroupText className="text-xs max-[360px]:hidden">
                          {network}
                        </InputGroupText>
                      )}
                      <InputGroupButton
                        size="icon-xs"
                        aria-label={`Retirer le réseau social ${index + 1}`}
                        onClick={() => remove(index)}
                      >
                        <X />
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  <FieldError id={errorId} errors={[fieldState.error]} />
                </Field>
              );
            }}
          />
        ))}
        {fields.length < BUSINESS_LIMITS.socialsMax && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ url: "" })}
          >
            <Plus data-icon="inline-start" />
            Réseau social
          </Button>
        )}
      </div>
    </FieldSet>
  );
}

/** Écran 2 : ce que l’entreprise attend de son assistant WhatsApp. */
export function GoalsFields({ control }: Props) {
  return (
    <>
      <Controller
        name="goals"
        control={control}
        render={({ field, fieldState }) => (
          <FieldSet data-invalid={fieldState.invalid} className="gap-3">
            <FieldLegend variant="label">Objectifs</FieldLegend>
            <div className="grid gap-2 sm:grid-cols-2">
              {AUTOMATION_GOALS.map((goal, index) => {
                const id = `business-goal-${goal.value}`;
                const checked = field.value.includes(goal.value);
                return (
                  <FieldLabel key={goal.value} htmlFor={id} className={OPTION_CARD}>
                    <span className="flex w-full min-w-0 items-start gap-3">
                      <Checkbox
                        id={id}
                        ref={index === 0 ? field.ref : undefined}
                        checked={checked}
                        onBlur={field.onBlur}
                        onCheckedChange={(next) => {
                          const selected = new Set(field.value);
                          if (next === true) selected.add(goal.value);
                          else selected.delete(goal.value);
                          // Ordre stable, celui de la liste.
                          field.onChange(
                            AUTOMATION_GOALS.map((item) => item.value).filter((value) =>
                              selected.has(value),
                            ),
                          );
                        }}
                        aria-invalid={fieldState.invalid}
                        aria-describedby={`${id}-description business-goals-error`}
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{goal.label}</span>
                        <span
                          id={`${id}-description`}
                          className="mt-0.5 block text-xs leading-relaxed text-muted-foreground"
                        >
                          {goal.description}
                        </span>
                      </span>
                    </span>
                  </FieldLabel>
                );
              })}
            </div>
            <FieldError id="business-goals-error" errors={[fieldState.error]} />
          </FieldSet>
        )}
      />

      <Controller
        name="goalDetails"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="business-goal-details">
              Précisions{" "}
              <span className="font-normal text-muted-foreground">· facultatif</span>
            </FieldLabel>
            <Textarea
              {...field}
              id="business-goal-details"
              maxLength={BUSINESS_LIMITS.goalDetailsMax}
              spellCheck
              autoComplete="off"
              aria-invalid={fieldState.invalid}
              aria-describedby="business-goal-details-count business-goal-details-error"
              placeholder="Ex. Orienter vers un conseiller toute commande de plus de 100 000 FCFA."
              className="min-h-24 resize-y text-base leading-relaxed sm:text-sm"
            />
            <div className="flex items-start justify-between gap-3">
              <FieldError id="business-goal-details-error" errors={[fieldState.error]} />
              <Counter
                id="business-goal-details-count"
                value={field.value.length}
                max={BUSINESS_LIMITS.goalDetailsMax}
              />
            </div>
          </Field>
        )}
      />
    </>
  );
}
