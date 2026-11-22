"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  Building2,
  Check,
  Copy,
  GripVertical,
  House,
  Loader2,
  Mail,
  MapPin,
  Maximize2,
  Minimize2,
  PanelRightOpen,
  Pencil,
  Phone,
  ScanText,
  UserRound,
  type LucideIcon,
} from "lucide-react";

import { saveProspectCaptureAction } from "@/app/actions/prospect-capture";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CAPTURE_FIELD_KEYS,
  CAPTURE_FIELDS,
  CaptureEditSchema,
  captureFormValues,
  type CaptureEditValues,
  type CaptureFieldKey,
  type CapturedField,
  type ProspectCaptureView,
} from "@/lib/prospect-capture-shared";
import { cn } from "@/lib/utils";

const FIELD_ICON: Record<CaptureFieldKey, LucideIcon> = {
  fullName: UserRound,
  email: Mail,
  phone: Phone,
  city: MapPin,
  address: House,
  company: Building2,
};

const capturedDate = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function originLabel(field: CapturedField) {
  const date = capturedDate.format(new Date(field.at));
  return field.origin === "team"
    ? `Saisi par l’équipe le ${date}`
    : `Relevé dans un message du prospect le ${date}`;
}

function CopyValueButton({ field }: { field: CapturedField }) {
  const [copied, setCopied] = useState(false);
  const label = `Copier : ${CAPTURE_FIELDS[field.key].label}`;
  async function copy() {
    try {
      await navigator.clipboard.writeText(field.value);
      setCopied(true);
      toast.success(`${CAPTURE_FIELDS[field.key].label} copié`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("La copie est indisponible.");
    }
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={label}
          onClick={() => void copy()}
        >
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function CaptureFieldList({ fields, compact = false }: { fields: CapturedField[]; compact?: boolean }) {
  return (
    <dl className={cn("divide-y", !compact && "rounded-xl border")}>
      {fields.map((field) => {
        const Icon = FIELD_ICON[field.key];
        return (
          <div
            key={field.key}
            className={cn("flex items-center gap-2.5 text-xs", compact ? "min-h-9 px-3" : "min-h-10 pl-3 pr-1.5")}
          >
            <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
            <dt className="shrink-0 text-muted-foreground">{CAPTURE_FIELDS[field.key].label}</dt>
            <dd className="flex min-w-0 flex-1 items-center justify-end gap-1">
              <span title={`${field.value} · ${originLabel(field)}`} className="min-w-0 truncate text-right font-medium">
                {field.value}
              </span>
              {field.origin === "team" && (
                <span className="shrink-0 rounded-sm border px-1 text-[10px] leading-4 text-muted-foreground">
                  équipe
                </span>
              )}
              <span className="sr-only">{originLabel(field)}</span>
              <CopyValueButton field={field} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

function CaptureEditForm({
  projectId,
  contactId,
  capture,
  onSaved,
}: {
  projectId: string;
  contactId: string;
  capture: ProspectCaptureView | undefined;
  onSaved: () => void;
}) {
  // Ce que le membre voit à l’ouverture : seuls les champs qu’il modifie sont écrits.
  const [base] = useState(() => captureFormValues(capture));
  const form = useForm<CaptureEditValues>({
    resolver: zodResolver(CaptureEditSchema),
    defaultValues: base,
  });
  const saving = form.formState.isSubmitting;

  async function onSubmit(values: CaptureEditValues) {
    const result = await saveProspectCaptureAction({ projectId, contactId, values, base });
    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Informations enregistrées");
    onSaved();
  }

  return (
    <form
      id={`capture-form-${contactId}`}
      noValidate
      aria-busy={saving}
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <FieldGroup className="gap-4">
        {CAPTURE_FIELD_KEYS.map((key) => (
          <Controller
            key={key}
            name={key}
            control={form.control}
            render={({ field, fieldState }) => {
              const id = `capture-${contactId}-${key}`;
              return (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={id}>{CAPTURE_FIELDS[key].label}</FieldLabel>
                  <Input
                    {...field}
                    id={id}
                    type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
                    inputMode={key === "email" ? "email" : key === "phone" ? "tel" : undefined}
                    // Informations du prospect : le navigateur ne doit pas y glisser celles du membre.
                    autoComplete="off"
                    spellCheck={key === "email" || key === "phone" ? false : undefined}
                    maxLength={CAPTURE_FIELDS[key].max}
                    placeholder={CAPTURE_FIELDS[key].placeholder}
                    disabled={saving}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={fieldState.invalid ? `${id}-error` : undefined}
                  />
                  {fieldState.invalid && <FieldError id={`${id}-error`} errors={[fieldState.error]} />}
                </Field>
              );
            }}
          />
        ))}
      </FieldGroup>
      <DialogFooter className="mt-6">
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={saving}>
            Annuler
          </Button>
        </DialogClose>
        <Button type="submit" disabled={saving}>
          {saving && (
            <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" />
          )}
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function CaptureEditDialog({
  open,
  onOpenChange,
  projectId,
  contactId,
  contactName,
  capture,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  contactId: string;
  contactName: string;
  capture: ProspectCaptureView | undefined;
  onChanged: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Informations de {contactName}</DialogTitle>
          <DialogDescription>
            Corrigez ou complétez ce que Capture IA a relevé. Un champ vidé retire
            l’information ; une valeur saisie ici n’est plus remplacée par l’IA.
          </DialogDescription>
        </DialogHeader>
        {open && (
          <CaptureEditForm
            projectId={projectId}
            contactId={contactId}
            capture={capture}
            onSaved={() => {
              onOpenChange(false);
              onChanged();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type CaptureProps = {
  projectId: string;
  contactId: string;
  contactName: string;
  /** Absent tant que la conversation charge. */
  capture: ProspectCaptureView | undefined;
  /** Recharge la conversation après une correction. */
  onChanged: () => void;
};

/** Section de la fiche contact. */
export function ProspectCaptureSection({ projectId, contactId, contactName, capture, onChanged }: CaptureProps) {
  const [editing, setEditing] = useState(false);
  const fields = capture?.fields ?? [];
  const titleId = `capture-${contactId}`;
  return (
    <section aria-labelledby={titleId}>
      <h2 id={titleId} className="sr-only">
        Informations relevées par l’IA
      </h2>
      {!capture ? (
        <div
          role="status"
          aria-label="Chargement des informations du prospect"
          className="h-16 rounded-xl bg-muted motion-safe:animate-pulse"
        />
      ) : fields.length ? (
        <>
          <CaptureFieldList fields={fields} />
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <p className="min-w-0 text-[11px] leading-relaxed text-muted-foreground">
              Relevé dans les messages du prospect. Vérifiez avant de l’utiliser.
            </p>
            <Button type="button" variant="ghost" size="xs" className="shrink-0" onClick={() => setEditing(true)}>
              <Pencil data-icon="inline-start" />
              Modifier
              <span className="sr-only"> les informations du prospect</span>
            </Button>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed p-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            Aucune information supplémentaire sur ce prospect pour l’instant.
            <span className="max-sm:hidden">
              {" "}
              Le nom, l’e-mail, la ville ou l’adresse qu’il donne apparaîtront ici.
            </span>
          </p>
          <Button type="button" variant="outline" size="xs" onClick={() => setEditing(true)}>
            <Pencil data-icon="inline-start" />
            Ajouter
            <span className="sr-only"> des informations sur le prospect</span>
          </Button>
        </div>
      )}
      <CaptureEditDialog
        open={editing}
        onOpenChange={setEditing}
        projectId={projectId}
        contactId={contactId}
        contactName={contactName}
        capture={capture}
        onChanged={onChanged}
      />
    </section>
  );
}

type CardPlacement = { right: number; top: number; collapsed: boolean };
const MARGIN = 8;
const STEP = 16;

function storageKey(projectId: string) {
  return `extraverty:capture-card:${projectId}`;
}

/**
 * Préférence de ce navigateur seulement ; illisible ou bloquée : place par
 * défaut, réduite sur un écran étroit. La carte n’est jamais rendue côté
 * serveur (elle attend les données de la conversation).
 */
function initialPlacement(projectId: string): CardPlacement {
  const fallback = {
    right: 12,
    top: 12,
    collapsed: typeof window !== "undefined" && window.innerWidth < 640,
  };
  try {
    const raw = JSON.parse(window.localStorage.getItem(storageKey(projectId)) ?? "null");
    if (!raw || typeof raw !== "object") return fallback;
    return {
      right: Number.isFinite(raw.right) ? raw.right : fallback.right,
      top: Number.isFinite(raw.top) ? raw.top : fallback.top,
      collapsed: typeof raw.collapsed === "boolean" ? raw.collapsed : fallback.collapsed,
    };
  } catch {
    return fallback;
  }
}

function writePlacement(projectId: string, placement: CardPlacement) {
  try {
    window.localStorage.setItem(storageKey(projectId), JSON.stringify(placement));
  } catch {
    // Stockage indisponible : la carte reprendra sa place par défaut.
  }
}

/**
 * Carte posée sur la conversation quand la fiche contact est fermée : on peut
 * la réduire et la déplacer (souris, doigt ou flèches du clavier).
 */
export function ProspectCaptureFloating({
  projectId,
  contactId,
  contactName,
  capture,
  onChanged,
  onOpenContact,
  className,
}: CaptureProps & { onOpenContact: () => void; className?: string }) {
  const cardRef = useRef<HTMLElement>(null);
  const [placement, setPlacement] = useState<CardPlacement>(() => initialPlacement(projectId));
  const [dragging, setDragging] = useState(false);
  const [editing, setEditing] = useState(false);
  const drag = useRef<{ pointerId: number; x: number; y: number; right: number; top: number } | null>(null);

  const clamp = useCallback((next: CardPlacement): CardPlacement => {
    const card = cardRef.current;
    const box = card?.parentElement;
    if (!card || !box) return next;
    const maxRight = Math.max(MARGIN, box.clientWidth - card.offsetWidth - MARGIN);
    const maxTop = Math.max(MARGIN, box.clientHeight - card.offsetHeight - MARGIN);
    return {
      ...next,
      right: Math.round(Math.min(Math.max(next.right, MARGIN), maxRight)),
      top: Math.round(Math.min(Math.max(next.top, MARGIN), maxTop)),
    };
  }, []);

  // Affichage, fenêtre redimensionnée ou carte agrandie : elle reste dans la
  // conversation. L’observateur répond avant le premier affichage.
  useEffect(() => {
    const box = cardRef.current?.parentElement;
    if (!box || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setPlacement((current) => clamp(current)));
    observer.observe(box);
    if (cardRef.current) observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [clamp]);

  function update(next: CardPlacement, persist = true) {
    const clamped = clamp(next);
    setPlacement(clamped);
    if (persist) writePlacement(projectId, clamped);
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.closest("button:not([data-drag-handle])")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      right: placement.right,
      top: placement.top,
    };
    setDragging(true);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (!start || start.pointerId !== event.pointerId) return;
    update(
      {
        ...placement,
        right: start.right - (event.clientX - start.x),
        top: start.top + (event.clientY - start.y),
      },
      false,
    );
  }

  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    writePlacement(projectId, placement);
  }

  function onHandleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? STEP * 3 : STEP;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    update({ ...placement, right: placement.right + move[0], top: placement.top + move[1] });
  }

  const fields = capture?.fields ?? [];
  const collapsed = placement.collapsed;
  const toggle = () => update({ ...placement, collapsed: !collapsed });

  return (
    <section
      ref={cardRef}
      aria-label={`Capture IA : informations de ${contactName}`}
      style={{ right: placement.right, top: placement.top }}
      className={cn(
        "absolute z-20 overflow-hidden rounded-xl border bg-background/95 shadow-lg backdrop-blur",
        collapsed ? "w-auto max-w-[calc(100%-1rem)]" : "w-72 max-w-[calc(100%-1rem)]",
        dragging && "cursor-grabbing select-none shadow-xl",
        className,
      )}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={cn(
          "flex touch-none items-center gap-1 py-1 pl-1 pr-1",
          !collapsed && "border-b",
          dragging ? "cursor-grabbing" : "cursor-grab",
        )}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              data-drag-handle
              aria-label="Déplacer la carte Capture IA (flèches du clavier)"
              onKeyDown={onHandleKeyDown}
              className="cursor-grab text-muted-foreground"
            >
              <GripVertical aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Glisser pour déplacer</TooltipContent>
        </Tooltip>
        <ScanText aria-hidden="true" className="size-3.5 shrink-0" />
        <p className="min-w-0 flex-1 truncate text-xs font-medium">
          Capture IA
          <span className="ml-1.5 font-mono text-[11px] font-normal text-muted-foreground tabular-nums">
            {fields.length}
            <span className="sr-only"> {fields.length > 1 ? "informations" : "information"}</span>
          </span>
        </p>
        {!collapsed && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Ouvrir la fiche contact"
                onClick={onOpenContact}
              >
                <PanelRightOpen aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Ouvrir la fiche contact</TooltipContent>
          </Tooltip>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Agrandir la carte Capture IA" : "Réduire la carte Capture IA"}
              onClick={toggle}
            >
              {collapsed ? <Maximize2 aria-hidden="true" /> : <Minimize2 aria-hidden="true" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{collapsed ? "Agrandir" : "Réduire"}</TooltipContent>
        </Tooltip>
      </div>
      {!collapsed && (
        <>
          <div className="max-h-64 overflow-y-auto">
            <CaptureFieldList fields={fields} compact />
          </div>
          <div className="flex items-center justify-between gap-2 border-t px-3 py-1.5">
            <p className="min-w-0 truncate text-[11px] text-muted-foreground">
              Relevé dans ses messages
            </p>
            <Button type="button" variant="ghost" size="xs" onClick={() => setEditing(true)}>
              <Pencil data-icon="inline-start" />
              Modifier
            </Button>
          </div>
        </>
      )}
      <CaptureEditDialog
        open={editing}
        onOpenChange={setEditing}
        projectId={projectId}
        contactId={contactId}
        contactName={contactName}
        capture={capture}
        onChanged={onChanged}
      />
    </section>
  );
}
