"use client";

import { useId, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DEFAULT_HELP_FEEDBACK_FILTERS,
  HELP_FEEDBACK_PERIODS,
  HELP_FEEDBACK_STATUSES,
  helpFeedbackFiltersToSearch,
  type HelpFeedbackFilters as Filters,
} from "@/lib/help-center/feedback-shared";
import { PERIOD_LABEL } from "./feedback-labels";
import { HELP_STATUS_LABEL } from "./help-feedback-labels";

const Schema = z.object({
  vote: z.enum(["ALL", "DOWN", "UP"]),
  status: z.enum(["OPEN", "ALL", ...HELP_FEEDBACK_STATUSES]),
  article: z.string().min(1),
  period: z.enum(HELP_FEEDBACK_PERIODS),
  comments: z.enum(["all", "with"]),
});
type Values = z.infer<typeof Schema>;

/** Filtres gardés dans l’URL : la vue se partage et survit au rechargement. */
export function HelpFeedbackFilters({
  filters,
  articles,
}: {
  filters: Filters;
  articles: { slug: string; title: string }[];
}) {
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const values: Values = {
    vote: filters.vote,
    status: filters.status,
    article: filters.article,
    period: filters.period,
    comments: filters.comments,
  };
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: values, values });

  const selects: { name: keyof Values; label: string; options: (readonly [string, string])[] }[] = [
    {
      name: "vote",
      label: "Vote",
      options: [
        ["ALL", "Tous les votes"],
        ["DOWN", "Pas utile"],
        ["UP", "Utile"],
      ],
    },
    {
      name: "status",
      label: "Statut",
      options: [
        ["OPEN", "Hors archives"],
        ["ALL", "Tous les statuts"],
        ...HELP_FEEDBACK_STATUSES.map((status) => [status, HELP_STATUS_LABEL[status].label] as const),
      ],
    },
    {
      name: "article",
      label: "Article",
      options: [["ALL", "Tous les articles"], ...articles.map((article) => [article.slug, article.title] as const)],
    },
    { name: "period", label: "Période", options: Object.entries(PERIOD_LABEL) },
    {
      name: "comments",
      label: "Commentaire",
      options: [
        ["all", "Avec ou sans"],
        ["with", "Avec commentaire"],
      ],
    },
  ];

  const apply = form.handleSubmit((next) => {
    startTransition(() => {
      router.push(`/admin/aide${helpFeedbackFiltersToSearch({ ...next, page: 1 })}`, { scroll: false });
    });
  });

  const isDefault = (Object.keys(values) as (keyof Values)[]).every(
    (key) => values[key] === DEFAULT_HELP_FEEDBACK_FILTERS[key],
  );

  return (
    <form
      role="search"
      aria-label="Filtrer les avis"
      onSubmit={apply}
      noValidate
      aria-busy={pending}
      className="rounded-2xl border bg-card p-4"
    >
      <FieldGroup className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(2,minmax(0,1fr))_minmax(0,1.6fr)_repeat(2,minmax(0,1fr))_auto] lg:items-end">
        {selects.map((select) => (
          <Controller
            key={select.name}
            name={select.name}
            control={form.control}
            render={({ field }) => (
              <Field className={select.name === "article" ? "sm:col-span-2 lg:col-span-1" : undefined}>
                <FieldLabel htmlFor={`${id}-${select.name}`}>{select.label}</FieldLabel>
                <Select
                  name={field.name}
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    // Un choix dans la liste s’applique tout de suite.
                    void apply();
                  }}
                >
                  <SelectTrigger id={`${id}-${select.name}`} ref={field.ref} className="w-full">
                    <SelectValue>{select.options.find(([value]) => value === field.value)?.[1]}</SelectValue>
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
        <Button
          type="button"
          variant="outline"
          disabled={pending || isDefault}
          className="sm:col-span-2 lg:col-span-1"
          onClick={() => {
            form.reset(values);
            startTransition(() => router.push("/admin/aide", { scroll: false }));
          }}
        >
          {pending ? (
            <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />
          ) : (
            <RotateCcw data-icon="inline-start" />
          )}
          Réinitialiser
        </Button>
      </FieldGroup>
    </form>
  );
}
