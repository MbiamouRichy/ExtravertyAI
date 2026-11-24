"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  CalendarClock,
  CircleAlert,
  Clock3,
  Loader2,
  Pencil,
  TriangleAlert,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  cancelScheduledMessageAction,
  dismissScheduledMessageAction,
  updateScheduledMessageAction,
} from "@/app/actions/scheduled-messages";
import {
  SCHEDULED_MESSAGE_LIMITS,
  ScheduledContentSchema,
  formatScheduleDate,
  scheduleTimeError,
  schedulePresets,
  scheduledFailureLabel,
  timeZoneCity,
  timeZoneLabel,
  zonedDateTime,
  zonedInputs,
  type ScheduledChatMessage,
} from "@/lib/scheduled-messages-shared";
import { cn } from "@/lib/utils";

/** Fuseau de l'appareil, lu après l'hydratation (le serveur ne le connaît pas). */
const subscribeNever = () => () => {};
function useDeviceTimeZone() {
  return useSyncExternalStore(
    subscribeNever,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => null,
  );
}

/** Horloge rafraîchie chaque minute : raccourcis et contrôles restent à jour. */
function useMinuteClock(active: boolean) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!active) return;
    const refresh = () => setNow(new Date());
    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

export type ScheduleContext = {
  /** Fuseau de l'activité : celui des clients, dans lequel l'heure est choisie. */
  timeZone: string;
  /** Fin de la fenêtre de 24 h de WhatsApp ; null si le client n'a jamais écrit. */
  windowClosesAt: string | null;
};

/** Avertissement si l'envoi tombe après la fermeture de la fenêtre de 24 h. */
function windowWarning(at: Date | null, context: ScheduleContext) {
  if (!at) return null;
  if (!context.windowClosesAt) {
    return "Ce contact ne vous a encore jamais écrit : WhatsApp n’autorise un message que dans les 24 h qui suivent un message du client. Il ne partira que si le client vous écrit d’ici là.";
  }
  const closes = new Date(context.windowClosesAt);
  if (at.getTime() < closes.getTime()) return null;
  return `La fenêtre de 24 h de WhatsApp se ferme ${formatScheduleDate(closes, context.timeZone)}. Si le client ne vous écrit pas d’ici l’envoi, le message ne partira pas et vous serez prévenu dans la conversation.`;
}

/* -------------------------------------------------------------------------- */
/* Menu à côté du bouton d'envoi                                               */
/* -------------------------------------------------------------------------- */

