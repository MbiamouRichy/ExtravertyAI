import { Skeleton } from "@/components/ui/skeleton";

function SectionTitle() {
    return (
        <div className="space-y-1.5">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3.5 w-72 max-w-full" />
        </div>
    );
}

function CardHeader() {
    return (
        <div className="space-y-2 p-4 sm:p-6">
            <Skeleton className="h-4 w-40 max-w-full" />
            <Skeleton className="h-3 w-64 max-w-full" />
        </div>
    );
}

function Card({
    children,
    className = "",
}: {
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div
            className={`min-w-0 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-xs ${className}`}
        >
            {children}
        </div>
    );
}

/** Barres en pointillés : silhouette proche du graphique de volume réel. */
function BarsSilhouette() {
    const bars = [12, 30, 18, 46, 28, 62, 38, 22, 54, 34, 70, 26, 44, 16, 58];
    return (
        <div className="relative h-60 px-4 pb-8 sm:px-6">
            <div className="absolute inset-x-4 inset-y-0 bottom-8 flex flex-col justify-between sm:inset-x-6">
                {[0, 1, 2, 3].map((line) => (
                    <div
                        key={line}
                        className="border-t border-dashed border-border/70"
                    />
                ))}
            </div>
            <div className="relative flex h-full items-end gap-1.5 sm:gap-2">
                {bars.map((height, index) => (
                    <Skeleton
                        key={index}
                        className="flex-1 rounded-t-sm rounded-b-none"
                        style={{ height: `${height}%` }}
                    />
                ))}
            </div>
        </div>
    );
}

function DonutSilhouette() {
    return (
        <div className="flex flex-col items-center gap-6 px-4 pb-6 sm:px-6">
            <Skeleton className="relative size-48 rounded-full">
                <span className="absolute inset-[16%] rounded-full bg-card" />
            </Skeleton>
            <div className="w-full divide-y rounded-xl border">
                {[0, 1, 2].map((row) => (
                    <div
                        key={row}
                        className="flex items-center justify-between px-3 py-2.5"
                    >
                        <Skeleton className="h-3 w-28" />
                        <Skeleton className="h-3 w-12" />
                    </div>
                ))}
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
                className="skeleton-shimmer relative mx-auto flex w-full max-w-400 flex-col gap-6 p-4 sm:p-6 xl:gap-8 xl:p-8"
            >
                <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden bg-muted">
                    <div className="loading-bar h-full w-1/3 rounded-full bg-foreground/50" />
                </div>

                {/* En-tête : titre, période, export */}
                <div className="space-y-5 border-b border-border/70 pb-5">
                    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                        <div className="w-full max-w-lg space-y-3">
                            <Skeleton className="h-3.5 w-36" />
                            <Skeleton className="h-9 w-52" />
                            <Skeleton className="h-4 w-full max-w-md" />
                        </div>
                        <div className="flex gap-2">
                            <Skeleton className="h-9 w-28 rounded-lg" />
                            <Skeleton className="h-9 w-9 rounded-lg" />
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {[16, 20, 20, 24].map((width, index) => (
                            <Skeleton
                                key={index}
                                className="h-8 rounded-full"
                                style={{ width: `${width * 4}px` }}
                            />
                        ))}
                    </div>
                </div>

                {/* Indicateurs clés */}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
                    {Array.from({ length: 6 }, (_, index) => (
                        <Card key={index} className="p-4">
                            <div className="flex items-center justify-between">
                                <Skeleton className="h-3.5 w-28" />
                                <Skeleton className="size-4 rounded" />
                            </div>
                            <div className="mt-4 flex items-end justify-between gap-2">
                                <Skeleton className="h-8 w-20" />
                                <Skeleton className="h-5 w-16 rounded-full" />
                            </div>
                            <Skeleton className="mt-3 h-3 w-32 max-w-full" />
                            <div className="mt-4 border-t pt-3">
                                <Skeleton className="h-3 w-20" />
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Activité & acquisition */}
                <div className="space-y-4">
                    <SectionTitle />
                    <div className="grid gap-4 xl:grid-cols-3">
                        <Card className="xl:col-span-2">
                            <CardHeader />
                            <div className="flex gap-8 px-4 pb-4 sm:px-6">
                                <Skeleton className="h-8 w-14" />
                                <Skeleton className="h-8 w-14" />
                            </div>
                            <BarsSilhouette />
                        </Card>
                        <Card>
                            <CardHeader />
                            <DonutSilhouette />
                        </Card>
                    </div>
                    <div className="grid gap-4 lg:grid-cols-2">
                        {[0, 1].map((index) => (
                            <Card key={index}>
                                <CardHeader />
                                <BarsSilhouette />
                            </Card>
                        ))}
                    </div>
                </div>

                {/* IA & prospects */}
                <div className="space-y-4">
                    <SectionTitle />
                    <div className="grid gap-4 lg:grid-cols-2">
                        {[0, 1].map((index) => (
                            <Card key={index}>
                                <CardHeader />
                                <div className="space-y-4 px-4 pb-6 sm:px-6">
                                    {[0, 1, 2].map((row) => (
                                        <div key={row} className="space-y-2">
                                            <div className="flex justify-between">
                                                <Skeleton className="h-3 w-32" />
                                                <Skeleton className="h-3 w-10" />
                                            </div>
                                            <Skeleton
                                                className="h-2 rounded-full"
                                                style={{ width: `${88 - row * 24}%` }}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </Card>
                        ))}
                    </div>
                    <Card>
                        <CardHeader />
                        <div className="grid grid-cols-12 gap-1 px-4 pb-6 sm:px-6">
                            {Array.from({ length: 84 }, (_, index) => (
                                <Skeleton
                                    key={index}
                                    className="aspect-square rounded-sm"
                                />
                            ))}
                        </div>
                    </Card>
                </div>

                {/* Livraison & contacts */}
                <div className="space-y-4">
                    <SectionTitle />
                    <div className="grid gap-4 xl:grid-cols-3">
                        <Card>
                            <CardHeader />
                            <DonutSilhouette />
                        </Card>
                        <Card className="xl:col-span-2">
                            <CardHeader />
                            <div className="divide-y px-4 pb-4 sm:px-6">
                                {Array.from({ length: 6 }, (_, row) => (
                                    <div
                                        key={row}
                                        className="flex items-center gap-3 py-3"
                                    >
                                        <Skeleton className="size-8 rounded-full" />
                                        <Skeleton className="h-3.5 w-36" />
                                        <Skeleton className="ml-auto h-5 w-20 rounded-full" />
                                        <Skeleton className="h-3.5 w-10" />
                                    </div>
                                ))}
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
