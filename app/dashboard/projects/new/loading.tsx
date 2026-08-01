import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function LoadingNewProject() {
    return (
        <div className="mx-auto max-w-5xl py-10 px-4 sm:px-6 lg:px-8 animate-pulse">

            {/* EN-TÊTE */}
            <div className="mb-8 text-center sm:text-left space-y-4">
                <Skeleton className="h-10 w-3/4 sm:w-1/2 mx-auto sm:mx-0" />
                <div className="space-y-2 mt-2">
                    <Skeleton className="h-4 w-full sm:w-2/3 mx-auto sm:mx-0" />
                    <Skeleton className="h-4 w-5/6 sm:w-1/2 mx-auto sm:mx-0" />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* COLONNE GAUCHE */}
                <div className="lg:col-span-7 space-y-8">

                    {/* Section 1 : Informations du projet (Skeleton) */}
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Skeleton className="h-5 w-5 rounded-md" />
                                <Skeleton className="h-6 w-48" />
                            </CardTitle>
                            <CardDescription>
                                <Skeleton className="h-4 w-64 mt-2" />
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Faux champ 1 */}
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-10 w-full rounded-md" />
                            </div>
                            {/* Faux champ 2 */}
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-10 w-full rounded-md" />
                                <Skeleton className="h-3 w-3/4 mt-1" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Section 2 : Choix du Forfait (Skeleton) */}
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Skeleton className="h-5 w-5 rounded-md" />
                                <Skeleton className="h-6 w-48" />
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <Skeleton className="h-32 w-full rounded-xl" />
                                <Skeleton className="h-32 w-full rounded-xl" />
                                <Skeleton className="h-32 w-full rounded-xl" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* COLONNE DROITE : Récapitulatif (Skeleton) */}
                <div className="lg:col-span-5 relative">
                    <div className="sticky top-8 space-y-6">

                        {/* Carte de résumé */}
                        <Card className="border-primary/20 bg-card shadow-md">
                            <CardHeader>
                                <Skeleton className="h-6 w-32" />
                            </CardHeader>
                            <CardContent className="space-y-5">
                                <div className="flex justify-between items-center">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-4 w-20" />
                                </div>
                                <div className="flex justify-between items-center">
                                    <Skeleton className="h-4 w-28" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                                <div className="flex justify-between items-center">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-6 w-16" />
                                </div>

                                <div className="pt-4 border-t border-primary/10">
                                    <Skeleton className="h-12 w-full rounded-md" />
                                </div>
                                <Skeleton className="h-3 w-48 mx-auto mt-2" />
                            </CardContent>
                        </Card>

                        {/* Badges de réassurance */}
                        <div className="space-y-4 px-2">
                            <div className="flex items-start gap-3">
                                <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                                <div className="space-y-2 w-full">
                                    <Skeleton className="h-4 w-40" />
                                    <Skeleton className="h-3 w-full" />
                                    <Skeleton className="h-3 w-4/5" />
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                                <div className="space-y-2 w-full">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-full" />
                                    <Skeleton className="h-3 w-3/4" />
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

            </div>
        </div>
    )
}