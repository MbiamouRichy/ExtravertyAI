import type { ReactNode } from "react";
import { BatteryFull, Signal, Wifi } from "lucide-react";

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Device shell shared by the live preview and its loading skeleton, so the
 * phone keeps exactly the same footprint when the wizard streams in.
 */
export function PhoneFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        // Device geometry: the only arbitrary radii of the page.
        "relative mx-auto flex h-[min(40rem,calc(100dvh-16rem))] min-h-112 w-76 flex-col rounded-[2.75rem] border bg-muted/60 p-2 shadow-2xl shadow-foreground/10 ring-1 ring-foreground/5",
        className,
      )}
    >
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2.25rem] border bg-background">
        <span
          aria-hidden="true"
          className="absolute top-2.5 left-1/2 z-20 h-6 w-22 -translate-x-1/2 rounded-full bg-foreground dark:bg-muted"
        />
        <div
          aria-hidden="true"
          className="relative z-10 flex h-10 shrink-0 items-end justify-between bg-card px-6 pb-1 font-mono text-[11px] font-medium"
        >
          <span>9:41</span>
          <span className="flex items-center gap-1">
            <Signal className="size-3" />
            <Wifi className="size-3" />
            <BatteryFull className="size-3.5" />
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Conversation placeholder for loading.tsx files, sized like the live chats. */
export function PhoneChatSkeleton() {
  return (
    <>
      <div className="flex shrink-0 items-center gap-2 border-b bg-card px-2.5 pt-1 pb-2.5">
        <Skeleton className="size-5 rounded-sm" />
        <Skeleton className="size-8 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-2.5 w-14" />
        </div>
        <Skeleton className="size-4.5 rounded-sm" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-end gap-2 bg-muted/50 p-3">
        <div className="mx-auto mb-2 flex w-full max-w-56 flex-col items-center gap-2 rounded-xl border bg-card p-3">
          <Skeleton className="size-11 rounded-full" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="h-2.5 w-24" />
          <Skeleton className="h-2.5 w-full" />
          <Skeleton className="h-2.5 w-4/5" />
        </div>
        <Skeleton className="mx-auto mb-1 h-4 w-20" />
        <Skeleton className="h-9 w-20 self-end rounded-2xl rounded-br-md" />
        <Skeleton className="h-20 w-[84%] self-start rounded-2xl rounded-bl-md" />
        <Skeleton className="h-9 w-40 self-end rounded-2xl rounded-br-md" />
        <Skeleton className="h-14 w-3/4 self-start rounded-2xl rounded-bl-md" />
      </div>

      <div className="flex shrink-0 items-center gap-2 border-t bg-card px-2.5 pt-2 pb-4">
        <Skeleton className="size-5 rounded-sm" />
        <Skeleton className="h-8 flex-1 rounded-full" />
        <Skeleton className="size-8 rounded-full" />
      </div>
    </>
  );
}
