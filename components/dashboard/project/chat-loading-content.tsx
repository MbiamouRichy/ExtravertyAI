import { Skeleton } from "@/components/ui/skeleton";

export function ConversationListLoading() {
  return (
    <div
      role="status"
      className="space-y-2 motion-reduce:**:data-[slot=skeleton]:animate-none"
    >
      <span className="sr-only">Chargement des conversations…</span>
      <div aria-hidden="true" className="space-y-2">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <div
            key={index}
            className="flex h-18 items-center gap-3 rounded-xl px-3 py-3"
          >
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <Skeleton className={`h-4 ${index % 2 ? "w-1/2" : "w-2/3"}`} />
                <Skeleton className="h-2 w-8 shrink-0" />
              </div>
              <Skeleton className={`h-3 ${index % 2 ? "w-full" : "w-4/5"}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConversationMessagesLoading() {
  return (
    <div
      role="status"
      className="mx-auto w-full max-w-4xl py-5 motion-reduce:**:data-[slot=skeleton]:animate-none"
    >
      <span className="sr-only">Chargement de la conversation…</span>
      <div aria-hidden="true" className="space-y-6">
        <Skeleton className="mx-auto h-6 w-28 rounded-full" />
        {[false, true, false].map((outgoing, index) => (
          <div
            key={index}
            className={`max-w-96 space-y-2 ${outgoing ? "ml-auto w-3/4" : "w-4/5"}`}
          >
            <Skeleton className={`h-3 w-24 ${outgoing ? "ml-auto" : ""}`} />
            <div
              className={`space-y-2 rounded-2xl bg-muted/40 p-4 ${outgoing ? "rounded-br-sm" : "rounded-bl-sm"}`}
            >
              <Skeleton className="h-3 w-full" />
              <Skeleton className={`h-3 ${outgoing ? "w-1/2" : "w-3/4"}`} />
            </div>
            <Skeleton className={`h-2 w-10 ${outgoing ? "ml-auto" : ""}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
