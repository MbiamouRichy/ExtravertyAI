"use client";

import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { saveKnowledgeEntryAction } from "@/app/actions/knowledge";
import { KNOWLEDGE_LIMITS } from "@/lib/knowledge-shared";
import { currencyDigits, parseDealValue } from "@/lib/pipeline-shared";
import type { KnowledgeEntryView } from "./types";

type EditableKind = "FAQ" | "TEXT" | "PRODUCT";

const COPY: Record<EditableKind, { create: string; edit: string; title: string; content: string; hint: string }> = {
  FAQ: {
    create: "Nouvelle question fréquente",
    edit: "Modifier la question",
    title: "Question du client",
    content: "Réponse de l’assistant",
    hint: "Formulez la question comme vos clients la posent.",
  },
  TEXT: {
    create: "Nouvelle information",
    edit: "Modifier l’information",
    title: "Titre",
    content: "Contenu",
    hint: "Horaires, conditions de livraison, politique de retour…",
  },
  PRODUCT: {
    create: "Nouveau produit",
    edit: "Modifier le produit",
    title: "Nom du produit",
    content: "Description",
    hint: "Matières, tailles, couleurs : tout ce qui aide à répondre.",
  },
};

function plainAmount(minor: number | null, currency: string) {
  if (minor === null) return "";
  const digits = currencyDigits(currency);
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits }).format(minor / 10 ** digits);
}

function buildSchema(kind: EditableKind, currency: string) {
  const amountValid = (value: string) => {
    try {
      parseDealValue(value, currency);
      return true;
    } catch {
      return false;
    }
  };
  return z.object({
    title: z
      .string()
      .trim()
      .min(kind === "PRODUCT" ? 1 : 3, kind === "PRODUCT" ? "Le nom est obligatoire." : "Au moins 3 caractères.")
      .max(KNOWLEDGE_LIMITS.titleMax, `${KNOWLEDGE_LIMITS.titleMax} caractères au maximum.`),
    content:
      kind === "PRODUCT"
        ? z.string().trim().max(KNOWLEDGE_LIMITS.contentMax, `${KNOWLEDGE_LIMITS.contentMax} caractères au maximum.`)
        : z
            .string()
            .trim()
            .min(1, "Ce champ est obligatoire.")
            .max(KNOWLEDGE_LIMITS.contentMax, `${KNOWLEDGE_LIMITS.contentMax} caractères au maximum.`),
    price: z.string().trim().max(20).refine(amountValid, "Prix invalide, par exemple 45 000."),
    stock: z
      .string()
      .trim()
      .regex(/^\d{0,9}$/, "Saisissez un nombre entier, ou laissez vide."),
  });
}

export function EntryFormDialog({
  open,
  onOpenChange,
  projectId,
  kind,
  currency,
  entry,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  kind: EditableKind;
  currency: string;
  entry: KnowledgeEntryView | null;
  onSaved: () => void;
}) {
  const id = useId();
  const copy = COPY[kind];
  const schema = buildSchema(kind, currency);
  const form = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: entry?.title ?? "",
      content: entry && !(kind === "PRODUCT" && entry.content === entry.title) ? entry.content : "",
      price: plainAmount(entry?.price ?? null, currency),
      stock: entry?.stock?.toString() ?? "",
    },
  });
  const [saving, setSaving] = useState(false);

  async function submit(values: z.output<typeof schema>) {
    setSaving(true);
    const result = await saveKnowledgeEntryAction({
      projectId,
      id: entry?.id,
      entry: {
        kind,
        title: values.title,
        content: values.content,
        price: kind === "PRODUCT" ? parseDealValue(values.price, currency) : null,
        stock: kind === "PRODUCT" && values.stock ? Number(values.stock) : null,
      },
    });
    setSaving(false);
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success(entry ? "Modifications enregistrées" : "Entrée ajoutée à la base de connaissances");
    form.reset();
    onOpenChange(false);
    onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? copy.edit : copy.create}</DialogTitle>
          <DialogDescription>{copy.hint}</DialogDescription>
        </DialogHeader>
        <form id={id} noValidate onSubmit={form.handleSubmit(submit)}>
          <FieldGroup className="gap-4">
            <Controller
              name="title"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${id}-title`}>{copy.title}</FieldLabel>
                  <Input
                    {...field}
                    id={`${id}-title`}
                    autoComplete="off"
                    maxLength={KNOWLEDGE_LIMITS.titleMax}
                    aria-invalid={fieldState.invalid}
                    placeholder={kind === "FAQ" ? "Livrez-vous à Port-Gentil ?" : kind === "PRODUCT" ? "Sneakers Urban blanches" : "Horaires d’ouverture"}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            {kind === "PRODUCT" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Controller
                  name="price"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={`${id}-price`}>Prix</FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          {...field}
                          id={`${id}-price`}
                          inputMode="decimal"
                          autoComplete="off"
                          aria-invalid={fieldState.invalid}
                          placeholder="45 000"
                          className="tabular-nums"
                        />
                        <InputGroupAddon align="inline-end">
                          <InputGroupText className="font-mono text-xs">{currency}</InputGroupText>
                        </InputGroupAddon>
                      </InputGroup>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
                <Controller
                  name="stock"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={`${id}-stock`}>Stock</FieldLabel>
                      <Input
                        {...field}
                        id={`${id}-stock`}
                        inputMode="numeric"
                        autoComplete="off"
                        aria-invalid={fieldState.invalid}
                        aria-describedby={`${id}-stock-help`}
                        placeholder="Facultatif"
                        className="tabular-nums"
                      />
                      <FieldDescription id={`${id}-stock-help`}>Vide si vous ne suivez pas le stock.</FieldDescription>
                      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                    </Field>
                  )}
                />
              </div>
            )}
            <Controller
              name="content"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${id}-content`}>
                    {copy.content}
                    {kind === "PRODUCT" && <span className="font-normal text-muted-foreground"> (facultatif)</span>}
                  </FieldLabel>
                  <Textarea
                    {...field}
                    id={`${id}-content`}
                    rows={kind === "FAQ" ? 4 : 6}
                    maxLength={KNOWLEDGE_LIMITS.contentMax}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={`${id}-content-help`}
                  />
                  <FieldDescription id={`${id}-content-help`}>
                    {field.value.length.toLocaleString("fr-FR")} / {KNOWLEDGE_LIMITS.contentMax.toLocaleString("fr-FR")} caractères
                  </FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button type="submit" form={id} disabled={saving}>
            {saving && <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
            {entry ? "Enregistrer" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
