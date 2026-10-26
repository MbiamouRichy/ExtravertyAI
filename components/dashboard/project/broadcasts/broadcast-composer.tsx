"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Braces,
  CalendarClock,
  ImagePlus,
  Loader2,
  Send,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createBroadcastAction, estimateAudienceAction } from "@/app/actions/broadcasts";
import {
  ACTIVITY_WINDOWS,
  BROADCAST_LIMITS,
  BROADCAST_WINDOW,
  NAME_VARIABLE,
  OPT_OUT_FOOTER,
  personalise,
  usesNameVariable,
} from "@/lib/broadcast-shared";
import { PIPELINE_STAGES } from "@/lib/pipeline-shared";
import type { BroadcastUsageView } from "./types";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
const STAGE_IDS = PIPELINE_STAGES.map((stage) => stage.id) as [
  (typeof PIPELINE_STAGES)[number]["id"],
  ...(typeof PIPELINE_STAGES)[number]["id"][],
];

const FormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Donnez un nom à la diffusion.")
      .max(BROADCAST_LIMITS.nameMax, `${BROADCAST_LIMITS.nameMax} caractères au maximum.`),
    content: z
      .string()
      .trim()
      .min(1, "Écrivez le message.")
      .max(BROADCAST_LIMITS.contentMax, `${BROADCAST_LIMITS.contentMax} caractères au maximum.`),
    nameFallback: z
      .string()
      .trim()
      .max(BROADCAST_LIMITS.fallbackMax, `${BROADCAST_LIMITS.fallbackMax} caractères au maximum.`),
    tagIds: z.array(z.string()),
    stages: z.array(z.enum(STAGE_IDS)),
    activeWithinDays: z.number(),
    when: z.enum(["now", "later"]),
    scheduledAt: z.string(),
  })
  .superRefine((values, ctx) => {
    if (values.when !== "later") return;
    const date = new Date(values.scheduledAt);
    if (!values.scheduledAt || Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", path: ["scheduledAt"], message: "Choisissez une date et une heure." });
    } else if (date.getTime() < Date.now()) {
      ctx.addIssue({ code: "custom", path: ["scheduledAt"], message: "Cette date est déjà passée." });
    } else if (date.getTime() > Date.now() + BROADCAST_LIMITS.scheduleMaxDays * 86_400_000) {
      ctx.addIssue({
        code: "custom",
        path: ["scheduledAt"],
        message: `Au plus ${BROADCAST_LIMITS.scheduleMaxDays} jours à l’avance.`,
      });
    }
  });
type FormValues = z.infer<typeof FormSchema>;

type Estimate =
  | { state: "loading" }
  | { state: "ready"; count: number; optedOut: number; limit: number }
  | { state: "error"; message: string };

type Image =
  | { state: "none" }
  | { state: "uploading"; preview: string; name: string }
  | { state: "ready"; preview: string; name: string; token: string };

