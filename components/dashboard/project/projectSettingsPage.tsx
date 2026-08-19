// app/dashboard/projects/[projectId]/settings/page.tsx
"use client";

import React, { useState } from "react";
import {
    Activity, Download, Trash2, Zap,
    Smartphone, MessageSquare, BarChart3
} from "lucide-react";

// Imports Shadcn UI (vérifie que tes chemins correspondent à ta configuration)
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

// --- TYPESCRIPT INTERFACES ---
interface TabButtonProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    isDanger?: boolean;
}

interface StatCardProps {
    title: string;
    value: number;
    icon: React.ReactNode;
}

interface ToggleSettingProps {
    title: string;
    description: string;
    defaultChecked?: boolean;
}

export default function ProjectSettingsPage() {
    const [activeTab, setActiveTab] = useState<string>("general");

    // Données mockées pour l'instant
    const project = {
        name: "Campagne Leads B2B",
        plan: "Pro",
        messagesUsed: 4230,
        messagesLimit: 10000,
        renewalDate: "24 Sept. 2026",
        stats: { week: 845, month: 3120, year: 15400 }
    };

    const usagePercentage = Math.round((project.messagesUsed / project.messagesLimit) * 100);

    return (
        <div className="max-w-7xl w-full mx-auto p-6 space-y-8 animate-in fade-in duration-500">

            {/* HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Paramètres de l&apos;Instance</h1>
                    <p className="text-muted-foreground mt-1">Gérez votre numéro WhatsApp, vos automatisations et vos limites.</p>
                </div>
                <Button className="gap-2" variant="default">
                    <Zap className="w-4 h-4" />
                    Upgrade Plan
                </Button>
            </div>

            <Separator />

            <div className="flex flex-col md:flex-row gap-8">
                {/* SIDEBAR NAVIGATION */}
                <nav className="w-full md:w-64 flex flex-col gap-1">
                    <TabButton active={activeTab === "general"} onClick={() => setActiveTab("general")} icon={<Activity className="w-4 h-4" />} label="Vue d'ensemble" />
                    <TabButton active={activeTab === "whatsapp"} onClick={() => setActiveTab("whatsapp")} icon={<Smartphone className="w-4 h-4" />} label="Instance WhatsApp" />
                    <TabButton active={activeTab === "export"} onClick={() => setActiveTab("export")} icon={<Download className="w-4 h-4" />} label="Export & Données" />
                    <TabButton active={activeTab === "danger"} onClick={() => setActiveTab("danger")} icon={<Trash2 className="w-4 h-4" />} label="Zone de Danger" isDanger />
                </nav>

                {/* CONTENT AREA */}
                <main className="flex-1 space-y-6">

                    {/* VUE D'ENSEMBLE */}
                    {activeTab === "general" && (
                        <div className="space-y-6">
                            <Card className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Activity className="w-5 h-5 text-primary" />
                                            Utilisation du forfait
                                        </CardTitle>
                                        <Badge variant="secondary">{project.plan}</Badge>
                                    </div>
                                    <CardDescription>
                                        Renouvellement des crédits prévu le <span className="font-medium text-foreground">{project.renewalDate}</span>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex justify-between text-sm font-medium mb-2">
                                        <span>Messages automatisés</span>
                                        <span>{project.messagesUsed.toLocaleString()} / {project.messagesLimit.toLocaleString()}</span>
                                    </div>
                                    <Progress value={usagePercentage} className={`h-2 ${usagePercentage > 85 ? "bg-red-100 [&>div]:bg-red-600" : ""}`} />
                                </CardContent>
                            </Card>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <StatCard title="Messages (7 jrs)" value={project.stats.week} icon={<BarChart3 className="w-4 h-4 text-muted-foreground" />} />
                                <StatCard title="Messages (30 jrs)" value={project.stats.month} icon={<MessageSquare className="w-4 h-4 text-muted-foreground" />} />
                                <StatCard title="Messages (Année)" value={project.stats.year} icon={<Activity className="w-4 h-4 text-muted-foreground" />} />
                            </div>
                        </div>
                    )}

                    {/* INSTANCE WHATSAPP */}
                    {activeTab === "whatsapp" && (
                        <Card className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <CardHeader>
                                <CardTitle>Comportement de l&apos;instance</CardTitle>
                                <CardDescription>
                                    Ajustez la façon dont votre numéro réagit sur WhatsApp via Evolution API.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <ToggleSetting title="Toujours en ligne" description="Force le statut WhatsApp à 'En ligne' en permanence." defaultChecked={true} />
                                <Separator />
                                <ToggleSetting title="Marquer comme lu (Blue Ticks)" description="Envoie automatiquement les accusés de lecture dès réception d'un message." defaultChecked={false} />
                                <Separator />
                                <ToggleSetting title="Indicateur de frappe" description="Simule l'action 'est en train d'écrire...' avant chaque réponse de l'Agent IA." defaultChecked={true} />
                            </CardContent>
                        </Card>
                    )}

                    {/* ONGLET : EXPORT */}
                    {activeTab === "export" && (
                        <Card className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <CardHeader>
                                <CardTitle>Exportation des prospects</CardTitle>
                                <CardDescription>Téléchargez l&apos;historique complet de vos contacts et conversations.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col sm:flex-row gap-4">
                                <Button variant="outline" className="flex-1 flex items-center justify-center gap-2">
                                    <Download className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                    <span className="font-medium">Exporter en CSV</span>
                                </Button>
                                <Button variant="outline" className="flex-1 flex items-center justify-center gap-2">
                                    <Download className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                                    <span className="font-medium">Exporter en Excel</span>
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                    {/* ONGLET : DANGER ZONE */}
                    {activeTab === "danger" && (
                        <Card className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <CardHeader>
                                <CardTitle>Supprimer le projet</CardTitle>
                                <CardDescription>
                                    Cette action déconnectera immédiatement l&apos;instance WhatsApp, supprimera tous les historiques de conversation et détruira les données des prospects. Cette action est irréversible.
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <Button variant="destructive" className="w-full flex items-center justify-center gap-2" onClick={() => alert("Fonctionnalité de suppression à implémenter")}>
                                    Supprimer définitivement
                                </Button>
                            </CardContent>
                        </Card>
                    )}

                </main>
            </div>
        </div>
    );
}

// --- SOUS-COMPOSANTS ---

function TabButton({ active, onClick, icon, label, isDanger = false }: TabButtonProps) {
    return (
        <Button
            variant={active ? (isDanger ? "destructive" : "secondary") : "ghost"}
            className={`w-full justify-start gap-3 ${active && !isDanger ? "bg-secondary text-secondary-foreground" : ""} ${isDanger && !active ? "text-destructive hover:text-destructive hover:bg-destructive/10" : ""}`}
            onClick={onClick}
        >
            {icon}
            {label}
        </Button>
    );
}

function StatCard({ title, value, icon }: StatCardProps) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                    {title}
                </CardTitle>
                {icon}
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold">{value.toLocaleString()}</div>
            </CardContent>
        </Card>
    );
}

function ToggleSetting({ title, description, defaultChecked = false }: ToggleSettingProps) {
    const [checked, setChecked] = useState<boolean>(defaultChecked);

    return (
        <div className="flex items-center justify-between space-x-4">
            <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{title}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <Switch checked={checked} onCheckedChange={setChecked} />
        </div>
    );
}