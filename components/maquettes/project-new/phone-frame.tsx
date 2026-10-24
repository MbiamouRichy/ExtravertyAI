import type { ReactNode } from "react";
import { BatteryFull, Signal, Wifi } from "lucide-react";

import { cn } from "@/lib/utils";

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
