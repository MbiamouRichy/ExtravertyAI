import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
    return (
        <div
            aria-busy="true"
            aria-label="Chargement des conversations"
            className="h-[calc(100dvh-var(--app-header-height,4rem))] overflow-hidden bg-muted/20 p-0 sm:p-3 xl:p-5"
        >
            <p role="status" className="sr-only">
                Chargement des conversations…
            </p>

            <div
                aria-hidden="true"
                className="mx-auto flex h-full max-w-450 overflow-hidden bg-background sm:rounded-2xl sm:border"
            >
                <div className="w-full shrink-0 border-r p-4 md:w-80 xl:w-96">
                    <Skeleton className="h-3 w-28 motion-reduce:animate-none" />
                    <Skeleton className="mt-3 h-7 w-44 motion-reduce:animate-none" />
                    <Skeleton className="mt-5 h-10 w-full rounded-xl motion-reduce:animate-none" />
                    <Skeleton className="mt-3 h-10 w-full rounded-xl motion-reduce:animate-none" />

                    <div className="mt-6 space-y-3">
                        {Array.from({ length: 7 }, (_, index) => (
                            <div
                                key={index}
                                className="flex items-center gap-3 rounded-xl p-2"
                            >
                                <Skeleton className="size-11 shrink-0 rounded-full motion-reduce:animate-none" />
                                <div className="min-w-0 flex-1 space-y-2">
                                    <Skeleton className="h-4 w-2/3 motion-reduce:animate-none" />
                                    <Skeleton className="h-3 w-full motion-reduce:animate-none" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="hidden min-w-0 flex-1 flex-col md:flex">
                    <div className="flex h-20 items-center gap-3 border-b px-5">
                        <Skeleton className="size-10 rounded-full motion-reduce:animate-none" />
                        <div className="space-y-2">
                            <Skeleton className="h-4 w-36 motion-reduce:animate-none" />
                            <Skeleton className="h-3 w-24 motion-reduce:animate-none" />
                        </div>
                    </div>

                    <div className="flex-1 space-y-6 bg-muted/20 p-6">
                        <Skeleton className="h-20 w-2/3 rounded-2xl motion-reduce:animate-none" />
                        <Skeleton className="ml-auto h-28 w-1/2 rounded-2xl motion-reduce:animate-none" />
                        <Skeleton className="h-16 w-1/2 rounded-2xl motion-reduce:animate-none" />
                    </div>

                    <div className="border-t p-5">
                        <Skeleton className="h-28 w-full rounded-2xl motion-reduce:animate-none" />
                    </div>
                </div>
            </div>
        </div>
    );
}