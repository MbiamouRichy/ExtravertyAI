import { Skeleton } from "@/components/ui/skeleton";
import {
  ConversationListLoading,
  ConversationMessagesLoading,
} from "@/components/dashboard/project/chat-loading-content";

export default function ChatLoading() {
  return (
    <div
      aria-busy="true"
      aria-label="Chargement du chat"
      className="flex h-[calc(100dvh-var(--spacing)*14)] min-h-0 w-full flex-col overflow-hidden bg-background md:h-[calc(100dvh-var(--spacing)*18)] motion-reduce:**:data-[slot=skeleton]:animate-none"
    >
      <p role="status" className="sr-only">
        Chargement du chat…
      </p>
      <div
        aria-hidden="true"
        className="flex min-h-0 w-full flex-1 gap-3 overflow-hidden p-3"
      >
        <div className="flex min-h-0 w-full shrink-0 flex-col overflow-hidden rounded-xl border border-border bg-card md:w-80 xl:w-96">
          <div className="space-y-4 border-b border-border/70 p-4 xl:p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-6 w-44" />
              </div>
              <Skeleton className="size-10 shrink-0 rounded-xl" />
            </div>
            <Skeleton className="h-10 w-full rounded-xl" />
            <div className="flex gap-1 rounded-xl bg-muted/50 p-1">
              {[0, 1, 2].map((index) => (
                <Skeleton
                  key={index}
                  className="h-9 min-w-0 flex-1 rounded-lg"
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden px-2 pb-4">
            <ConversationListLoading />
          </div>
        </div>
        <div className="relative hidden min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border md:flex">
          <div className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-36 max-w-full" />
              <Skeleton className="h-3 w-24 max-w-full" />
            </div>
            <Skeleton className="size-11 shrink-0 rounded-xl" />
            <Skeleton className="size-11 shrink-0 rounded-xl" />
          </div>
          <div className="min-h-0 flex-1 overflow-hidden px-5">
            <ConversationMessagesLoading />
          </div>
          <div className="shrink-0 px-5 pt-4 pb-3">
            <div className="mx-auto max-w-4xl">
              <div className="mb-2 flex h-9 items-center gap-3 px-2">
                <Skeleton className="h-4 w-32 shrink-0" />
                <Skeleton className="h-3 min-w-0 flex-1" />
              </div>
              <div className="space-y-1 rounded-2xl border border-input bg-muted/30 px-2 py-1 shadow-sm">
                <div className="min-h-16 px-2 py-2">
                  <Skeleton className="h-4 w-40 max-w-full" />
                </div>
                <div className="flex h-11 items-center gap-3 px-2">
                  {[0, 1, 2].map((index) => (
                    <Skeleton key={index} className="size-5 rounded-full" />
                  ))}
                  <Skeleton className="ml-auto size-5 rounded-full" />
                  <Skeleton className="size-8 rounded-full" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
