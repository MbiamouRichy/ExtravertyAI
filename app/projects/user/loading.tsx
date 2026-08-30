import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function ProfileLoading() {
    return (
        <div className="w-full max-w-5xl mx-auto p-10 md:p-12 space-y-8 animate-in fade-in duration-500">
            {/* En-tête de page */}
            <div>
                <Skeleton className="h-9 w-full md:w-50" /> {/* Titre */}
                <Skeleton className="h-5 w-10/12 md:w-90 mt-2 max-w-full" /> {/* Sous-titre */}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {/* Colonne Gauche : Identité */}
                <div className="space-y-6 lg:col-span-1">
                    <Card className="border-border shadow-sm">
                        <CardContent className="pt-6 flex flex-col items-center text-center">
                            <div className="relative mb-4">
                                <Skeleton className="h-24 w-24 rounded-full" /> {/* Avatar */}
                            </div>

                            <Skeleton className="h-7 w-8/12 md:w-40 mb-2" /> {/* Nom */}
                            <Skeleton className="h-5 w-10/12 md:w-48 mb-4" /> {/* Email */}

                            <div className="w-full flex flex-col justify-between gap-2 items-center">
                                <Skeleton className="h-10 w-full md:w-48 rounded-md" /> {/* Bouton Modifier */}
                                <Skeleton className="h-10 w-full md:w-48 rounded-md" /> {/* Bouton Déconnexion */}
                            </div>
                        </CardContent>
                        <CardFooter className="flex items-center justify-center">
                            <Skeleton className="h-4 w-8/10" /> {/* Membre depuis */}
                        </CardFooter>
                    </Card>
                </div>

                {/* Colonne Droite : Sécurité & Sessions */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Carte Sécurité */}
                    <Card className="border-border shadow-sm">
                        <CardHeader>
                            <Skeleton className="h-7 w-8/12 md:w-56 mb-1.5" />
                            <Skeleton className="h-5 w-10/12 md:w-80" />
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
                                <Skeleton className="h-9 w-40 shrink-0" /> {/* Bouton Modifier */}
                            </div>

                            <Separator />

                            {/* Section Mot de passe */}
                            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-2">
                                <div className="space-y-2 w-full">
                                    <Skeleton className="h-5 w-32" /> {/* Label Mot de passe */}
                                    <Skeleton className="h-4 w-8/10 md:w-64" /> {/* Dernière modif */}
                                </div>
                                <Skeleton className="h-9 w-44 shrink-0" /> {/* Bouton Modifier */}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Carte Connexions Récentes */}
                    <Card className="border-border shadow-sm">
                        <CardHeader>
                            <Skeleton className="h-7 w-7/12 md:w-64 mb-1.5" />
                            <Skeleton className="h-5 w-10/12 md:w-80 max-w-full" />
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
                                            <Skeleton className="h-3 w-10/12 md:w-64" /> {/* IP / Date */}
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
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="space-y-2">
                                        {/* Titre */}
                                        <Skeleton className="h-6 w-50" />
                                        {/* Description */}
                                        <Skeleton className="h-4 w-75 sm:w-100" />
                                    </div>
                                    {/* Emplacement du loader discret */}
                                    <Skeleton className="w-4 h-4 rounded-full" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {/* Répétition des 3 blocs de thèmes */}
                                    {[1, 2, 3].map((item) => (
                                        <div
                                            key={item}
                                            className="flex flex-col p-3 h-fit border rounded-md shadow-xs bg-transparent gap-2"
                                        >
                                            {/* Aperçu du thème */}
                                            <Skeleton className="w-full h-24 rounded-md" />
                                            {/* Label du thème */}
                                            <Skeleton className="h-4 w-16 mx-auto mt-1" />
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* --- SECTION SÉCURITÉ & COMPTE (SKELETON) --- */}
                    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-6">
                        {/* On garde la subtile teinte rouge en fond pour ne pas avoir de flash de couleur au chargement */}
                        <Card className="border-destructive/20 bg-destructive/5">
                            <CardHeader>
                                <div className="space-y-2">
                                    {/* Titre avec espace pour l'icône */}
                                    <div className="flex items-center gap-2">
                                        <Skeleton className="w-5 h-5 rounded-md" />
                                        <Skeleton className="h-6 w-37.5" />
                                    </div>
                                    {/* Description */}
                                    <Skeleton className="h-4 w-62.5 sm:w-87.5" />
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 border border-destructive/20 rounded-lg bg-background">
                                    <div className="space-y-2 w-full">
                                        {/* Sous-titre */}
                                        <Skeleton className="h-5 w-45" />
                                        {/* Texte explicatif */}
                                        <Skeleton className="h-4 w-full max-w-100" />
                                    </div>

                                    {/* Bouton de suppression */}
                                    <Skeleton className="h-10 w-50 shrink-0 rounded-md" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}