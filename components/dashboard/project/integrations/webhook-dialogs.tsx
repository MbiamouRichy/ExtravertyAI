"use client";

import { useId, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Check, Copy, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createWebhookAction, updateEndpointAction } from "@/app/actions/integrations";
import { INTEGRATION_EVENTS, INTEGRATION_EVENT_IDS } from "@/lib/integration-events";

type EventId = (typeof INTEGRATION_EVENT_IDS)[number];

const EventsSchema = z.array(z.enum(INTEGRATION_EVENT_IDS)).min(1, "Choisissez au moins un événement.");

function EventChoices({
  id,
  available,
  value,
  onChange,
  invalid,
  disabled,
}: {
  id: string;
  /** Events the project's plan can produce; the others are hidden. */
  available: readonly EventId[];
  value: EventId[];
  onChange: (next: EventId[]) => void;
  invalid: boolean;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      {INTEGRATION_EVENTS.filter((event) => available.includes(event.id)).map((event) => {
        const checked = value.includes(event.id);
        return (
          <Field key={event.id} orientation="horizontal" className="items-start gap-3">
            <Checkbox
              id={`${id}-${event.id}`}
              checked={checked}
              disabled={disabled}
              aria-invalid={invalid}
              onCheckedChange={(next) =>
                onChange(next ? [...value, event.id] : value.filter((item) => item !== event.id))
              }
            />
            <div className="grid gap-0.5">
              <FieldLabel htmlFor={`${id}-${event.id}`} className="font-normal">
                {event.label}
                <code className="ml-1.5 rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground">
                  {event.id}
                </code>
              </FieldLabel>
              <FieldDescription className="text-xs">{event.hint}</FieldDescription>
            </div>
          </Field>
        );
      })}
    </div>
  );
}

const CreateSchema = z.object({
  name: z.string().trim().min(1, "Donnez un nom à ce webhook.").max(80, "80 caractères au maximum."),
  url: z
    .string()
    .trim()
    .min(1, "Saisissez l’adresse du webhook.")
    .max(2000)
    .refine((value) => {
      try {
        return new URL(value).protocol === "https:";
      } catch {
        return false;
      }
    }, "Saisissez une adresse complète en https://."),
  events: EventsSchema,
});

export function CreateWebhookDialog({
  projectId,
  availableEvents,
  open,
  onOpenChange,
  onCreated,
}: {
  projectId: string;
  availableEvents: readonly EventId[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (secret: string) => void;
}) {
  const id = useId();
  const form = useForm<z.input<typeof CreateSchema>, unknown, z.output<typeof CreateSchema>>({
    resolver: zodResolver(CreateSchema),
    defaultValues: { name: "", url: "", events: (["contact.qualified", "pipeline.stage_changed"] as const).filter((event) =>
        availableEvents.includes(event),
      ),
    },
  });
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nouveau webhook</DialogTitle>
          <DialogDescription>
            ExtravertyAI enverra un POST JSON signé à cette adresse à chaque événement choisi.
          </DialogDescription>
        </DialogHeader>
        <form
          id={id}
          noValidate
          onSubmit={form.handleSubmit(async (values) => {
            setSaving(true);
            const result = await createWebhookAction({ projectId, ...values });
            setSaving(false);
            if (!result.success) {
              if (/adresse/i.test(result.error)) form.setError("url", { message: result.error });
              else toast.error(result.error);
              return;
            }
            form.reset();
            onOpenChange(false);
            onCreated(result.secret);
          })}
        >
          <FieldGroup className="gap-5">
            <Controller
              name="name"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${id}-name`}>Nom</FieldLabel>
                  <Input {...field} id={`${id}-name`} autoComplete="off" placeholder="Make · CRM" aria-invalid={fieldState.invalid} />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="url"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${id}-url`}>Adresse de réception</FieldLabel>
                  <Input
                    {...field}
                    id={`${id}-url`}
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    placeholder="https://hook.eu1.make.com/…"
                    aria-invalid={fieldState.invalid}
                    aria-describedby={`${id}-url-help`}
                  />
                  <FieldDescription id={`${id}-url-help`}>
                    Adresse publique en https://, fournie par Make, Zapier ou votre serveur.
                  </FieldDescription>
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <Controller
              name="events"
              control={form.control}
              render={({ field, fieldState }) => (
                <FieldSet data-invalid={fieldState.invalid}>
                  <FieldLegend variant="label">Événements envoyés</FieldLegend>
                  <EventChoices
                    id={`${id}-events`}
                    available={availableEvents}
                    value={field.value as EventId[]}
                    onChange={field.onChange}
                    invalid={fieldState.invalid}
                    disabled={saving}
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </FieldSet>
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
            Créer le webhook
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const EditSchema = z.object({ events: EventsSchema });

export function EditEventsDialog({
  projectId,
  endpointId,
  name,
  events,
  availableEvents,
  onClose,
  onSaved,
}: {
  projectId: string;
  endpointId: string;
  name: string;
  events: EventId[];
  availableEvents: readonly EventId[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const id = useId();
  const form = useForm<z.input<typeof EditSchema>, unknown, z.output<typeof EditSchema>>({
    resolver: zodResolver(EditSchema),
    defaultValues: { events: events.filter((event) => availableEvents.includes(event)) },
  });
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Événements · {name}</DialogTitle>
          <DialogDescription>Seuls les événements cochés seront envoyés.</DialogDescription>
        </DialogHeader>
        <form
          id={id}
          noValidate
          onSubmit={form.handleSubmit(async (values) => {
            setSaving(true);
            const result = await updateEndpointAction({ projectId, endpointId, events: values.events });
            setSaving(false);
            if (!result.success) {
              toast.error(result.error);
              return;
            }
            toast.success("Événements mis à jour");
            onClose();
            onSaved();
          })}
        >
          <Controller
            name="events"
            control={form.control}
            render={({ field, fieldState }) => (
              <FieldSet data-invalid={fieldState.invalid}>
                <FieldLegend className="sr-only">Événements envoyés</FieldLegend>
                <EventChoices
                  id={`${id}-events`}
                  available={availableEvents}
                  value={field.value as EventId[]}
                  onChange={field.onChange}
                  invalid={fieldState.invalid}
                  disabled={saving}
                />
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </FieldSet>
            )}
          />
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={saving} onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form={id} disabled={saving}>
            {saving && <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />}
            Enregistrer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The secret is displayed once: it is only stored encrypted afterwards. */
export function SecretDialog({ secret, onClose }: { secret: string; onClose: () => void }) {
  const id = useId();
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Secret de signature</DialogTitle>
          <DialogDescription>
            Copiez-le maintenant : il ne sera plus affiché. Il permet à votre outil
            de vérifier que les appels viennent bien d’ExtravertyAI.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor={id}>Secret</FieldLabel>
          <div className="flex gap-2">
            <Input id={id} readOnly value={secret} className="font-mono text-xs" onFocus={(event) => event.target.select()} />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Copier le secret"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(secret);
                  setCopied(true);
                  toast.success("Secret copié");
                } catch {
                  toast.error("Copie impossible : sélectionnez le texte manuellement.");
                }
              }}
            >
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            </Button>
          </div>
        </Field>
        <DialogFooter>
          <Button type="button" onClick={onClose}>
            J’ai copié le secret
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
