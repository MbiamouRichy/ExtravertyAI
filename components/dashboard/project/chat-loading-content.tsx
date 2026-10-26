import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Reprend les dimensions réelles des lignes de conversation pour éviter tout saut.
export function ConversationListLoading() {
  return (
    <div
      role="status"
      className="motion-reduce:**:data-[slot=skeleton]:animate-none"
    >
      <span className="sr-only">Chargement des conversations…</span>
      <ul aria-hidden="true" className="space-y-0.5">
        {[0, 1, 2, 3, 4, 5, 6].map((index) => (
          <li
            key={index}
            className="flex items-start gap-3 rounded-lg px-2.5 py-2.5"
          >
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="flex h-5 items-center justify-between gap-2">
                <Skeleton
                  className={cn("h-3.5", index % 2 ? "w-1/2" : "w-2/3")}
                />
                <Skeleton className="h-2.5 w-8 shrink-0" />
              </div>
              <div className="mt-0.5 flex h-4 items-center">
                <Skeleton
                  className={cn("h-3", index % 3 ? "w-4/5" : "w-full")}
                />
              </div>
              {/* Étiquette ou statut « Résolue » sur une ligne sur deux. */}
              {index % 2 === 0 && (
                <div className="mt-1.5 flex gap-1.5">
                  <Skeleton className="h-4 w-14 rounded-md" />
                  {index % 4 === 0 && (
                    <Skeleton className="h-4 w-10 rounded-md" />
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ConversationMessagesLoading() {
  return (
    <div
      role="status"
      className="mx-auto w-full max-w-4xl py-2 motion-reduce:**:data-[slot=skeleton]:animate-none"
    >
      <span className="sr-only">Chargement de la conversation…</span>
      <div aria-hidden="true" className="flex flex-col gap-5">
        <Skeleton className="mx-auto h-6 w-28 rounded-full" />
        {(["client", "agent", "client", "note", "bot"] as const).map(
          (kind, index) => (
            <div
              key={index}
              className={cn(
                "flex gap-2",
                kind === "client" ? "justify-start" : "justify-end",
              )}
            >
              <div
                className={cn(
                  "flex flex-col gap-1.5",
                  kind === "bot" ? "w-4/5 max-w-prose" : "w-3/4 max-w-sm",
                  kind !== "client" && "items-end",
                )}
              >
                <Skeleton className="h-2.5 w-20" />
                {kind === "bot" ? (
                  <div className="w-full space-y-2 py-1">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-11/12" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                ) : (
                  <div
                    className={cn(
                      "w-full space-y-2 rounded-2xl px-4 py-3",
                      kind === "client" && "bg-muted/60",
                      kind === "agent" && "bg-muted",
                      kind === "note" &&
                        "rounded-br-md border border-dashed border-foreground/20 bg-muted/40",
                    )}
                  >
                    <Skeleton className="h-3 w-full" />
                    <Skeleton
                      className={cn("h-3", index % 2 ? "w-1/2" : "w-3/4")}
                    />
                  </div>
                )}
                <Skeleton className="h-2 w-10" />
              </div>
              {(kind === "agent" || kind === "note") && (
                <Skeleton className="mt-4 size-6 shrink-0 rounded-full" />
              )}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
