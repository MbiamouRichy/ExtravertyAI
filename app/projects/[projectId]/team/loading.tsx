import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function TeamLoading() {
    return (
        <div className="max-w-5xl w-full mx-auto p-6 space-y-8 animate-in fade-in duration-500">
            {/* HEADER SECTION SKELETON */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-9 w-62.5" />
                    <Skeleton className="h-4 w-87.5 sm:w-112.5" />
                </div>
                {/* Bouton d'invitation fantôme */}
                <Skeleton className="h-10 w-45 rounded-md shadow-sm" />
            </div>

            {/* ALERT SÉCURITÉ SKELETON */}
            <Skeleton className="h-24 w-full rounded-lg" />

            {/* SEARCH BAR SKELETON */}
            <Skeleton className="h-10 w-full max-w-sm rounded-md shadow-sm" />

            {/* TEAM LIST CARD SKELETON */}
            <Card className="shadow-sm w-full border-border">
                <CardHeader className="border-b bg-muted/10 pb-4">
                    <Skeleton className="h-6 w-35 mb-2" />
                    <Skeleton className="h-4 w-50" />
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-border">
                        {/* Génération de 4 fausses lignes de membres */}
                        {[...Array(4)].map((_, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between p-4 sm:px-6"
                            >
                                {/* INFO UTILISATEUR */}
                                <div className="flex items-center gap-4">
                                    <Skeleton className="h-10 w-10 rounded-full" />
                                    <div className="flex flex-col gap-2">
                                        <Skeleton className="h-4 w-30" />
                                        <Skeleton className="h-3 w-45" />
                                    </div>
                                </div>

                                {/* RÔLE ET ACTIONS */}
                                <div className="flex items-center gap-4">
                                    <Skeleton className="h-6 w-25 rounded-full hidden sm:block" />
                                    <Skeleton className="h-8 w-8 rounded-md" />
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}