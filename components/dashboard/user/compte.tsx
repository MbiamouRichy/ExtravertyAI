"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
    CreditCard,
    User,
    CheckCircle2,
    ArrowUpRight,
    MoreHorizontal
} from "lucide-react";
import Link from "next/link";

// Données fictives pour l'exemple (à remplacer par tes appels DB/Prisma)
const user = {
    name: "Richy Tchogna",
    email: "contact@extravertyai.com",
    role: "Administrateur",
    plan: "Pro",
};

const recentProjects = [
    { id: "1", name: "Support Client - Gabon", numero: "24177000000", status: "active", date: "12 Juin 2026" },
    { id: "2", name: "Campagne Leads VIP", numero: "24177111111", status: "connecting", date: "10 Juin 2026" },
];

export default function AccountPage() {
    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in pb-10">

            {/* En-tête de la page */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Mon Compte</h1>
                <p className="text-neutral-500 mt-1">
                    Gérez vos informations personnelles, votre abonnement et vos projets.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* SECTION 1 : PROFIL UTILISATEUR */}
                <Card className="border-neutral-200 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <User className="h-5 w-5 text-neutral-500" />
                            Profil Utilisateur
                        </CardTitle>
                        <CardDescription>
                            Mettez à jour vos informations de connexion.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex items-center gap-4 mb-4">
                            <Avatar className="h-16 w-16 border border-neutral-200">
                                <AvatarImage src="" alt={user.name} />
                                <AvatarFallback className="bg-neutral-100 text-neutral-900 text-xl font-medium">
                                    {user.name.split(" ").map(n => n[0]).join("")}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <p className="font-medium text-neutral-900">{user.name}</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" className="bg-neutral-100 text-neutral-600 hover:bg-neutral-100 pointer-events-none">
                                        {user.role}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nom complet</Label>
                                <Input id="name" defaultValue={user.name} className="focus-visible:ring-neutral-400" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Adresse e-mail</Label>
                                <Input id="email" type="email" defaultValue={user.email} className="focus-visible:ring-neutral-400" disabled />
                                <p className="text-xs text-neutral-500">
                                    L&apos;adresse e-mail est liée à votre authentification.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-neutral-50 border-t border-neutral-100 rounded-b-xl py-3 mt-4">
                        <Button className="bg-neutral-900 text-white hover:bg-neutral-800 ml-auto transition-colors">
                            Enregistrer les modifications
                        </Button>
                    </CardFooter>
                </Card>

                {/* SECTION 2 : ABONNEMENT & FACTURATION */}
                <Card className="border-neutral-200 shadow-sm flex flex-col">
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <CreditCard className="h-5 w-5 text-neutral-500" />
                            Plan & Facturation
                        </CardTitle>
                        <CardDescription>
                            Gérez votre abonnement Extraverty AI.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6 flex-1">
                        <div className="bg-neutral-900 text-white p-5 rounded-lg flex justify-between items-center">
                            <div>
                                <p className="text-sm text-neutral-300 font-medium uppercase tracking-wider mb-1">Plan Actuel</p>
                                <p className="text-2xl font-bold">{user.plan}</p>
                            </div>
                            <Badge className="bg-white/10 text-white hover:bg-white/20 border-0 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Actif
                            </Badge>
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between text-sm">
                                <span className="font-medium text-neutral-900">Instances WhatsApp</span>
                                <span className="text-neutral-500">2 / 5 utilisées</span>
                            </div>
                            {/* Progress bar avec une couleur neutre foncée */}
                            <Progress value={40} className="h-2 [&>div]:bg-neutral-800" />
                            <p className="text-xs text-neutral-500">
                                Vous pouvez encore connecter 3 numéros avec votre forfait actuel.
                            </p>
                        </div>
                    </CardContent>
                    <CardFooter className="bg-neutral-50 border-t border-neutral-100 rounded-b-xl py-3 flex justify-between items-center">
                        <p className="text-xs text-neutral-500">Prochain prélèvement le 15 Juil 2026</p>
                        <Button variant="outline" className="border-neutral-300 text-neutral-700 hover:bg-neutral-100">
                            Gérer l&apos;abonnement <ArrowUpRight className="ml-2 h-4 w-4" />
                        </Button>
                    </CardFooter>
                </Card>
            </div>

            {/* SECTION 3 : PROJETS RÉCENTS */}
            <Card className="border-neutral-200 shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">Projets récents</CardTitle>
                        <CardDescription>
                            Vos dernières instances connectées.
                        </CardDescription>
                    </div>
                    <Link href="/dashboard/projects">
                        <Button variant="ghost" size="sm" className="text-neutral-600 hover:text-neutral-900">
                            Voir tout
                        </Button>
                    </Link>
                </CardHeader>
                <CardContent>
                    <div className="border border-neutral-100 rounded-md overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-neutral-50 text-neutral-500 font-medium border-b border-neutral-100">
                                <tr>
                                    <th className="px-4 py-3">Nom du projet</th>
                                    <th className="px-4 py-3">Numéro</th>
                                    <th className="px-4 py-3">Statut</th>
                                    <th className="px-4 py-3">Créé le</th>
                                    <th className="px-4 py-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {recentProjects.map((project) => (
                                    <tr key={project.id} className="hover:bg-neutral-50/50 transition-colors">
                                        <td className="px-4 py-4 font-medium text-neutral-900">{project.name}</td>
                                        <td className="px-4 py-4 text-neutral-600 font-mono text-xs">{project.numero}</td>
                                        <td className="px-4 py-4">
                                            {project.status === "active" ? (
                                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                    En ligne
                                                </Badge>
                                            ) : (
                                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                                    En attente
                                                </Badge>
                                            )}
                                        </td>
                                        <td className="px-4 py-4 text-neutral-500">{project.date}</td>
                                        <td className="px-4 py-4 text-right">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-500 hover:text-neutral-900">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {recentProjects.length === 0 && (
                            <div className="p-8 text-center text-neutral-500">
                                Aucun projet récent trouvé.
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}