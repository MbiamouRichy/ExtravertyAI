"use client";

import { useId, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, RotateCcw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

const SEARCH_MAX = 100;
const Schema = z.object({
  q: z.string().trim().max(SEARCH_MAX, `${SEARCH_MAX} caractères au maximum.`),
});
type Values = z.infer<typeof Schema>;

/** Recherche gardée dans l'URL : la liste survit au rechargement et se partage. */
export function BillingProjectSearch({ query }: { query: string }) {
  const id = useId();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const values: Values = { q: query };
  const form = useForm<Values>({ resolver: zodResolver(Schema), defaultValues: values, values });

  function go(q: string) {
    startTransition(() => {
      router.push(q ? `/admin/paiements?q=${encodeURIComponent(q)}` : "/admin/paiements", {
        scroll: false,
      });
    });
  }
  const apply = form.handleSubmit((next) => go(next.q));

  return (
    <form
      role="search"
      aria-label="Rechercher un projet"
      onSubmit={apply}
      noValidate
      aria-busy={pending}
      className="flex flex-col gap-2 sm:flex-row sm:items-end"
    >
      <Controller
        name="q"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid} className="min-w-0 flex-1">
            <FieldLabel htmlFor={`${id}-q`} className="sr-only">
              Projet, e-mail du propriétaire ou numéro WhatsApp
            </FieldLabel>
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
                maxLength={SEARCH_MAX}
                placeholder="Projet, e-mail du propriétaire ou numéro WhatsApp"
                aria-invalid={fieldState.invalid}
              />
            </InputGroup>
            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
          </Field>
        )}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={pending} className="min-h-10 flex-1 sm:min-h-9 sm:flex-none">
          {pending ? (
            <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />
          ) : (
            <Search data-icon="inline-start" />
          )}
          Rechercher
        </Button>
        {query && (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            className="min-h-10 sm:min-h-9"
            onClick={() => go("")}
          >
            <RotateCcw data-icon="inline-start" />
            Effacer
          </Button>
        )}
      </div>
    </form>
  );
}
