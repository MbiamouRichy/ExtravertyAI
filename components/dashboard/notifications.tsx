"use client";
import { LocalDate } from "@/components/local-date";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import useSWR from "swr";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  MessageSquare,
  TriangleAlert,
  Inbox,
  ArrowUpRight,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type {
  AppNotification,
  NotificationFeed,
} from "@/lib/notification-types";

const SWIPE_THRESHOLD = 0.35;

/**
 * Glisser à gauche ou à droite pour supprimer, comme Messages sur Android.
 * Un défilement vertical n’est jamais pris pour un glissement, et un
 * glissement n’ouvre pas la notification.
 */
function SwipeToDismiss({
  children,
  disabled,
  onDismiss,
}: {
  children: ReactNode;
  disabled?: boolean;
  onDismiss: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const gesture = useRef<{
    x: number;
    y: number;
    id: number;
    locked: boolean | null;
  } | null>(null);
  const moved = useRef(false);
  const [offset, setOffset] = useState(0);
  // Largeur mesurée au début du geste : jamais lue sur la ref pendant le rendu.
  const [width, setWidth] = useState(300);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<-1 | 0 | 1>(0);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onDismiss, 180);
    return () => window.clearTimeout(timer);
  }, [leaving, onDismiss]);

  function end() {
    if (dragging && Math.abs(offset) > width * SWIPE_THRESHOLD) {
      setLeaving(offset > 0 ? 1 : -1);
    } else {
      setOffset(0);
    }
    setDragging(false);
    gesture.current = null;
  }

  const progress = Math.min(1, Math.abs(offset) / (width * SWIPE_THRESHOLD));

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Zone révélée sous la notification pendant le glissement. */}
      <div
        aria-hidden="true"
        style={{ opacity: leaving ? 1 : progress }}
        className={cn(
          "absolute inset-0 flex items-center gap-2 bg-destructive/10 px-5 text-xs font-medium text-destructive",
          offset >= 0 && leaving !== -1 ? "justify-start" : "justify-end",
        )}
      >
        <Trash2 className="size-4" />
        Supprimer
      </div>
      <div
        ref={ref}
        className="relative touch-pan-y bg-popover"
        style={{
          transform: leaving
            ? `translateX(${leaving * 110}%)`
            : `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 180ms ease-out",
        }}
        onPointerDown={(event) => {
          if (disabled || event.button !== 0 || leaving) return;
          setWidth(event.currentTarget.offsetWidth || 300);
          moved.current = false;
          gesture.current = {
            x: event.clientX,
            y: event.clientY,
            id: event.pointerId,
            locked: null,
          };
        }}
        onPointerMove={(event) => {
          const start = gesture.current;
          if (!start || start.id !== event.pointerId) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (start.locked === null) {
            if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) {
              start.locked = true;
              moved.current = true;
              setDragging(true);
              event.currentTarget.setPointerCapture(event.pointerId);
            } else if (Math.abs(dy) > 8) {
              gesture.current = null; // défilement vertical
            }
            return;
          }
          setOffset(dx);
        }}
        onPointerUp={end}
        onPointerCancel={end}
        // Un glissement ne doit pas ouvrir la conversation.
        onClickCapture={(event) => {
          if (moved.current) {
            event.preventDefault();
            event.stopPropagation();
            moved.current = false;
          }
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** Compteur d’onglet sur deux chiffres (« 02 », « 15 »). */
function TabCount({ value, active }: { value: number; active: boolean }) {
  return (
    <span
      className={
        "tabular-nums " + (active ? "text-foreground/70" : "text-muted-foreground")
      }
    >
      {String(value).padStart(2, "0")}
      <span className="sr-only"> notification{value > 1 ? "s" : ""}</span>
    </span>
  );
}
export function Notifications() {
  const [open, setOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const feed = useSWR<NotificationFeed>(
    "/api/notifications",
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error("Notifications indisponibles");
      return response.json();
    },
    {
      refreshInterval: 30000,
      refreshWhenHidden: false,
      shouldRetryOnError: false,
    },
  );
  // Suppressions en attente : masquées tout de suite, envoyées après 5 s sauf annulation.
  const [hidden, setHidden] = useState<string[]>([]);
  const timers = useRef(new Map<string, number>());
  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => window.clearTimeout(timer));
  }, []);
  const items = (feed.data?.items ?? []).filter(
    (item) => !hidden.includes(item.key),
  );
  const unread = items.filter((item) => !item.read);
  const visible = unreadOnly ? unread : items;
  async function commitDismiss(item: AppNotification) {
    timers.current.delete(item.key);
    try {
      const response = await fetch("/api/notifications", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          items: [{ key: item.key, version: item.version }],
        }),
      });
      if (!response.ok) throw new Error();
      await feed.mutate();
    } catch {
      // Échec : la notification réapparaît (voir finally).
      toast.error("La suppression n’a pas été enregistrée. Réessayez.");
    } finally {
      setHidden((current) => current.filter((key) => key !== item.key));
    }
  }
  function dismiss(item: AppNotification) {
    if (timers.current.has(item.key)) return;
    setHidden((current) => [...current, item.key]);
    const timer = window.setTimeout(() => void commitDismiss(item), 5000);
    timers.current.set(item.key, timer);
    toast("Notification supprimée", {
      action: {
        label: "Annuler",
        onClick: () => {
          window.clearTimeout(timers.current.get(item.key));
          timers.current.delete(item.key);
          setHidden((current) => current.filter((key) => key !== item.key));
        },
      },
      duration: 5000,
    });
  }
  async function markRead(selected: AppNotification[]) {
    if (!selected.length || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          items: selected.map(({ key, version }) => ({ key, version })),
        }),
      });
      if (!response.ok) throw new Error();
      await feed.mutate();
    } catch {
      setSaveError("La lecture n’a pas été enregistrée. Réessayez.");
    } finally {
      setSaving(false);
    }
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="icon-sm"
          variant="outline"
          className="relative"
          aria-label={
            unread.length
              ? "Notifications, " + unread.length + " non lues"
              : "Notifications"
          }
        >
          <Bell />
          {unread.length > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-1.5 -top-1.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground"
            >
              {unread.length}
              {feed.data?.limited ? "+" : ""}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[calc(100vw-2rem)] max-w-96 overflow-hidden p-0"
      >
        <div className="flex items-center justify-between gap-2 border-b p-4">
          <h2 className="text-sm font-semibold">Notifications</h2>
          <Button
            size="icon"
            variant="ghost"
            disabled={saving || !unread.length}
            aria-label="Tout marquer comme lu"
            title="Tout marquer comme lu"
            onClick={() => void markRead(unread)}
          >
            <CheckCheck />
          </Button>
        </div>
        <div className="flex gap-2 px-4 py-2">
          <Button
            size="sm"
            variant={!unreadOnly ? "secondary" : "ghost"}
            aria-pressed={!unreadOnly}
            onClick={() => setUnreadOnly(false)}
          >
            Toutes
            <TabCount value={items.length} active={!unreadOnly} />
          </Button>
          <Button
            size="sm"
            variant={unreadOnly ? "secondary" : "ghost"}
            aria-pressed={unreadOnly}
            onClick={() => setUnreadOnly(true)}
          >
            Non lues
            <TabCount value={unread.length} active={unreadOnly} />
          </Button>
        </div>
        {saveError && (
          <p role="alert" className="px-4 pb-2 text-xs text-destructive">
            {saveError}
          </p>
        )}
        <div className="max-h-[min(55dvh,28rem)] overflow-y-auto overscroll-contain">
          {feed.error ? (
            <div role="alert" className="space-y-3 p-6 text-center text-sm">
              <p>Impossible de charger les notifications.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void feed.mutate()}
              >
                Réessayer
              </Button>
            </div>
          ) : feed.isLoading ? (
            <div
              role="status"
              aria-label="Chargement des notifications"
              className="space-y-4 p-4"
            >
              {[0, 1, 2].map((n) => (
                <div
                  key={n}
                  className="h-16 rounded-lg bg-muted motion-safe:animate-pulse"
                />
              ))}
            </div>
          ) : !visible.length ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <Inbox className="mb-1 size-7 text-muted-foreground" />
              <p className="text-sm font-medium">
                {unreadOnly ? "Vous êtes à jour" : "Aucune notification"}
              </p>
              <p className="text-xs text-muted-foreground">
                Les messages et alertes de vos projets apparaîtront ici.
              </p>
            </div>
          ) : (
            <ul className="space-y-1 p-2">
              {visible.map((item) => (
                <li key={item.key} className="group/item relative">
                  <SwipeToDismiss
                    disabled={item.kind === "alert"}
                    onDismiss={() => dismiss(item)}
                  >
                  <Link
                    href={item.href}
                    onClick={() => {
                      if (!item.read) void markRead([item]);
                      setOpen(false);
                    }}
                    className={cn(
                      "group flex items-start gap-3 rounded-xl p-3 text-sm transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      !item.read && "bg-primary/5",
                    )}
                  >
                    <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-foreground">
                      {item.kind === "message" ? (
                        <MessageSquare className="size-4" />
                      ) : (
                        <TriangleAlert className="size-4 text-destructive" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {item.projectName}
                      </span>
                      <span className="block wrap-anywhere font-semibold leading-snug">
                        {item.title}
                      </span>
                      <span className="block line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                        {item.kind === "message"
                          ? "Consulter la conversation"
                          : item.description}
                      </span>
                      {item.date && (
                        <span className="block text-[11px] text-muted-foreground">
                          <LocalDate
                            value={item.date}
                            options={{
                              day: "numeric",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            }}
                          />
                        </span>
                      )}
                    </span>
                    <ArrowUpRight
                      aria-hidden
                      className="mt-1 size-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                    />
                    {!item.read && (
                      <span className="mt-2 size-2 shrink-0 rounded-full bg-primary">
                        <span className="sr-only">Non lue</span>
                      </span>
                    )}
                  </Link>
                  </SwipeToDismiss>
                  {/* Alternative au glissement : souris et clavier. */}
                  {item.kind !== "alert" && (
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Supprimer la notification « ${item.title} »`}
                      onClick={() => dismiss(item)}
                      className="absolute right-2 bottom-2 opacity-0 transition-opacity group-hover/item:opacity-100 focus-visible:opacity-100"
                    >
                      <X />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
          {feed.data?.limited
            ? "50 notifications affichées · Consultez vos projets pour la suite."
            : "Messages des 30 derniers jours et alertes en cours."}
        </p>
      </PopoverContent>
    </Popover>
  );
}
