"use client";
import useSWR from "swr";
import type { PresenceStatus } from "@/lib/presence";
import { cn } from "@/lib/utils";
export function useProjectPresence(projectId: string) {
  return useSWR<{ userId: string; status: PresenceStatus }[]>(
    "/api/projects/" + encodeURIComponent(projectId) + "/presence",
    async (url: string) => {
      const result = await fetch(url);
      if (!result.ok) throw new Error("Présence indisponible");
      return result.json();
    },
    {
      refreshInterval: 20000,
      dedupingInterval: 10000,
      refreshWhenHidden: false,
      shouldRetryOnError: false,
    },
  );
}
export function MemberPresence({ status }: { status?: PresenceStatus }) {
  const label =
    status === "online"
      ? "En ligne"
      : status === "idle"
        ? "Inactif"
        : status === "offline"
          ? "Hors ligne"
          : "Présence indisponible";
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
      title={label}
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex size-2 rounded-full",
          status === "online"
            ? "bg-emerald-500"
            : status === "idle"
              ? "bg-amber-500"
              : "bg-muted-foreground/50",
        )}
      >
        {status === "online" && (
          <span className="absolute inset-0 rounded-full bg-emerald-500 motion-safe:animate-ping" />
        )}
      </span>
      {label}
    </span>
  );
}
