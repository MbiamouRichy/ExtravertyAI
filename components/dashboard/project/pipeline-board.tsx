"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import {
  ArrowRightLeft,
  CircleDollarSign,
  GripVertical,
  MessageSquare,
  MoreHorizontal,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { getInitials } from "@/components/getInitials";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useChatRealtime } from "@/hooks/use-chat-data";
import { formatWaiting, useNow } from "@/hooks/use-now";
import { movePipelineStageAction, setProjectCurrencyAction } from "@/app/actions/pipeline";
import {
  CURRENCIES,
  PIPELINE_STAGES,
  formatDealValue,
  type PipelineCard,
  type PipelineColumn,
  type PipelineStageId,
} from "@/lib/pipeline-shared";
import { DealValueForm } from "./pipeline-controls";

const OPEN_STAGES: PipelineStageId[] = ["NEW", "INTERESTED", "QUOTE_SENT"];

/** Arrow keys jump from column to column instead of moving a few pixels. */
const columnKeyboardCoordinates: KeyboardCoordinateGetter = (
  event,
  { currentCoordinates, context: { droppableRects, collisionRect } },
) => {
  if (!collisionRect || (event.code !== "ArrowRight" && event.code !== "ArrowLeft")) {
    return currentCoordinates;
  }
  event.preventDefault();
  const columns = [...droppableRects.values()].sort((a, b) => a.left - b.left);
  const centerX = collisionRect.left + collisionRect.width / 2;
  const current = columns.findIndex((rect) => centerX >= rect.left && centerX <= rect.left + rect.width);
  const target = columns[(current === -1 ? 0 : current) + (event.code === "ArrowRight" ? 1 : -1)];
  if (!target) return currentCoordinates;
  return {
    x: target.left + target.width / 2 - collisionRect.width / 2,
    y: target.top + 56,
  };
};

