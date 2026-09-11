import { Skeleton } from "@/components/ui/skeleton";

function ChartSkeleton() {
    return (
        <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm">
            <div className="space-y-2 p-4 sm:p-6">
                <Skeleton className="h-4 w-40 max-w-full motion-reduce:animate-none" />
                <Skeleton className="h-3 w-56 max-w-full motion-reduce:animate-none" />
            </div>

            <div className="px-4 pb-5 sm:px-6">
                <Skeleton className="mb-4 h-3 w-32 motion-reduce:animate-none" />
                <Skeleton className="h-64 w-full rounded-xl motion-reduce:animate-none sm:h-72" />
            </div>

            <div className="border-t px-4 py-3 sm:px-6">
                <Skeleton className="h-3 w-36 motion-reduce:animate-none" />
            </div>
        </div>
    );
}

export default function AnalyticsLoading() {
    return (
        <div
            aria-busy="true"
            aria-label="Chargement des statistiques"
            className="min-w-0 bg-muted/20"
        >
            <p role="status" className="sr-only">
                Chargement des statistiques…
            </p>

            <div
                aria-hidden="true"
                className="mx-auto flex w-full max-w-400 flex-col gap-6 p-4 sm:p-6 xl:gap-8 xl:p-8"
            >
                <div className="space-y-5 border-b border-border/70 pb-5">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row">
                        <div className="w-full max-w-lg space-y-3">
                            <Skeleton className="h-4 w-32 motion-reduce:animate-none" />
                            <Skeleton className="h-10 w-48 motion-reduce:animate-none" />
                            <Skeleton className="h-4 w-full motion-reduce:animate-none" />
                        </div>

                        <Skeleton className="h-10 w-44 shrink-0 rounded-xl motion-reduce:animate-none" />
                    </div>

                    <Skeleton className="h-12 w-full max-w-md rounded-xl motion-reduce:animate-none" />
                    <Skeleton className="h-5 w-56 max-w-full motion-reduce:animate-none" />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                    {Array.from({ length: 6 }, (_, index) => (
                        <div
                            key={index}
                            className="rounded-2xl border border-border/70 bg-card p-4"
                        >
                            <Skeleton className="h-4 w-28 max-w-full motion-reduce:animate-none" />
                            <Skeleton className="mt-4 h-9 w-24 motion-reduce:animate-none" />
                            <Skeleton className="mt-3 h-7 w-20 motion-reduce:animate-none" />
                            <Skeleton className="mt-3 h-3 w-28 max-w-full motion-reduce:animate-none" />
                            <Skeleton className="mt-5 h-3 w-20 motion-reduce:animate-none" />
                        </div>
                    ))}
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-44 motion-reduce:animate-none" />
                        <Skeleton className="h-4 w-72 max-w-full motion-reduce:animate-none" />
                    </div>

                    <div className="grid gap-4 xl:grid-cols-3">
                        <div className="xl:col-span-2">
                            <ChartSkeleton />
                        </div>
                        <ChartSkeleton />
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                        <ChartSkeleton />
                        <ChartSkeleton />
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Skeleton className="h-5 w-44 motion-reduce:animate-none" />
                        <Skeleton className="h-4 w-72 max-w-full motion-reduce:animate-none" />
                    </div>

                    <div className="grid gap-4 xl:grid-cols-3">
                        <Skeleton className="h-96 rounded-2xl motion-reduce:animate-none" />
                        <Skeleton className="h-96 rounded-2xl motion-reduce:animate-none xl:col-span-2" />
                    </div>
                </div>
            </div>
        </div>
    );
}