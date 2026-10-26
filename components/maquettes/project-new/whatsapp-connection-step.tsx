"use client";

import { Controller, useFormContext, useWatch } from "react-hook-form";
import { m } from "motion/react";
import { getCountryCallingCode } from "libphonenumber-js/max";
import { Info, KeyRound, QrCode } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SPRING } from "@/components/website/vitrine/motion";
import { parseProjectPhone } from "@/lib/project-creation-schema";

import { CONNECTION_METHODS } from "./data";
import { PHONE_COUNTRIES } from "./phone-countries";
import type { ProjectWizardValues } from "./schema";
import { WhatsAppConnectionCard } from "./whatsapp-connection-card";

const METHOD_ICONS = { qr: QrCode, code: KeyRound } as const;

interface WhatsAppConnectionStepProps {
  connectedNumber: string | null;
  onConnectedChange: (e164: string | null) => void;
}

export function WhatsAppConnectionStep({
  connectedNumber,
  onConnectedChange,
}: WhatsAppConnectionStepProps) {
  const { control, setValue, trigger, getValues } =
    useFormContext<ProjectWizardValues>();
  const [country, numero, method] = useWatch({
    control,
    name: ["country", "numero", "connectionMethod"],
  });
  const phone = parseProjectPhone(numero, country);
  const e164 = phone?.number ?? null;

  return (
    <div className="space-y-8">
      <FieldGroup className="gap-6">
        <div className="grid gap-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
          <Controller
            name="country"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="whatsapp-country">Pays</FieldLabel>
                <Select
                  name={field.name}
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    if (getValues("numero")) void trigger("numero");
                  }}
                >
                  <SelectTrigger
                    id="whatsapp-country"
                    ref={field.ref}
                    onBlur={field.onBlur}
                    aria-invalid={fieldState.invalid}
                    className="w-full min-w-0 data-[size=default]:h-11"
                  >
                    <SelectValue placeholder="Choisir un pays" />
                  </SelectTrigger>
                  <SelectContent position="popper" className="max-h-80">
                    {PHONE_COUNTRIES.map((item) => (
                      <SelectItem
                        key={item.code}
                        value={item.code}
                        textValue={`${item.name} ${item.code} +${item.callingCode}`}
                      >
                        <span className="truncate">{item.name}</span>
                        <span className="shrink-0 text-muted-foreground tabular-nums">
                          +{item.callingCode}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          <Controller
            name="numero"
            control={control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="whatsapp-number">Numéro WhatsApp</FieldLabel>
                <InputGroup className="h-11">
                  <InputGroupAddon>
                    <InputGroupText className="font-mono tabular-nums">
                      +{getCountryCallingCode(country)}
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
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        field.onChange(international.formatNational());
                      } else {
                        field.onChange(value);
                      }
                    }}
                    id="whatsapp-number"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    maxLength={40}
                    required
                    placeholder={country === "FR" ? "06 12 34 56 78" : "Votre numéro"}
                    aria-invalid={fieldState.invalid}
                    aria-describedby="whatsapp-number-help"
                    className="text-base tabular-nums sm:text-sm"
                  />
                </InputGroup>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />
        </div>
        <FieldDescription
          id="whatsapp-number-help"
          className="-mt-3 flex gap-2 text-xs"
        >
          <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          Un numéro WhatsApp ou WhatsApp Business que vous êtes autorisé à connecter.
          Votre téléphone garde l’application : ExtravertyAI s’ajoute comme appareil lié.
        </FieldDescription>
      </FieldGroup>

      <Controller
        name="connectionMethod"
        control={control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldTitle id="connection-method-label">Méthode de connexion</FieldTitle>
            <RadioGroup
              name={field.name}
              value={field.value}
              onValueChange={field.onChange}
              aria-labelledby="connection-method-label"
              className="grid grid-cols-2 gap-1 rounded-xl border bg-muted/50 p-1"
            >
              {CONNECTION_METHODS.map((option) => {
                const checked = field.value === option.value;
                const Icon = METHOD_ICONS[option.value];
                return (
                  <div
                    key={option.value}
                    className="relative rounded-lg has-[[role=radio]:focus-visible]:ring-3 has-[[role=radio]:focus-visible]:ring-ring/50"
                  >
                    {checked && (
                      <m.span
                        layoutId="connection-method-pill"
                        transition={SPRING}
                        aria-hidden="true"
                        className="absolute inset-0 rounded-lg border bg-background shadow-xs"
                      />
                    )}
                    <RadioGroupItem
                      ref={checked ? field.ref : undefined}
                      id={`connection-${option.value}`}
                      value={option.value}
                      className="peer absolute! sr-only"
                    />
                    <FieldLabel
                      htmlFor={`connection-${option.value}`}
                      className={cn(
                        "relative flex w-full! cursor-pointer items-start gap-2.5 px-3 py-2.5 font-normal",
                        !checked && "text-muted-foreground",
                      )}
                    >
                      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{option.label}</span>
                        <span className="block text-xs text-muted-foreground max-sm:hidden">
                          {option.description}
                        </span>
                      </span>
                    </FieldLabel>
                  </div>
                );
              })}
            </RadioGroup>
          </Field>
        )}
      />

      <WhatsAppConnectionCard
        key={e164 ?? "invalid"}
        method={method}
        phoneLabel={phone?.formatInternational() ?? null}
        e164={e164}
        connected={e164 !== null && e164 === connectedNumber}
        onConnectedChange={onConnectedChange}
      />
    </div>
  );
}