export function ScheduleSendMenu({
  context,
  disabled,
  disabledReason,
  busy,
  onPreset,
  onCustom,
}: {
  context: ScheduleContext;
  disabled: boolean;
  /** Pourquoi la programmation est indisponible (pièce jointe, message vide…). */
  disabledReason?: string;
  busy: boolean;
  onPreset: (at: Date) => void;
  onCustom: () => void;
}) {
  const [open, setOpen] = useState(false);
  const now = useMinuteClock(open);
  const presets = useMemo(() => schedulePresets(now, context.timeZone), [now, context.timeZone]);
  const closes = context.windowClosesAt ? new Date(context.windowClosesAt) : null;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* Le span garde l'infobulle sur un bouton désactivé. */}
          <span className="inline-flex">
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-9 shrink-0 text-muted-foreground hover:text-foreground sm:size-8"
                aria-label="Programmer l’envoi"
                disabled={disabled || busy}
              >
                {busy ? (
                  <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
                ) : (
                  <CalendarClock aria-hidden="true" />
                )}
              </Button>
            </DropdownMenuTrigger>
          </span>
        </TooltipTrigger>
        <TooltipContent>{disabled && disabledReason ? disabledReason : "Programmer l’envoi"}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" side="top" collisionPadding={16} className="w-[22rem] max-w-[calc(100vw-2rem)]">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-foreground">Programmer l’envoi</span>
          <span className="text-[11px] font-normal text-muted-foreground">
            Heures en {timeZoneLabel(context.timeZone, now)}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {presets.map((preset) => {
          const late = !!windowWarning(preset.at, context);
          return (
            // Menu étroit (petit écran) : la date passe sous le libellé au lieu
            // de le couper (« Dans… », « Ce s… »). flex-auto, pas flex-1 : la
            // largeur du libellé décide du retour à la ligne.
            <DropdownMenuItem
              key={preset.id}
              onSelect={() => onPreset(preset.at)}
              className="flex-wrap gap-x-2 gap-y-0.5"
            >
              <span className="flex min-w-0 flex-auto items-center gap-1.5">
                <span className="min-w-0 wrap-break-word">{preset.label}</span>
                {late && (
                  <>
                    <TriangleAlert aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="sr-only">, après la fermeture de la fenêtre de 24 h</span>
                  </>
                )}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatScheduleDate(preset.at, context.timeZone)}
              </span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onCustom} className="gap-2">
          <CalendarClock aria-hidden="true" />
          Choisir une date et une heure…
        </DropdownMenuItem>
        <p className="px-2 pt-1.5 pb-1 text-[11px] leading-relaxed text-muted-foreground">
          {closes && closes.getTime() > now.getTime()
            ? `Fenêtre WhatsApp de 24 h ouverte jusqu’à ${formatScheduleDate(closes, context.timeZone)}.`
            : closes
              ? "Fenêtre WhatsApp de 24 h fermée : le message ne partira que si le client vous écrit avant l’envoi."
              : "Le client ne vous a pas encore écrit : le message ne partira que s’il vous écrit dans les 24 h précédant l’envoi."}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* -------------------------------------------------------------------------- */
/* Fenêtre de programmation (création et modification)                         */
/* -------------------------------------------------------------------------- */

const ScheduleFormBase = z.object({
  content: ScheduledContentSchema,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choisissez une date."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Choisissez une heure."),
});
type ScheduleFormValues = z.infer<typeof ScheduleFormBase>;

function scheduleFormSchema(timeZone: string) {
  return ScheduleFormBase.superRefine((values, ctx) => {
    const at = zonedDateTime(values.date, values.time, timeZone);
    if (!at) {
      ctx.addIssue({
        code: "custom",
        path: ["time"],
        message: "Cette heure n’existe pas ce jour-là (changement d’heure). Choisissez-en une autre.",
      });
      return;
    }
    const now = new Date();
    const error = scheduleTimeError(at, now);
    if (error) {
      // Trop loin : la date est en cause ; déjà passé : l'heure.
      const path = at.getTime() > now.getTime() + 86_400_000 ? "date" : "time";
      ctx.addIssue({ code: "custom", path: [path], message: error });
    }
  });
}

export function ScheduleMessageDialog({
  open,
  onOpenChange,
  context,
  contactName,
  mode,
  initialContent,
  initialAt,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: ScheduleContext;
  contactName: string;
  mode: "create" | "edit" | "reschedule";
  initialContent: string;
  initialAt: Date | null;
  /** Renvoie true quand le serveur a accepté ; la fenêtre se ferme alors. */
  onSubmit: (content: string, at: Date) => Promise<boolean>;
}) {
  const id = useId();
  const deviceZone = useDeviceTimeZone();
  const now = useMinuteClock(open);
  const presets = useMemo(() => schedulePresets(now, context.timeZone), [now, context.timeZone]);
  const schema = useMemo(() => scheduleFormSchema(context.timeZone), [context.timeZone]);
  const bounds = useMemo(
    () => ({
      min: zonedInputs(now, context.timeZone).date,
      max: zonedInputs(
        new Date(now.getTime() + SCHEDULED_MESSAGE_LIMITS.maxDays * 86_400_000),
        context.timeZone,
      ).date,
    }),
    [now, context.timeZone],
  );

  const defaults = (): ScheduleFormValues => {
    const start = initialAt && initialAt.getTime() > now.getTime() ? initialAt : (presets[0]?.at ?? null);
    const inputs = start ? zonedInputs(start, context.timeZone) : { date: "", time: "" };
    return { content: initialContent, ...inputs };
  };
  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults(),
  });
  // Chaque ouverture repart des valeurs du message (brouillon ou programmation).
  useEffect(() => {
    if (open) form.reset(defaults());
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seulement à l’ouverture
  }, [open]);

  const [date, time] = useWatch({ control: form.control, name: ["date", "time"] });
  const at = zonedDateTime(date, time, context.timeZone);
  const warning = windowWarning(at, context);
  const deviceDiffers = !!deviceZone && !!at && zonedInputs(at, deviceZone).time !== time;
  const submitting = form.formState.isSubmitting;

  const title =
    mode === "create" ? "Programmer l’envoi" : mode === "edit" ? "Modifier le message programmé" : "Reprogrammer le message";
  const submitLabel = mode === "create" ? "Programmer" : mode === "edit" ? "Enregistrer" : "Reprogrammer";

  return (
    <Dialog open={open} onOpenChange={(next) => !submitting && onOpenChange(next)}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-cols-[minmax(0,1fr)] gap-5 overflow-x-hidden overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="pr-8">{title}</DialogTitle>
          <DialogDescription>
            Envoyé à {contactName} à l’heure choisie, en votre nom. Vous pouvez le modifier ou l’annuler
            jusqu’à son départ.
          </DialogDescription>
        </DialogHeader>
        <form
          id={`${id}-form`}
          noValidate
          onSubmit={(event) => {
            event.stopPropagation();
            void form.handleSubmit(async (values) => {
              const when = zonedDateTime(values.date, values.time, context.timeZone);
              if (!when) return;
              if (await onSubmit(values.content, when)) onOpenChange(false);
            })(event);
          }}
        >
          <FieldGroup className="gap-4">
            <Controller
              name="content"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`${id}-content`}>Message</FieldLabel>
                  <Textarea
                    {...field}
                    id={`${id}-content`}
                    rows={4}
                    autoComplete="off"
                    dir="auto"
                    disabled={submitting}
                    aria-invalid={fieldState.invalid}
                    className="max-h-56 min-h-24"
                  />
                  {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                </Field>
              )}
            />
            <div role="group" aria-labelledby={`${id}-presets`} className="flex flex-col gap-2">
              <p id={`${id}-presets`} className="text-sm font-medium">
                Raccourcis
              </p>
              <div className="flex flex-wrap gap-1.5">
                {presets.map((preset) => {
                  const inputs = zonedInputs(preset.at, context.timeZone);
                  const selected = inputs.date === date && inputs.time === time;
                  return (
                    <Button
                      key={preset.id}
                      type="button"
                      size="xs"
                      variant={selected ? "default" : "outline"}
                      aria-pressed={selected}
                      disabled={submitting}
                      onClick={() => {
                        form.setValue("date", inputs.date, { shouldValidate: true });
                        form.setValue("time", inputs.time, { shouldValidate: true });
                      }}
                    >
                      {preset.label}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                name="date"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`${id}-date`}>Date</FieldLabel>
                    <Input
                      {...field}
                      id={`${id}-date`}
                      type="date"
                      min={bounds.min}
                      max={bounds.max}
                      disabled={submitting}
                      aria-invalid={fieldState.invalid}
                      aria-describedby={`${id}-zone`}
                      onChange={(event) => {
                        field.onChange(event);
                        void form.trigger("time");
                      }}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
              <Controller
                name="time"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`${id}-time`}>Heure</FieldLabel>
                    <Input
                      {...field}
                      id={`${id}-time`}
                      type="time"
                      step={60}
                      disabled={submitting}
                      aria-invalid={fieldState.invalid}
                      aria-describedby={`${id}-zone`}
                    />
                    {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                  </Field>
                )}
              />
            </div>
            <FieldDescription id={`${id}-zone`} className="-mt-1 flex items-start gap-1.5 text-xs">
              <Clock3 aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
              <span>
                Heure de votre activité, celle de vos clients : {timeZoneLabel(context.timeZone, at ?? now)}.
                {deviceDiffers && at && deviceZone && (
                  <>
                    {" "}
                    Soit {zonedInputs(at, deviceZone).time} sur votre appareil ({timeZoneLabel(deviceZone, at)}).
                  </>
                )}
              </span>
            </FieldDescription>
            {warning && (
              <p
                role="status"
                className="flex items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-xs leading-relaxed"
              >
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                {warning}
              </p>
            )}
          </FieldGroup>
        </form>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={submitting}>
              Annuler
            </Button>
          </DialogClose>
          <Button type="submit" form={`${id}-form`} disabled={submitting}>
            {submitting ? (
              <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
            ) : (
              <CalendarClock aria-hidden="true" />
            )}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Messages programmés dans la conversation                                    */
/* -------------------------------------------------------------------------- */

export function ScheduledMessagesSection({
  projectId,
  contactName,
  items,
  context,
  onChanged,
}: {
  projectId: string;
  contactName: string;
  items: ScheduledChatMessage[];
  context: ScheduleContext;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<ScheduledChatMessage | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const now = useMinuteClock(items.length > 0);
  if (!items.length && !editing) return null;
  const pending = items.filter((item) => item.status === "scheduled").length;

  async function cancel(item: ScheduledChatMessage) {
    if (busyId) return;
    setBusyId(item.id);
    try {
      const action = item.status === "failed" ? dismissScheduledMessageAction : cancelScheduledMessageAction;
      const result = await action({ projectId, scheduledMessageId: item.id });
      if (!result.success) {
        toast.error(result.error);
        onChanged();
        return;
      }
      const message = item.status === "failed" ? "Message retiré de la conversation." : "Message programmé annulé.";
      toast.success(message);
      setAnnouncement(message);
      onChanged();
    } catch {
      toast.error("Action impossible. Vérifiez votre connexion et réessayez.");
    } finally {
      setBusyId(null);
    }
  }

  async function save(item: ScheduledChatMessage, content: string, at: Date) {
    try {
      const result = await updateScheduledMessageAction({
        projectId,
        scheduledMessageId: item.id,
        version: item.version,
        content,
        scheduledAt: at.toISOString(),
      });
      if (!result.success) {
        toast.error(result.error);
        onChanged();
        return false;
      }
      const message = `Envoi prévu ${formatScheduleDate(result.scheduledAt, context.timeZone)}.`;
      toast.success(item.status === "failed" ? "Message reprogrammé" : "Message programmé modifié", {
        description: message,
      });
      setAnnouncement(message);
      onChanged();
      return true;
    } catch {
      toast.error("Enregistrement impossible. Vérifiez votre connexion et réessayez.");
      return false;
    }
  }

  return (
    <section aria-label={`Messages programmés pour ${contactName}`} className="mt-2 flex flex-col gap-3">
      {items.length > 0 && (
        <div className="flex justify-center">
          <span className="flex items-center gap-1.5 rounded-full border border-dashed bg-background/90 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-xs backdrop-blur">
            <CalendarClock aria-hidden="true" className="size-3" />
            {pending
              ? `${pending} message${pending > 1 ? "s" : ""} programmé${pending > 1 ? "s" : ""}`
              : "Messages programmés"}
          </span>
        </div>
      )}
      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const failed = item.status === "failed";
          const overdue = !failed && new Date(item.scheduledAt).getTime() <= now.getTime();
          const author = item.author?.name?.trim() || "Un membre";
          return (
            <li key={item.id} className="flex w-full justify-end">
              <article
                aria-label={failed ? `Message programmé non envoyé, de ${author}` : `Message programmé de ${author}`}
                className="flex min-w-0 max-w-[85%] flex-col items-end gap-1 sm:max-w-[72%]"
              >
                <span className="flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
                  {failed ? <CircleAlert aria-hidden="true" className="size-3" /> : <Clock3 aria-hidden="true" className="size-3" />}
                  {author}
                </span>
                <div
                  className={cn(
                    "max-w-full rounded-2xl rounded-br-md border border-dashed px-3.5 py-2 text-sm leading-relaxed shadow-xs",
                    failed ? "border-destructive/40 bg-destructive/10" : "border-foreground/30 bg-muted/60",
                  )}
                >
                  <p dir="auto" className="whitespace-pre-wrap wrap-anywhere">
                    {item.content}
                  </p>
                  <p
                    className={cn(
                      "mt-1 flex items-center justify-end gap-1 text-[10px] tabular-nums",
                      failed ? "text-destructive" : "text-muted-foreground",
                    )}
                  >
                    <time dateTime={item.scheduledAt} title={timeZoneLabel(context.timeZone, new Date(item.scheduledAt))}>
                      {failed ? "Prévu " : overdue ? "Envoi en cours · prévu " : "Envoi "}
                      {formatScheduleDate(item.scheduledAt, context.timeZone)}
                    </time>
                    <span aria-hidden="true">·</span>
                    <span>{timeZoneCity(context.timeZone)}</span>
                  </p>
                </div>
                {failed && (
                  <p className="max-w-sm px-1 text-right text-xs leading-relaxed text-destructive">
                    Non envoyé : {scheduledFailureLabel(item.reason)}.
                  </p>
                )}
                {!failed && item.reason === "DISCONNECTED" && (
                  <p className="max-w-sm px-1 text-right text-xs leading-relaxed text-muted-foreground">
                    En attente de la reconnexion de WhatsApp.
                  </p>
                )}
                {(item.canEdit || item.canCancel) && (
                  <div className="flex items-center gap-1">
                    {item.canEdit && (
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        disabled={busyId === item.id}
                        onClick={() => setEditing(item)}
                        aria-label={`${failed ? "Reprogrammer" : "Modifier"} le message programmé ${formatScheduleDate(item.scheduledAt, context.timeZone)}`}
                      >
                        {failed ? <CalendarClock aria-hidden="true" /> : <Pencil aria-hidden="true" />}
                        {failed ? "Reprogrammer" : "Modifier"}
                      </Button>
                    )}
                    {item.canCancel && (
                      <Button
                        type="button"
                        size="xs"
                        variant="ghost"
                        disabled={busyId === item.id}
                        onClick={() => void cancel(item)}
                        aria-label={`${failed ? "Retirer" : "Annuler"} le message programmé ${formatScheduleDate(item.scheduledAt, context.timeZone)}`}
                      >
                        {busyId === item.id ? (
                          <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" />
                        ) : (
                          <X aria-hidden="true" />
                        )}
                        {failed ? "Retirer" : "Annuler l’envoi"}
                      </Button>
                    )}
                  </div>
                )}
              </article>
            </li>
          );
        })}
      </ul>
      <ScheduleMessageDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        context={context}
        contactName={contactName}
        mode={editing?.status === "failed" ? "reschedule" : "edit"}
        initialContent={editing?.content ?? ""}
        initialAt={editing ? new Date(editing.scheduledAt) : null}
        onSubmit={(content, at) => (editing ? save(editing, content, at) : Promise.resolve(false))}
      />
      <p role="status" className="sr-only">
        {announcement}
      </p>
    </section>
  );
}