/** « 2026-10-24T09:30 » for a datetime-local input, in the browser's time zone. */
function localInputValue(date: Date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

const number = (value: number) => value.toLocaleString("fr-FR");

export function BroadcastComposer({
  projectId,
  tags,
  usage,
  connected,
}: {
  projectId: string;
  tags: Array<{ id: string; name: string }>;
  usage: BroadcastUsageView;
  connected: boolean;
}) {
  const id = useId();
  const router = useRouter();
  // One request per composer: makes the creation idempotent and binds the image to it.
  const [requestId] = useState(() => crypto.randomUUID());
  const [bounds] = useState(() => ({
    min: localInputValue(new Date(Date.now() + 5 * 60_000)),
    max: localInputValue(new Date(Date.now() + BROADCAST_LIMITS.scheduleMaxDays * 86_400_000)),
  }));
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [estimate, setEstimate] = useState<Estimate>({ state: "loading" });
  const [image, setImage] = useState<Image>({ state: "none" });
  const [confirming, setConfirming] = useState<FormValues | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      name: "",
      content: "",
      nameFallback: "",
      tagIds: [],
      stages: [],
      activeWithinDays: 0,
      when: "now",
      scheduledAt: "",
    },
  });
  const [content, nameFallback, tagIds, stages, activeWithinDays, when] = useWatch({
    control: form.control,
    name: ["content", "nameFallback", "tagIds", "stages", "activeWithinDays", "when"],
  });

  // Live audience size, a moment after the criteria stop changing.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setEstimate({ state: "loading" });
      const result = await estimateAudienceAction({
        projectId,
        audience: { tagIds, stages, activeWithinDays },
      });
      if (cancelled) return;
      setEstimate(
        result.success
          ? { state: "ready", count: result.count, optedOut: result.optedOut, limit: result.limit }
          : { state: "error", message: result.error },
      );
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [projectId, tagIds, stages, activeWithinDays]);

  // Previews are local object URLs: released when replaced or on leave (the
  // same URL is kept from upload to ready).
  const previewUrl = image.state === "none" ? null : image.preview;
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function attach(file: File) {
    if (!IMAGE_TYPES.includes(file.type)) {
      toast.error("Choisissez une image JPEG, PNG ou WebP.");
      return;
    }
    if (file.size > IMAGE_MAX_BYTES) {
      toast.error("L’image dépasse 4 Mo.");
      return;
    }
    const preview = URL.createObjectURL(file);
    setImage({ state: "uploading", preview, name: file.name });
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/chat/media?requestId=${requestId}`,
        {
          method: "POST",
          headers: { "content-type": file.type, "x-file-name": encodeURIComponent(file.name) },
          body: file,
        },
      );
      const payload = (await response.json().catch(() => null)) as { token?: string; error?: string } | null;
      if (!response.ok || !payload?.token) throw new Error(payload?.error || "L’image n’a pas pu être importée.");
      setImage({ state: "ready", preview, name: file.name, token: payload.token });
    } catch (error) {
      setImage({ state: "none" });
      toast.error(error instanceof Error ? error.message : "L’image n’a pas pu être importée.");
    }
  }

  function insertVariable() {
    const element = contentRef.current;
    const current = form.getValues("content");
    const start = element?.selectionStart ?? current.length;
    const end = element?.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${NAME_VARIABLE}${current.slice(end)}`.slice(0, BROADCAST_LIMITS.contentMax);
    form.setValue("content", next, { shouldDirty: true, shouldValidate: form.formState.isSubmitted });
    requestAnimationFrame(() => {
      element?.focus();
      const caret = start + NAME_VARIABLE.length;
      element?.setSelectionRange(caret, caret);
    });
  }

  function review(values: FormValues) {
    if (estimate.state !== "ready" || !estimate.count) {
      toast.error("Aucun contact ne correspond au ciblage.");
      return;
    }
    if (estimate.count > estimate.limit) {
      toast.error(`Votre offre permet ${number(estimate.limit)} contacts par diffusion : affinez le ciblage.`);
      return;
    }
    if (image.state === "uploading") {
      toast.error("Patientez pendant l’import de l’image.");
      return;
    }
    setConfirming(values);
  }

  async function submit() {
    if (!confirming) return;
    setSubmitting(true);
    const result = await createBroadcastAction({
      projectId,
      requestId,
      name: confirming.name,
      content: confirming.content,
      nameFallback: confirming.nameFallback,
      audience: { tagIds: confirming.tagIds, stages: confirming.stages, activeWithinDays: confirming.activeWithinDays },
      scheduledAt: confirming.when === "later" ? new Date(confirming.scheduledAt).toISOString() : null,
      attachment: image.state === "ready" ? { token: image.token } : null,
    });
    setSubmitting(false);
    if (!result.success) {
      setConfirming(null);
      toast.error(result.error);
      return;
    }
    toast.success(confirming.when === "later" ? "Diffusion programmée" : "Diffusion lancée");
    router.push(`/projects/${projectId}/broadcasts/${result.broadcastId}`);
  }

  const preview = personalise(content || "Votre message apparaîtra ici.", { name: "Aminata" }, nameFallback);
  const showFallback = usesNameVariable(content);
  const count = estimate.state === "ready" ? estimate.count : null;
  const monthlyLeft = Math.max(0, usage.monthly.limit - usage.monthly.used - usage.monthly.reserved);
  const quotaLeft = usage.quota ? Math.max(0, usage.quota.limit - usage.quota.used) : null;
  const overLimit = count !== null && (count > usage.recipientsLimit || count > monthlyLeft || (quotaLeft !== null && count > quotaLeft));

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(review)}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"
    >
      <div className="space-y-6">
        <section aria-labelledby={`${id}-message`} className="rounded-2xl border bg-card p-4 sm:p-6">
          <h2 id={`${id}-message`} className="font-heading text-lg font-semibold tracking-tight">
            1. Le message
          </h2>
          <FieldGroup className="mt-5 gap-5">
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${id}-name`}>Nom de la diffusion</FieldLabel>
                  <Input
                    {...field}
                    id={`${id}-name`}
                    autoComplete="off"
                    maxLength={BROADCAST_LIMITS.nameMax}
                    placeholder="Soldes de fin d’année"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={`${id}-name-help`}
                  />
                  <FieldDescription id={`${id}-name-help`}>Visible par votre équipe uniquement.</FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="content"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <div className="flex flex-wrap items-end justify-between gap-2">
                    <FieldLabel htmlFor={`${id}-content`}>Message</FieldLabel>
                    <Button type="button" size="sm" variant="outline" onClick={insertVariable}>
                      <Braces data-icon="inline-start" />
                      Insérer le prénom
                    </Button>
                  </div>
                  <Textarea
                    {...field}
                    ref={(element) => {
                      field.ref(element);
                      contentRef.current = element;
                    }}
                    id={`${id}-content`}
                    rows={7}
                    maxLength={BROADCAST_LIMITS.contentMax}
                    placeholder={`Bonjour ${NAME_VARIABLE}, profitez de -20 % sur toute la boutique ce week-end !`}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={`${id}-content-help`}
                  />
                  <FieldDescription id={`${id}-content-help`}>
                    {number(field.value.length)} / {number(BROADCAST_LIMITS.contentMax)} caractères. La mention
                    « {OPT_OUT_FOOTER} » est ajoutée automatiquement.
                  </FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            {showFallback && (
              <Controller
                name="nameFallback"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`${id}-fallback`}>Si le prénom est inconnu</FieldLabel>
                    <Input
                      {...field}
                      id={`${id}-fallback`}
                      autoComplete="off"
                      maxLength={BROADCAST_LIMITS.fallbackMax}
                      placeholder="cher client"
                      aria-invalid={fieldState.invalid}
                      aria-describedby={`${id}-fallback-help`}
                    />
                    <FieldDescription id={`${id}-fallback-help`}>
                      Laissez vide pour simplement retirer la variable (« Bonjour, … »).
                    </FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            )}
            <Field>
              <FieldLabel htmlFor={`${id}-image`}>Image (facultatif)</FieldLabel>
              <input
                ref={fileRef}
                id={`${id}-image`}
                type="file"
                accept={IMAGE_TYPES.join(",")}
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void attach(file);
                }}
              />
              {image.state === "none" ? (
                <Button type="button" variant="outline" className="w-fit" onClick={() => fileRef.current?.click()}>
                  <ImagePlus data-icon="inline-start" />
                  Ajouter une image
                </Button>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
                  <img src={image.preview} alt="" className="size-12 rounded-md object-cover" />
                  <span className="min-w-0 flex-1 truncate text-sm">{image.name}</span>
                  {image.state === "uploading" ? (
                    <Loader2 aria-label="Import en cours" className="size-4 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Retirer l’image"
                      onClick={() => setImage({ state: "none" })}
                    >
                      <Trash2 aria-hidden="true" />
                    </Button>
                  )}
                </div>
              )}
              <FieldDescription>JPEG, PNG ou WebP, 4 Mo au plus. Le message devient sa légende.</FieldDescription>
            </Field>
          </FieldGroup>
        </section>

        <section aria-labelledby={`${id}-audience`} className="rounded-2xl border bg-card p-4 sm:p-6">
          <h2 id={`${id}-audience`} className="font-heading text-lg font-semibold tracking-tight">
            2. Les destinataires
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Uniquement des contacts qui vous ont déjà écrit sur WhatsApp. Ceux qui ont répondu STOP sont toujours exclus.
          </p>
          <FieldGroup className="mt-5 gap-6">
            <Controller
              name="tagIds"
              control={form.control}
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend variant="label">Étiquettes</FieldLegend>
                  <FieldDescription className="-mt-1.5">
                    Aucune cochée : tous les contacts. Sinon, ceux qui portent au moins une étiquette cochée.
                  </FieldDescription>
                  {tags.length ? (
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag) => {
                        const checked = field.value.includes(tag.id);
                        return (
                          <FieldLabel
                            key={tag.id}
                            htmlFor={`${id}-tag-${tag.id}`}
                            className="w-auto! cursor-pointer gap-2 rounded-lg border px-3 py-2 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-muted/50"
                          >
                            <Checkbox
                              id={`${id}-tag-${tag.id}`}
                              checked={checked}
                              onCheckedChange={(next) =>
                                field.onChange(
                                  next ? [...field.value, tag.id] : field.value.filter((value) => value !== tag.id),
                                )
                              }
                            />
                            {tag.name}
                          </FieldLabel>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Aucune étiquette pour l’instant : ajoutez-en depuis la messagerie pour cibler finement.
                    </p>
                  )}
                </FieldSet>
              )}
            />
            <Controller
              name="stages"
              control={form.control}
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend variant="label">Étapes du pipeline</FieldLegend>
                  <div className="flex flex-wrap gap-2">
                    {PIPELINE_STAGES.map((stage) => (
                      <FieldLabel
                        key={stage.id}
                        htmlFor={`${id}-stage-${stage.id}`}
                        className="w-auto! cursor-pointer gap-2 rounded-lg border px-3 py-2 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-muted/50"
                      >
                        <Checkbox
                          id={`${id}-stage-${stage.id}`}
                          checked={field.value.includes(stage.id)}
                          onCheckedChange={(next) =>
                            field.onChange(
                              next ? [...field.value, stage.id] : field.value.filter((value) => value !== stage.id),
                            )
                          }
                        />
                        {stage.label}
                      </FieldLabel>
                    ))}
                  </div>
                </FieldSet>
              )}
            />
            <Controller
              name="activeWithinDays"
              control={form.control}
              render={({ field }) => (
                <Field className="max-w-xs">
                  <FieldLabel htmlFor={`${id}-activity`}>Dernier message du client</FieldLabel>
                  <Select value={String(field.value)} onValueChange={(value) => field.onChange(Number(value))}>
                    <SelectTrigger id={`${id}-activity`} className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTIVITY_WINDOWS.map((window) => (
                        <SelectItem key={window.days} value={String(window.days)}>
                          {window.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
            />
          </FieldGroup>
        </section>

        <section aria-labelledby={`${id}-schedule`} className="rounded-2xl border bg-card p-4 sm:p-6">
          <h2 id={`${id}-schedule`} className="font-heading text-lg font-semibold tracking-tight">
            3. L’envoi
          </h2>
          <FieldGroup className="mt-5 gap-5">
            <Controller
              name="when"
              control={form.control}
              render={({ field }) => (
                <FieldSet>
                  <FieldLegend className="sr-only">Moment de l’envoi</FieldLegend>
                  <RadioGroup
                    name={field.name}
                    value={field.value}
                    onValueChange={field.onChange}
                    className="grid gap-2 sm:grid-cols-2"
                  >
                    {[
                      { value: "now", label: "Dès maintenant", hint: `Ou à ${BROADCAST_WINDOW.startHour} h si l’heure d’envoi est passée.`, icon: Send },
                      { value: "later", label: "Programmer", hint: "Jusqu’à 30 jours à l’avance.", icon: CalendarClock },
                    ].map((option) => (
                      <FieldLabel
                        key={option.value}
                        htmlFor={`${id}-when-${option.value}`}
                        className="w-full! cursor-pointer items-start gap-3 rounded-xl border p-3 font-normal has-data-[state=checked]:border-primary has-data-[state=checked]:bg-muted/50"
                      >
                        <RadioGroupItem id={`${id}-when-${option.value}`} value={option.value} className="mt-0.5" />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-medium">
                            <option.icon aria-hidden="true" className="size-3.5" />
                            {option.label}
                          </span>
                          <span className="mt-0.5 block text-xs text-muted-foreground">{option.hint}</span>
                        </span>
                      </FieldLabel>
                    ))}
                  </RadioGroup>
                </FieldSet>
              )}
            />
            {when === "later" && (
              <Controller
                name="scheduledAt"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid} className="max-w-xs">
                    <FieldLabel htmlFor={`${id}-date`}>Date et heure de départ</FieldLabel>
                    <Input
                      {...field}
                      id={`${id}-date`}
                      type="datetime-local"
                      min={bounds.min}
                      max={bounds.max}
                      aria-invalid={fieldState.invalid}
                      aria-describedby={`${id}-date-help`}
                    />
                    <FieldDescription id={`${id}-date-help`}>
                      Heure de votre appareil. Hors de {BROADCAST_WINDOW.startHour} h – {BROADCAST_WINDOW.endHour} h
                      (Libreville), l’envoi attend l’ouverture suivante.
                    </FieldDescription>
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            )}
          </FieldGroup>
        </section>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20">
        <section aria-label="Aperçu" className="rounded-2xl border bg-muted/40 p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Aperçu · pour « Aminata »
          </p>
          <div className="mt-3 ml-auto max-w-[92%] overflow-hidden rounded-2xl rounded-tr-sm bg-card shadow-sm">
            {image.state !== "none" && (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
              <img src={image.preview} alt="" className="max-h-56 w-full object-cover" />
            )}
            <p className="whitespace-pre-wrap wrap-anywhere px-3 py-2 text-sm leading-relaxed">
              {preview}
              {"\n\n"}
              <em className="text-muted-foreground">{OPT_OUT_FOOTER}</em>
            </p>
          </div>
        </section>

        <section aria-labelledby={`${id}-summary`} className="rounded-2xl border bg-card p-4">
          <h2 id={`${id}-summary`} className="flex items-center gap-2 text-sm font-semibold">
            <Users aria-hidden="true" className="size-4" />
            Destinataires
          </h2>
          <p aria-live="polite" className="mt-2 font-heading text-3xl font-bold tabular-nums">
            {estimate.state === "loading" ? (
              <Loader2 aria-label="Calcul en cours" className="size-6 animate-spin motion-reduce:animate-none" />
            ) : count !== null ? (
              number(count)
            ) : (
              "—"
            )}
          </p>
          {estimate.state === "error" && <p className="mt-1 text-xs text-destructive">{estimate.message}</p>}
          {estimate.state === "ready" && estimate.optedOut > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {number(estimate.optedOut)} désinscrit{estimate.optedOut > 1 ? "s" : ""} exclu{estimate.optedOut > 1 ? "s" : ""}.
            </p>
          )}
          <ul className="mt-3 space-y-1.5 text-xs text-muted-foreground">
            <li>Au plus {number(usage.recipientsLimit)} contacts par diffusion.</li>
            <li>{number(monthlyLeft)} messages de diffusion restants ce mois-ci.</li>
            {quotaLeft !== null && <li>{number(quotaLeft)} messages restants sur votre quota.</li>}
          </ul>
          {overLimit && (
            <p role="alert" className="mt-3 text-xs text-destructive">
              Ce ciblage dépasse une limite de votre offre : affinez-le pour continuer.
            </p>
          )}
          {!connected && (
            <p className="mt-3 text-xs text-destructive">
              WhatsApp n’est pas connecté : l’envoi attendra sa reconnexion.
            </p>
          )}
          <Button
            type="submit"
            className="mt-4 w-full"
            disabled={estimate.state !== "ready" || !count || overLimit || image.state === "uploading"}
          >
            <Send data-icon="inline-start" />
            Vérifier et envoyer
          </Button>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            Envoi progressif, un message toutes les 8 à 15 secondes, pour protéger votre numéro.
          </p>
        </section>
      </aside>

      <AlertDialog open={!!confirming} onOpenChange={(open) => !open && !submitting && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirming?.when === "later" ? "Programmer" : "Envoyer"} « {confirming?.name} » ?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {count !== null && `${number(count)} contact${count > 1 ? "s" : ""} recevr${count > 1 ? "ont" : "a"} ce message, soit ${number(count)} message${count > 1 ? "s" : ""} décompté${count > 1 ? "s" : ""} de votre quota. `}
              {confirming?.when === "later" && confirming.scheduledAt
                ? `Départ le ${new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short" }).format(new Date(confirming.scheduledAt))}.`
                : "Départ immédiat pendant les heures d’envoi."}{" "}
              Vous pourrez la mettre en pause ou l’annuler à tout moment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Modifier</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              {submitting && <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />}
              {confirming?.when === "later" ? "Programmer" : "Lancer la diffusion"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </form>
  );
}
