"use client";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  MessageSquare,
  TriangleAlert,
  Inbox,
  ArrowUpRight,
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
  const items = feed.data?.items ?? [];
  const unread = items.filter((item) => !item.read);
  const visible = unreadOnly ? unread : items;
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
          <div>
            <h2 className="text-sm font-semibold">Notifications</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {unread.length} non lue{unread.length > 1 ? "s" : ""}
            </p>
          </div>
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
          </Button>
          <Button
            size="sm"
            variant={unreadOnly ? "secondary" : "ghost"}
            aria-pressed={unreadOnly}
            onClick={() => setUnreadOnly(true)}
          >
            Non lues
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
                <li key={item.key}>
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
                        <time
                          dateTime={item.date}
                          className="block text-[11px] text-muted-foreground"
                        >
                          {new Intl.DateTimeFormat("fr-FR", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          }).format(new Date(item.date))}
                        </time>
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
