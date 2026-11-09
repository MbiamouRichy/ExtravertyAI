"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { getCountries, getCountryCallingCode } from "libphonenumber-js/max";
import { ArrowLeft, ArrowRight, Check, ChevronDown } from "lucide-react";

import { createProjectAndCheckout } from "@/app/actions/checkout-actions";
import {
  NumberVerification,
  toCheckoutAttempt,
} from "@/components/dashboard/project/number-verification";
import { Badge } from "@/components/ui/badge";
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
} from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ProjectCreationFormSchema,
  parseProjectPhone,
  type ProjectCreationFormValues,
} from "@/lib/project-creation-schema";
import {
  PRICING_PLANS as PLANS,
  PLAN_CAPABILITIES,
  formatMessageLimit,
  formatPlanPrice,
  type PlanId,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

// Trial terms enforced server-side (lib/polar trial_interval_count, billing-quota,
// trial-eligibility: one trial per WhatsApp number).
const TRIAL_DAYS = 10;
const TRIAL_MESSAGES = 150;

const countryNames = new Intl.DisplayNames(["fr"], { type: "region" });
const phoneCountries = getCountries()
  .map((code) => ({
    code,
    name: countryNames.of(code) ?? code,
    callingCode: getCountryCallingCode(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "fr"));

export default function CreateProjectForm({
  initialPlan = "starter",
}: {
  initialPlan?: PlanId;
}) {
  const [showFeatures, setShowFeatures] = useState(false);
  // Deux étapes : les informations du projet, puis la preuve du numéro.
  // Rien n’est enregistré avant le bon code.
  const [step, setStep] = useState<"details" | "verify">("details");
  // Numéro à prouver (E.164) et sa forme lisible. Le même numéro garde son
  // code et son compte à rebours si l’utilisateur revient sur le formulaire.
  const [verifyFor, setVerifyFor] = useState<{
    numero: string;
    display: string;
  } | null>(null);

  const { control, trigger, setValue, setFocus, watch, getValues, handleSubmit } =
    useForm<ProjectCreationFormValues>({
      resolver: zodResolver(ProjectCreationFormSchema),
      mode: "onTouched",
      reValidateMode: "onChange",
      defaultValues: { name: "", numero: "", country: "FR", plan: initialPlan },
    });

  const selectedCountry = watch("country");
  const selectedPlan =
    PLANS.find((plan) => plan.id === watch("plan")) ?? PLANS[0];

  function onSubmit(values: ProjectCreationFormValues) {
    const phone = parseProjectPhone(values.numero, values.country)!;
    setVerifyFor((current) =>
      current?.numero === phone.number
        ? current
        : { numero: phone.number, display: phone.formatInternational() },
    );
    setStep("verify");
    window.scrollTo({ top: 0 });
  }

  function editNumber() {
    setStep("details");
    // Le champ réapparaît au rendu suivant.
    window.requestAnimationFrame(() => setFocus("numero", { shouldSelect: true }));
  }

  async function saveAndCheckout(
    verificationId: string | undefined,
    withoutTrial: boolean,
  ) {
    const values = getValues();
    return toCheckoutAttempt(
      await createProjectAndCheckout(
        { name: values.name, numero: verifyFor!.numero, plan: values.plan },
        { withoutTrial, verificationId },
      ),
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
      {step === "verify" ? (
        // Le projet n’est pas encore enregistré : on revient au formulaire, pas à la liste.
        <Button
          type="button"
          variant="link"
          className="-ml-1 h-auto min-h-11 gap-2 px-1 text-muted-foreground hover:text-foreground hover:no-underline"
          onClick={() => setStep("details")}
        >
          <ArrowLeft aria-hidden className="size-4" />
          Retour
        </Button>
      ) : (
        <Link
          href="/projects"
          className="-ml-1 inline-flex min-h-11 items-center gap-2 rounded-md px-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Mes projets
        </Link>
      )}

      <header hidden={step !== "details"} className="mt-4 mb-8">
        <h1 className="text-2xl! font-semibold! leading-tight! tracking-tight! sm:text-3xl!">
          Créer un projet
        </h1>
        <p className="mt-2 text-muted-foreground">
          {`${TRIAL_DAYS} jours offerts, sans engagement. Un essai par numéro WhatsApp.`}
        </p>
      </header>

      {verifyFor && (
        // Gardé monté quand on revient au formulaire : le même numéro conserve son code.
        <div hidden={step !== "verify"} className="mt-4">
          <NumberVerification
            key={verifyFor.numero}
            target={{ numero: verifyFor.numero }}
            number={verifyFor.display}
            onContinue={saveAndCheckout}
            onEditNumber={editNumber}
            headingLevel="h1"
          />
        </div>
      )}

      <form
        noValidate
        hidden={step !== "details"}
        aria-label="Créer un projet"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-8"
      >
        <fieldset className="min-w-0">
          <legend className="sr-only">Informations du projet</legend>
          <FieldGroup className="gap-6">
            <Controller
              name="name"
              control={control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="project-name">Nom du projet</FieldLabel>
                  <Input
                    {...field}
                    id="project-name"
                    type="text"
                    autoComplete="off"
                    maxLength={80}
                    required
                    placeholder="Ex. Service client"
                    aria-invalid={fieldState.invalid}
                    className="h-11 text-base sm:text-sm"
                  />
                  {fieldState.invalid && (
                    <FieldError errors={[fieldState.error]} />
                  )}
                </Field>
              )}
            />

            <div className="grid gap-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
              <Controller
                name="country"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="project-phone-country">
                      Pays
                    </FieldLabel>
                    <Select
                      name={field.name}
                      value={field.value}
                      onValueChange={(value) => {
                        field.onChange(value);
                        if (watch("numero")) void trigger("numero");
                      }}
                    >
                      <SelectTrigger
                        id="project-phone-country"
                        ref={field.ref}
                        onBlur={field.onBlur}
                        aria-invalid={fieldState.invalid}
                        className="w-full min-w-0 data-[size=default]:h-11"
                      >
                        {/* L’indicatif figure déjà dans le champ du numéro. */}
                        <SelectValue placeholder="Choisir un pays">
                          <CountryFlag code={field.value} />
                          <span className="truncate">
                            {countryNames.of(field.value) ?? field.value}
                          </span>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent
                        position="popper"
                        align="start"
                        // Largeur bornée : les noms longs sont tronqués, jamais
                        // l’indicatif, et la liste ne dépasse pas de l’écran.
                        className="max-h-80 w-(--radix-select-trigger-width) min-w-[min(18rem,calc(100vw-2rem))] max-w-[calc(100vw-2rem)]"
                      >
                        {phoneCountries.map((country) => (
                          <SelectItem
                            key={country.code}
                            value={country.code}
                            textValue={`${country.name} ${country.code} +${country.callingCode}`}
                            className="min-h-10 *:[span]:last:w-full *:[span]:last:min-w-0"
                          >
                            <CountryFlag code={country.code} />
                            <span className="min-w-0 truncate">
                              {country.name}
                            </span>
                            <span className="ml-auto shrink-0 text-muted-foreground tabular-nums">
                              +{country.callingCode}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <Controller
                name="numero"
                control={control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="project-phone">
                      Numéro WhatsApp
                    </FieldLabel>
                    <InputGroup className="h-11">
                      <InputGroupAddon>
                        <InputGroupText className="tabular-nums">
                          +{getCountryCallingCode(selectedCountry)}
                        </InputGroupText>
                      </InputGroupAddon>
                      <InputGroupInput
                        {...field}
                        onChange={(event) => {
                          const value = event.target.value;
                          // Pasting +33… switches the country automatically.
                          const international = value.trim().startsWith("+")
                            ? parseProjectPhone(value)
                            : undefined;
                          if (international?.country) {
                            setValue("country", international.country, {
                              shouldValidate: true,
                              shouldDirty: true,
                            });
                            field.onChange(international.formatNational());
                          } else {
                            field.onChange(value);
                          }
                        }}
                        id="project-phone"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel-national"
                        maxLength={40}
                        required
                        placeholder={
                          selectedCountry === "FR"
                            ? "06 12 34 56 78"
                            : "Votre numéro"
                        }
                        aria-invalid={fieldState.invalid}
                        aria-describedby="project-phone-help"
                        className="text-base tabular-nums sm:text-sm"
                      />
                    </InputGroup>
                    <FieldDescription id="project-phone-help">
                      Vous le vérifierez à l’étape suivante, avec WhatsApp.
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />
            </div>
          </FieldGroup>
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="mb-3 text-sm font-medium">Forfait</legend>
          <Controller
            name="plan"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <RadioGroup
                  name={field.name}
                  value={field.value}
                  onValueChange={field.onChange}
                  aria-label="Forfait mensuel"
                  aria-invalid={fieldState.invalid}
                  className="gap-0 divide-y rounded-xl border"
                >
                  {PLANS.map((plan) => {
                    const checked = field.value === plan.id;
                    return (
                      <FieldLabel
                        key={plan.id}
                        htmlFor={`plan-${plan.id}`}
                        className={cn(
                          "flex w-full! cursor-pointer items-center gap-3 p-4 font-normal transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-muted/50",
                          checked && "bg-muted/50",
                        )}
                      >
                        <RadioGroupItem
                          ref={checked ? field.ref : undefined}
                          id={`plan-${plan.id}`}
                          value={plan.id}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            {plan.name}
                            {plan.highlighted && (
                              <Badge
                                variant="secondary"
                                className="font-normal"
                              >
                                Populaire
                              </Badge>
                            )}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground tabular-nums">
                            {formatMessageLimit(plan.messageLimit)} messages ·{" "}
                            {plan.users} membres
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-sm font-medium tabular-nums">
                          {formatPlanPrice(plan.priceCents)}
                          <span className="block text-xs font-normal text-muted-foreground">
                            / mois
                          </span>
                        </span>
                      </FieldLabel>
                    );
                  })}
                </RadioGroup>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-mx-2 mt-2 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
            aria-expanded={showFeatures}
            aria-controls="plan-features"
            onClick={() => setShowFeatures((current) => !current)}
          >
            Inclus dans {selectedPlan.name}
            <ChevronDown
              data-icon="inline-end"
              className={cn(
                "transition-transform motion-reduce:transition-none",
                showFeatures && "rotate-180",
              )}
            />
          </Button>
          <ul
            id="plan-features"
            hidden={!showFeatures}
            aria-label={`Fonctionnalités du forfait ${selectedPlan.name}`}
            className="mt-2 grid gap-2 sm:grid-cols-2 sm:gap-x-6"
          >
            {PLAN_CAPABILITIES[selectedPlan.id].map((feature) => (
              <li
                key={feature}
                className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"
              >
                <Check
                  aria-hidden="true"
                  className="mt-1 size-3 shrink-0 text-foreground"
                  strokeWidth={2.5}
                />
                {feature}
              </li>
            ))}
          </ul>
        </fieldset>

        <div className="space-y-4 border-t pt-6">
          <div>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-sm font-medium">À payer aujourd’hui</span>
              <span className="text-2xl font-semibold tracking-tight tabular-nums">
                {formatPlanPrice(0)}
              </span>
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Essai de {TRIAL_DAYS} jours limité à {TRIAL_MESSAGES} messages,
              puis {formatPlanPrice(selectedPlan.priceCents)} / mois. Résiliable
              avant la fin de l’essai.
            </p>
          </div>

          <Button type="submit" size="lg" className="h-11 w-full">
            Vérifier mon numéro
            <ArrowRight aria-hidden data-icon="inline-end" />
          </Button>
        </div>
      </form>
    </div>
  );
}

// Fichiers locaux : Windows n’affiche pas les emojis de drapeaux.
function CountryFlag({ code }: { code: string }) {
  return (
    <Image
      src={`/flags/${code}.svg`}
      alt=""
      width={21}
      height={14}
      unoptimized
      className="h-3.5 w-[21px] shrink-0 rounded-xs object-cover ring-1 ring-border"
    />
  );
}
