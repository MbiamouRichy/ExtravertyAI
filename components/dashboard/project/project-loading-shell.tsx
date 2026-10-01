import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function ProjectLoadingShell({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-8 lg:py-10">
      <p role="status" className="sr-only">
        {label}
      </p>
      <div
        aria-hidden="true"
        className={cn(
          "space-y-8 motion-reduce:**:data-[slot=skeleton]:animate-none",
          className,
        )}
      >
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <Skeleton className="mb-2 h-4 w-48 max-w-full" />
            <Skeleton className="h-9 w-80 max-w-full" />
            <Skeleton className="mt-3 h-4 w-full max-w-lg" />
          </div>
          <Skeleton className="h-11 w-48 max-w-full shrink-0" />
        </div>
        {children}
      </div>
    </main>
  );
}
