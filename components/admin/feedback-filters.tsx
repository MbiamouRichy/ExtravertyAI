"use client";

import { useId, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, RotateCcw, Search } from "lucide-react";

import {
  DEFAULT_FEEDBACK_FILTERS,
  FEEDBACK_KINDS,
  FEEDBACK_STATUSES,
  feedbackFiltersToSearch,
  type FeedbackFilters as Filters,
} from "@/lib/admin-feedback";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KIND_LABEL, PERIOD_LABEL, STATUS_LABEL } from "./feedback-labels";

const Schema = z.object({
  q: z.string().trim().max(100, "100 caractères au maximum."),
  kind: z.enum(["ALL", ...FEEDBACK_KINDS]),
  status: z.enum(["OPEN", "ALL", ...FEEDBACK_STATUSES]),
  period: z.enum(["7", "30", "90", "365", "all"]),
});
type Values = z.infer<typeof Schema>;

const SELECTS = [
  {
    name: "status",
    label: "Statut",
    options: [
      ["OPEN", "Hors archives"],
      ["ALL", "Tous les statuts"],
      ...FEEDBACK_STATUSES.map((status) => [status, STATUS_LABEL[status].label] as const),
    ],
  },
  {
    name: "kind",
    label: "Type",
    options: [
      ["ALL", "Tous les types"],
      ...FEEDBACK_KINDS.map((kind) => [kind, KIND_LABEL[kind].label] as const),
    ],
  },
  {
    name: "period",
    label: "Période",
    options: Object.entries(PERIOD_LABEL),
  },
] as const satisfies readonly {
  name: Exclude<keyof Values, "q">;
  label: string;
  options: readonly (readonly [string, string])[];
}[];

/** Filtres gardés dans l'URL : la vue se partage et survit au rechargement. */
export function FeedbackFilters({ filters }: { filters: Filters }) {
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const values: Values = {
    q: filters.q,
    kind: filters.kind,
    status: filters.status,
    period: filters.period,
  };
  const form = useForm<Values>({
    resolver: zodResolver(Schema),
    defaultValues: values,
    values,
  });

  const apply = form.handleSubmit((next) => {
    startTransition(() => {
      router.push(
        `/admin/feedback${feedbackFiltersToSearch({ ...next, sort: filters.sort, page: 1 })}`,
        { scroll: false },
      );
    });
  });

  const isDefault =
    filters.q === "" &&
    filters.kind === DEFAULT_FEEDBACK_FILTERS.kind &&
    filters.status === DEFAULT_FEEDBACK_FILTERS.status &&
    filters.period === DEFAULT_FEEDBACK_FILTERS.period;

  return (
    <form
      role="search"
      aria-label="Filtrer les retours"
      onSubmit={apply}
      noValidate
      className="rounded-2xl border bg-card p-4"
      aria-busy={pending}
    >
      <FieldGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end">
        <Controller
          name="q"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid} className="sm:col-span-2 lg:col-span-1">
              <FieldLabel htmlFor={`${id}-q`}>Recherche</FieldLabel>
              <InputGroup>
                <InputGroupAddon>
                  <Search aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput
                  {...field}
                  id={`${id}-q`}
                  type="search"
                  inputMode="search"
                  autoComplete="off"
                  maxLength={100}
                  placeholder="Message, nom, e-mail ou projet"
                  aria-invalid={fieldState.invalid}
                />
              </InputGroup>
            </Field>
          )}
        />
        {SELECTS.map((select) => (
          <Controller
            key={select.name}
            name={select.name}
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor={`${id}-${select.name}`}>{select.label}</FieldLabel>
                <Select
                  name={field.name}
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    // Un choix dans la liste s'applique tout de suite.
                    void apply();
                  }}
                >
                  <SelectTrigger id={`${id}-${select.name}`} ref={field.ref} className="w-full">
                    {/* Libellé rendu côté serveur : pas de champ vide avant l’hydratation. */}
                    <SelectValue>
                      {select.options.find(([value]) => value === field.value)?.[1]}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {select.options.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          />
        ))}
        <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
          <Button type="submit" disabled={pending} className="flex-1 lg:flex-none">
            {pending ? (
              <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />
            ) : (
              <Search data-icon="inline-start" />
            )}
            Filtrer
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={pending || isDefault}
            onClick={() => {
              form.reset(DEFAULT_FEEDBACK_FILTERS);
              startTransition(() => router.push("/admin/feedback", { scroll: false }));
            }}
          >
            <RotateCcw data-icon="inline-start" />
            <span className="sr-only sm:not-sr-only">Réinitialiser</span>
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
