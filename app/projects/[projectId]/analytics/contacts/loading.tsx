import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ContactsLoading() {
    return (
        // Le conteneur principal reprend EXACTEMENT les mêmes paddings que page.tsx (p-8 pt-6 space-y-6)
        <div className="flex-1 space-y-6 p-8 pt-6">

            {/* --- 1. SKELETON : EN-TÊTE DE PAGE --- */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <Skeleton className="h-9 w-62.5" />
                    <Skeleton className="h-4 w-100 mt-2 max-w-full" />
                </div>
            </div>

            {/* --- 2. SKELETON : KPI CARDS --- */}
            <div className="grid gap-4 md:grid-cols-3">
                {[1, 2, 3].map((index) => (
                    <Card key={index} className="bg-background shadow-sm border-neutral-200 dark:border-neutral-800">
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <Skeleton className="h-4 w-30" />
                            <Skeleton className="h-5 w-5 rounded-md" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-8 w-20" />
                            <Skeleton className="h-3 w-37.5 mt-2" />
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* --- 3. SKELETON : TABLEAU --- */}
            <div className="mt-8 space-y-4">

                {/* Toolbar (Barre de recherche et boutons d'action) */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <Skeleton className="h-10 w-full max-w-sm rounded-md" />
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Skeleton className="h-10 flex-1 sm:w-32.5 rounded-md" />
                        <Skeleton className="h-10 flex-1 sm:w-27.5 rounded-md" />
                    </div>
                </div>

                {/* Conteneur du tableau */}
                <div className="rounded-md border bg-card shadow-sm overflow-hidden">
                    {/* Header du tableau */}
                    <div className="border-b bg-muted/40 p-4 flex items-center justify-between">
                        <Skeleton className="h-4 w-30" />
                        <Skeleton className="h-4 w-25 hidden md:block" />
                        <Skeleton className="h-4 w-20 hidden md:block" />
                        <Skeleton className="h-4 w-20 hidden md:block" />
                        <Skeleton className="h-4 w-7.5" />
                    </div>

                    {/* Lignes du tableau (on en simule 5 pour remplir l'écran) */}
                    <div className="divide-y divide-neutral-200 dark:divide-neutral-800">
                        {[...Array(5)].map((_, i) => (
                            <div key={i} className="p-3 py-4 flex items-center justify-between transition-colors">
                                {/* Colonne Identité avec l'Avatar de secours (responsive : toujours visible) */}
                                <div className="flex items-center gap-3 w-full max-w-62.5">
                                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                                    <div className="flex flex-col gap-1.5 w-full">
                                        <Skeleton className="h-4 w-[80%]" />
                                        <Skeleton className="h-3 w-[50%]" />
                                    </div>
                                </div>

                                {/* Colonnes secondaires (masquées sur mobile, visibles sur desktop) */}
                                <Skeleton className="h-4 w-30 hidden md:block" />
                                <Skeleton className="h-6 w-25 rounded-full hidden md:block" /> {/* Badge IA */}
                                <Skeleton className="h-4 w-22.5 hidden md:block" />

                                {/* Colonne Action (toujours visible) */}
                                <div className="flex justify-end pr-2 w-10">
                                    <Skeleton className="h-8 w-8 rounded-md" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer (Pagination) */}
                <div className="flex items-center justify-between px-2 py-2">
                    <Skeleton className="h-4 w-35 hidden sm:block" />
                    <div className="flex items-center space-x-6 lg:space-x-8">
                        <Skeleton className="h-4 w-25" />
                        <div className="flex space-x-2">
                            <Skeleton className="h-8 w-8 rounded-md" />
                            <Skeleton className="h-8 w-8 rounded-md" />
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}