"use client";

import React, { useState } from "react";
import {
    User,
    MessageSquare,
    Palette,
    Shield,
    Trash2,
    LogOut,
    Smartphone,
    AlertTriangle
} from "lucide-react";

// Imports hypothétiques de vos composants shadcn (ajustez les chemins selon votre structure)
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState("profil");

    const menuItems = [
        { id: "profil", label: "Profil", icon: User },
        { id: "whatsapp", label: "Auto-Répondeur", icon: MessageSquare },
        { id: "apparence", label: "Apparence", icon: Palette },
        { id: "securite", label: "Sécurité & Compte", icon: Shield },
    ];

    return (
        <div className="container max-w-6xl py-10 mx-auto">
            <div className="flex flex-col gap-2 mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-neutral-50">Paramètres</h1>
                <p className="text-neutral-500">Gérez les paramètres de votre compte et vos préférences d&apos;automatisation.</p>
            </div>

            <Separator className="mb-8" />

            <div className="flex flex-col md:flex-row gap-8">
                {/* Sidebar Navigation */}
                <aside className="w-full md:w-64 shrink-0">
                    <nav className="flex md:flex-col gap-1 overflow-x-auto pb-4 md:pb-0">
                        {menuItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveTab(item.id)}
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap
                    ${isActive
                                            ? "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-50"
                                            : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900 dark:hover:bg-neutral-900 dark:hover:text-neutral-50"
                                        }
                  `}
                                >
                                    <Icon className="w-4 h-4" />
                                    {item.label}
                                </button>
                            );
                        })}
                    </nav>
                </aside>

                {/* Content Area */}
                <main className="flex-1 max-w-3xl">

                    {/* --- SECTION PROFIL --- */}
                    {activeTab === "profil" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Informations personnelles</CardTitle>
                                    <CardDescription>Mettez à jour votre photo et vos informations de base.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center gap-6">
                                        <Avatar className="w-20 h-20">
                                            <AvatarImage src="/placeholder-avatar.jpg" alt="Photo de profil" />
                                            <AvatarFallback className="text-lg bg-neutral-100 text-neutral-900">JD</AvatarFallback>
                                        </Avatar>
                                        <Button variant="outline">Changer la photo</Button>
                                    </div>
                                    <Separator />
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="firstName">Prénom</Label>
                                            <Input id="firstName" defaultValue="John" placeholder="Votre prénom" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="lastName">Nom</Label>
                                            <Input id="lastName" defaultValue="Doe" placeholder="Votre nom" />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="email">Adresse Email</Label>
                                        <Input id="email" type="email" defaultValue="john.doe@startup.com" />
                                        <p className="text-[0.8rem] text-neutral-500">
                                            Nous vous enverrons un lien de confirmation si vous modifiez cette adresse.
                                        </p>
                                    </div>
                                </CardContent>
                                <CardFooter className="flex justify-end border-t pt-6">
                                    <Button>Enregistrer les modifications</Button>
                                </CardFooter>
                            </Card>
                        </div>
                    )}

                    {/* --- SECTION WHATSAPP (AUTO-RÉPONDEUR) --- */}
                    {activeTab === "whatsapp" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Appareil connecté</CardTitle>
                                    <CardDescription>Gérez votre session WhatsApp Web active.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center justify-between p-4 border rounded-lg bg-neutral-50/50 dark:bg-neutral-900/50">
                                        <div className="flex items-center gap-4">
                                            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-full">
                                                <Smartphone className="w-5 h-5 text-green-600 dark:text-green-400" />
                                            </div>
                                            <div>
                                                <p className="font-medium">WhatsApp Business (+33 6 12 34 56 78)</p>
                                                <p className="text-sm text-green-600 dark:text-green-400 font-medium">Connecté - En ligne</p>
                                            </div>
                                        </div>
                                        <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                                            <LogOut className="w-4 h-4 mr-2" />
                                            Déconnecter
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* <Card>
                                <CardHeader>
                                    <CardTitle>Comportement de l&apos;automatisation</CardTitle>
                                    <CardDescription>Réglez les délais et conditions d&apos;envoi de vos messages.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label>Activer l&apos;auto-répondeur</Label>
                                            <p className="text-sm text-neutral-500">Mettre en pause toutes les automatisations globales.</p>
                                        </div>
                                        <Switch defaultChecked />
                                    </div>
                                    <Separator />
                                    <div className="space-y-3">
                                        <Label>Délai de réponse par défaut</Label>
                                        <div className="flex items-center gap-4">
                                            <Clock className="w-5 h-5 text-neutral-400" />
                                            <Select defaultValue="instant">
                                                <SelectTrigger className="w-[200px]">
                                                    <SelectValue placeholder="Sélectionnez un délai" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="instant">Immédiat (0s)</SelectItem>
                                                    <SelectItem value="5s">5 secondes</SelectItem>
                                                    <SelectItem value="15s">15 secondes (Humain)</SelectItem>
                                                    <SelectItem value="1m">1 minute</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                    <Separator />
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label>Ignorer les groupes</Label>
                                            <p className="text-sm text-neutral-500">Ne répondre qu&apos;aux messages privés.</p>
                                        </div>
                                        <Switch defaultChecked />
                                    </div>
                                </CardContent>
                            </Card> */}
                        </div>
                    )}

                    {/* --- SECTION APPARENCE --- */}
                    {activeTab === "apparence" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Thème de l&apos;application</CardTitle>
                                    <CardDescription>Personnalisez l&apos;interface selon vos préférences visuelles.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        {/* Thème Clair */}
                                        <button className="flex flex-col items-center gap-3 border-2 border-transparent hover:border-neutral-200 focus:border-neutral-900 rounded-lg p-4 transition-all">
                                            <div className="w-full h-24 bg-neutral-100 rounded-md border shadow-sm flex items-center justify-center">
                                                <div className="w-1/2 h-1/2 bg-white rounded shadow-sm"></div>
                                            </div>
                                            <span className="font-medium text-sm">Clair</span>
                                        </button>
                                        {/* Thème Sombre */}
                                        <button className="flex flex-col items-center gap-3 border-2 border-neutral-900 rounded-lg p-4 transition-all bg-neutral-50 dark:bg-neutral-900">
                                            <div className="w-full h-24 bg-neutral-900 rounded-md border border-neutral-800 shadow-sm flex items-center justify-center">
                                                <div className="w-1/2 h-1/2 bg-neutral-800 rounded shadow-sm"></div>
                                            </div>
                                            <span className="font-medium text-sm">Sombre (Actif)</span>
                                        </button>
                                        {/* Thème Système */}
                                        <button className="flex flex-col items-center gap-3 border-2 border-transparent hover:border-neutral-200 focus:border-neutral-900 rounded-lg p-4 transition-all">
                                            <div className="w-full h-24 bg-linear-to-r from-neutral-100 to-neutral-900 rounded-md border shadow-sm flex items-center justify-center">
                                                <div className="w-1/2 h-1/2 bg-neutral-500 rounded shadow-sm"></div>
                                            </div>
                                            <span className="font-medium text-sm">Système</span>
                                        </button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* --- SECTION SÉCURITÉ & COMPTE --- */}
                    {activeTab === "securite" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {/* Mot de passe */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Changer le mot de passe</CardTitle>
                                    <CardDescription>Assurez-vous d&apos;utiliser un mot de passe long et sécurisé.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="current-password">Mot de passe actuel</Label>
                                        <Input id="current-password" type="password" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="new-password">Nouveau mot de passe</Label>
                                        <Input id="new-password" type="password" />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirm-password">Confirmer le nouveau mot de passe</Label>
                                        <Input id="confirm-password" type="password" />
                                    </div>
                                </CardContent>
                                <CardFooter className="flex justify-end border-t pt-6">
                                    <Button>Mettre à jour le mot de passe</Button>
                                </CardFooter>
                            </Card>

                            {/* Zone de danger */}
                            <Card className="border-red-200 bg-red-50/30 dark:border-red-900/50 dark:bg-red-950/10">
                                <CardHeader>
                                    <CardTitle className="text-red-600 dark:text-red-500 flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5" />
                                        Zone de danger
                                    </CardTitle>
                                    <CardDescription>Les actions ci-dessous sont irréversibles.</CardDescription>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 border border-red-100 dark:border-red-900/50 rounded-lg bg-white dark:bg-neutral-950">
                                        <div>
                                            <h4 className="font-medium text-neutral-900 dark:text-neutral-100">Supprimer le compte</h4>
                                            <p className="text-sm text-neutral-500 mt-1">Supprime définitivement vos données, bots et configurations.</p>
                                        </div>
                                        <Button variant="destructive" className="whitespace-nowrap">
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Supprimer mon compte
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                </main>
            </div>
        </div>
    );
}