export function PipelineBoard({
  projectId,
  currency,
  columns,
  canManage,
}: {
  projectId: string;
  currency: string;
  columns: PipelineColumn[];
  canManage: boolean;
}) {
  const router = useRouter();
  const now = useNow();
  const [, startTransition] = useTransition();
  // Optimistic stage per contact until the refreshed server data arrives.
  const [overrides, setOverrides] = useState<Record<string, PipelineStageId>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<PipelineCard | null>(null);

  useChatRealtime(projectId, () => startTransition(() => router.refresh()));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: columnKeyboardCoordinates }),
  );

  const board = useMemo(() => {
    const moved = new Map<string, { card: PipelineCard; from: PipelineStageId }>();
    for (const column of columns) {
      for (const card of column.cards) {
        if (overrides[card.id] && overrides[card.id] !== column.id) {
          moved.set(card.id, { card, from: column.id });
        }
      }
    }
    return columns.map((column) => {
      const incoming = [...moved.values()].filter(({ card }) => overrides[card.id] === column.id);
      const outgoing = [...moved.values()].filter(({ from }) => from === column.id);
      const delta = (list: typeof incoming) =>
        list.reduce((sum, { card }) => sum + (card.dealValue ?? 0), 0);
      return {
        ...column,
        count: column.count + incoming.length - outgoing.length,
        total: column.total + delta(incoming) - delta(outgoing),
        cards: [
          ...incoming.map(({ card }) => card),
          ...column.cards.filter((card) => !moved.has(card.id)),
        ],
      };
    });
  }, [columns, overrides]);

  const cardById = useMemo(
    () => new Map(board.flatMap((column) => column.cards.map((card) => [card.id, { card, stage: column.id }] as const))),
    [board],
  );

  const openValue = board
    .filter((column) => OPEN_STAGES.includes(column.id))
    .reduce((sum, column) => sum + column.total, 0);
  const won = board.find((column) => column.id === "WON");
  const lost = board.find((column) => column.id === "LOST");
  const closed = (won?.count ?? 0) + (lost?.count ?? 0);
  const winRate = closed ? Math.round(((won?.count ?? 0) / closed) * 100) : null;

  function move(card: PipelineCard, from: PipelineStageId, to: PipelineStageId) {
    if (from === to) return;
    setOverrides((current) => ({ ...current, [card.id]: to }));
    startTransition(async () => {
      const result = await movePipelineStageAction({ projectId, contactId: card.id, stage: to });
      if (!result.success) toast.error(result.error);
      startTransition(() => {
        setOverrides((current) => {
          const next = { ...current };
          delete next[card.id];
          return next;
        });
        router.refresh();
      });
    });
  }

  const label = (stage: string | number | undefined) =>
    PIPELINE_STAGES.find((item) => item.id === stage)?.label ?? "aucune colonne";
  const nameOf = (id: string | number) => cardById.get(String(id))?.card.name ?? "Prospect";

  const announcements: Announcements = {
    onDragStart: ({ active }) =>
      `${nameOf(active.id)} saisi. Flèches gauche et droite pour changer de colonne, Espace pour déposer, Échap pour annuler.`,
    onDragOver: ({ active, over }) =>
      over ? `${nameOf(active.id)} au-dessus de « ${label(over.id)} ».` : `${nameOf(active.id)} hors des colonnes.`,
    onDragEnd: ({ active, over }) =>
      over ? `${nameOf(active.id)} déposé dans « ${label(over.id)} ».` : `${nameOf(active.id)} relâché sans changement.`,
    onDragCancel: ({ active }) => `Déplacement de ${nameOf(active.id)} annulé.`,
  };

  function onDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function onDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const entry = cardById.get(String(event.active.id));
    const to = event.over?.id as PipelineStageId | undefined;
    if (entry && to) move(entry.card, entry.stage, to);
  }

  const active = activeId ? cardById.get(activeId) : null;

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border bg-border xl:grid-cols-4">
        {[
          { label: "En cours", value: formatDealValue(openValue, currency), hint: "Nouveau, Intéressé et Devis envoyé" },
          { label: "Gagné", value: formatDealValue(won?.total ?? 0, currency), hint: `${won?.count ?? 0} affaire(s)` },
          { label: "Taux de conversion", value: winRate === null ? "—" : `${winRate} %`, hint: "Gagné sur gagné + perdu" },
          { label: "Prospects", value: board.reduce((sum, column) => sum + column.count, 0).toLocaleString("fr-FR"), hint: "Toutes étapes confondues" },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col-reverse gap-1 bg-card p-4">
            <dt className="text-xs text-muted-foreground">
              {stat.label}
              <span className="block text-[11px]">{stat.hint}</span>
            </dt>
            <dd className="break-words font-heading text-xl font-bold tracking-tight tabular-nums sm:text-2xl">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {canManage && (
        <div className="flex items-center justify-end gap-2 text-xs">
          <label htmlFor="pipeline-currency" className="text-muted-foreground">
            Devise des montants
          </label>
          <Select
            value={currency}
            onValueChange={(value) =>
              startTransition(async () => {
                const result = await setProjectCurrencyAction({
                  projectId,
                  currency: value as (typeof CURRENCIES)[number],
                });
                if (!result.success) toast.error(result.error);
                else toast.success(`Devise : ${value}. Les montants existants ne sont pas convertis.`);
                startTransition(() => router.refresh());
              })
            }
          >
            <SelectTrigger id="pipeline-currency" size="sm" className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setActiveId(null)}
        accessibility={{
          announcements,
          screenReaderInstructions: {
            draggable:
              "Pour déplacer ce prospect, appuyez sur Espace, changez de colonne avec les flèches gauche et droite, puis appuyez de nouveau sur Espace. Échap annule.",
          },
        }}
      >
        <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 xl:-mx-8 xl:px-8">
          <ol aria-label="Étapes du pipeline" className="flex min-w-max gap-3 2xl:grid 2xl:min-w-0 2xl:grid-cols-5">
            {board.map((column) => (
              <StageColumn key={column.id} column={column} currency={currency}>
                {column.cards.map((card) => (
                  <DraggableCard
                    key={card.id}
                    card={card}
                    stage={column.id}
                    currency={currency}
                    projectId={projectId}
                    now={now}
                    onMove={(to) => move(card, column.id, to)}
                    onEditValue={() => setEditing(card)}
                  />
                ))}
              </StageColumn>
            ))}
          </ol>
        </div>
        <DragOverlay dropAnimation={null}>
          {active ? <CardBody card={active.card} currency={currency} now={now} overlay /> : null}
        </DragOverlay>
      </DndContext>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Montant de l’affaire</DialogTitle>
            <DialogDescription>{editing?.name}</DialogDescription>
          </DialogHeader>
          {editing && (
            <DealValueForm
              projectId={projectId}
              contactId={editing.id}
              currency={currency}
              value={editing.dealValue}
              autoFocus
              onSaved={() => {
                setEditing(null);
                startTransition(() => router.refresh());
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StageColumn({
  column,
  currency,
  children,
}: {
  column: PipelineColumn;
  currency: string;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const hidden = column.count - column.cards.length;
  return (
    <li
      aria-labelledby={`stage-${column.id}`}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-2xl border bg-muted/30 transition-colors 2xl:w-auto",
        isOver && "border-foreground/40 bg-muted",
      )}
    >
      <header className="flex items-start justify-between gap-2 border-b p-3">
        <div className="min-w-0">
          <h2 id={`stage-${column.id}`} className="flex items-center gap-2 text-sm font-semibold tracking-normal">
            {column.label}
            <span className="rounded-full bg-background px-1.5 font-mono text-[11px] font-normal tabular-nums text-muted-foreground">
              {column.count}
            </span>
          </h2>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{column.hint}</p>
        </div>
        <span className="shrink-0 font-mono text-xs tabular-nums">{formatDealValue(column.total, currency)}</span>
      </header>
      <ul ref={setNodeRef} className="flex min-h-40 flex-1 flex-col gap-2 p-2">
        {children}
        {column.count === 0 && (
          <li className="flex flex-1 items-center justify-center rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
            Glissez un prospect ici
          </li>
        )}
        {hidden > 0 && (
          <li className="px-2 py-1 text-center text-[11px] text-muted-foreground">
            + {hidden.toLocaleString("fr-FR")} autres prospects
          </li>
        )}
      </ul>
    </li>
  );
}

function CardBody({
  card,
  currency,
  now,
  overlay = false,
}: {
  card: PipelineCard;
  currency: string;
  now: number | null;
  overlay?: boolean;
}) {
  return (
    <div className={cn("min-w-0 flex-1", overlay && "rounded-xl border bg-card p-3 shadow-xl")}>
      <p className="flex items-center gap-1.5 text-sm font-medium">
        <span className="truncate">{card.name}</span>
        {card.interesting && (
          <Sparkles aria-label="Prospect intéressant selon Instinct IA" className="size-3.5 shrink-0" />
        )}
      </p>
      <p className="mt-1 font-mono text-xs tabular-nums">
        {card.dealValue !== null ? (
          formatDealValue(card.dealValue, currency)
        ) : (
          <span className="text-muted-foreground">Montant à définir</span>
        )}
      </p>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {card.assignee && (
          <Avatar className="size-4" title={`Assigné à ${card.assignee.name ?? "un membre"}`}>
            <AvatarImage src={card.assignee.image || undefined} alt="" />
            <AvatarFallback className="text-[8px] font-semibold">
              {getInitials(card.assignee.name?.trim() || "Membre")}
            </AvatarFallback>
          </Avatar>
        )}
        {now && <span>Activité · {formatWaiting(card.lastActivityAt, now)}</span>}
      </p>
    </div>
  );
}

function DraggableCard({
  card,
  stage,
  currency,
  projectId,
  now,
  onMove,
  onEditValue,
}: {
  card: PipelineCard;
  stage: PipelineStageId;
  currency: string;
  projectId: string;
  now: number | null;
  onMove: (to: PipelineStageId) => void;
  onEditValue: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: card.id,
  });

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "group flex items-start gap-1.5 rounded-xl border bg-card p-2.5 shadow-xs transition-[opacity,box-shadow] hover:shadow-md hover:shadow-foreground/5",
        isDragging && "opacity-40",
      )}
    >
      <Button
        ref={setActivatorNodeRef}
        type="button"
        variant="ghost"
        size="icon-xs"
        className="mt-0.5 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
        aria-label={`Déplacer ${card.name}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical aria-hidden="true" />
      </Button>
      <CardBody card={card} currency={currency} now={now} />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-xs" aria-label={`Actions pour ${card.name}`}>
            <MoreHorizontal aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="truncate">{card.name}</DropdownMenuLabel>
          <DropdownMenuItem asChild>
            <Link href={`/projects/${projectId}/chat?contactId=${encodeURIComponent(card.id)}`}>
              <MessageSquare aria-hidden="true" />
              Ouvrir la conversation
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={onEditValue}>
            <CircleDollarSign aria-hidden="true" />
            {card.dealValue === null ? "Ajouter un montant" : "Modifier le montant"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <ArrowRightLeft aria-hidden="true" />
              Déplacer vers…
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {PIPELINE_STAGES.filter((item) => item.id !== stage).map((item) => (
                <DropdownMenuItem key={item.id} onSelect={() => onMove(item.id)}>
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
