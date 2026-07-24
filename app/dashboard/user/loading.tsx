import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function ProfileLoading() {
    return (
        <div className="max-w-5xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
            {/* En-tête de page */}
            <div>
                <Skeleton className="h-9 w-64" /> {/* Titre */}
                <Skeleton className="h-5 w-96 mt-2 max-w-full" /> {/* Sous-titre */}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Colonne Gauche : Identité */}
                <div className="space-y-6 lg:col-span-1">
                    <Card className="border-border shadow-sm">
                        <CardContent className="pt-6 flex flex-col items-center text-center">
                            <div className="relative mb-4">
                                <Skeleton className="h-24 w-24 rounded-full" /> {/* Avatar */}
                            </div>

                            <Skeleton className="h-7 w-40 mb-2" /> {/* Nom */}
                            <Skeleton className="h-5 w-48 mb-4" /> {/* Email */}

                            <div className="w-full flex flex-col justify-between gap-2 items-center">
                                <Skeleton className="h-10 w-full rounded-md" /> {/* Bouton Modifier */}
                                <Skeleton className="h-10 w-full rounded-md" /> {/* Bouton Déconnexion */}
                            </div>
                        </CardContent>
                        <CardFooter className="flex items-center justify-center">
                            <Skeleton className="h-4 w-40" /> {/* Membre depuis */}
                        </CardFooter>
                    </Card>
                </div>

                {/* Colonne Droite : Sécurité & Sessions */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Carte Sécurité */}
                    <Card className="border-border shadow-sm">
                        <CardHeader>
                            <Skeleton className="h-7 w-56 mb-1.5" />
                            <Skeleton className="h-5 w-80 max-w-full" />
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Section Email */}
                            <div className="flex flex-col lg:flex-row justify-between gap-4 lg:gap-2">
                                <div className="space-y-2 flex flex-col w-full">
                                    <div className="flex flex-col md:flex-row md:items-center gap-2">
                                        <Skeleton className="h-5 w-32" /> {/* Label Email */}
                                        <Skeleton className="h-5 w-20 rounded-full" /> {/* Badge Vérifié */}
                                    </div>
                                    <Skeleton className="h-4 w-48" /> {/* Adresse Email */}
                                </div>
                                <Skeleton className="h-9 w-32 shrink-0" /> {/* Bouton Modifier */}
                            </div>

                            <Separator />

                            {/* Section Mot de passe */}
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-2">
                                <div className="space-y-2 w-full">
                                    <Skeleton className="h-5 w-32" /> {/* Label Mot de passe */}
                                    <Skeleton className="h-4 w-64" /> {/* Dernière modif */}
                                </div>
                                <Skeleton className="h-9 w-44 shrink-0" /> {/* Bouton Modifier */}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Carte Connexions Récentes */}
                    <Card className="border-border shadow-sm">
                        <CardHeader>
                            <Skeleton className="h-7 w-64 mb-1.5" />
                            <Skeleton className="h-5 w-80 max-w-full" />
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Génération de 2 sessions fictives (skeleton) */}
                            {[1, 2].map((i) => (
                                <div
                                    key={i}
                                    className="flex flex-col lg:flex-row items-center justify-between p-4 rounded-lg border bg-card gap-4"
                                >
                                    <div className="flex flex-col lg:flex-row items-center gap-4 w-full">
                                        <Skeleton className="h-10 w-10 rounded-full shrink-0" /> {/* Icône Appareil */}
                                        <div className="w-full flex flex-col items-center lg:items-start gap-1.5">
                                            <Skeleton className="h-4 w-48" /> {/* Navigateur / OS */}
                                            <Skeleton className="h-3 w-64" /> {/* IP / Date */}
                                        </div>
                                    </div>

                                    {/* Badge "Actuelle" uniquement pour la première ligne */}
                                    {i === 1 && (
                                        <Skeleton className="h-6 w-20 rounded-full shrink-0" />
                                    )}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}