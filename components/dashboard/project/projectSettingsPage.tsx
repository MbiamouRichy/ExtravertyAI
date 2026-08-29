"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
    Activity, Download, Trash2, Zap,
    Smartphone, MessageSquare, BarChart3,
    Cog, Loader2,
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import CustomCard from "@/components/ui/customCard";
// J'importe n'importe quel type Project, adapte selon ton vrai schema si `stats` n'est pas dedans de base
import { toast } from "sonner";
import { deleteProjectAction } from "@/app/actions/projects";
import { CustomProjectProps } from "./homePage";
import AlertDisable from "./alertDisable";

// --- IMPORTS DES SERVER ACTIONS ---
// Assure-toi que le chemin d'import correspond à l'endroit où tu as sauvegardé les actions

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
    onToggle: (checked: boolean) => void;
    disabled?: boolean;
}

export default function ProjectSettingsPage({ project }: { project: CustomProjectProps["projects"][number] }) {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<string>("general");

    // useTransition est idéal pour les Server Actions : il permet de montrer un état de chargement
    // sans bloquer complètement l'interface utilisateur.
    const [isPending, startTransition] = useTransition();

    // Calcul sécurisé du pourcentage (évite la division par zéro)
    const allMessagesCount = project.allMessagesCount || 1;
    const messageCount = project.messageCount || 0;
    const usagePercentage = Math.min(100, Math.round((messageCount / allMessagesCount) * 100));

    // --- HANDLERS DANGER ZONE ---


    const handleDeleteProject = () => {
        const confirmText = prompt(`Action IRRÉVERSIBLE. Tapez "${project.name}" pour confirmer :`);
        if (confirmText !== project.name) {
            if (confirmText !== null) toast.error("Nom du projet incorrect. Annulation.");
            return;
        }

        startTransition(async () => {
            const result = await deleteProjectAction({ projectId: project.id });
            if (result.success) {
                toast.success("Projet supprimé définitivement.");
                router.push("/projects"); // Redirection obligatoire car le projet n'existe plus
            } else {
                toast.error(result.error || "Erreur lors de la suppression");
            }
        });
    };

    // --- HANDLERS WHATSAPP SETTINGS ---
    // Ces fonctions sont prêtes à appeler tes futures Server Actions

    const handleUpdateWhatsAppSetting = (settingKey: string, newValue: boolean) => {
        toast.success(`Paramètre ${settingKey} mis à jour : ${newValue}`);
        // Ici, tu appelleras ta Server Action : await updateProjectSetting(project.id, settingKey, newValue)
    };

    // --- HANDLERS EXPORT ---

    const handleExport = (format: "csv" | "excel") => {
        toast.success(`Préparation de l'export ${format.toUpperCase()}...`);
        // Ici, tu déclencheras le téléchargement via une route d'API
        // window.location.href = `/api/projects/${project.id}/export?format=${format}`
    };

    return (
        <div className="max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6 md:space-y-8 animate-in fade-in duration-500">

            {/* HEADER */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <div className="inline-flex gap-2 items-center">
                        <Cog className="shrink-0 w-6 h-6 md:w-8 md:h-8 text-primary" />
                        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                            Paramètres : {project.name}
                        </h1>
                    </div>
                    <p className="text-sm md:text-base text-muted-foreground mt-1">
                        Gérez votre numéro WhatsApp, vos automatisations et limites.
                    </p>
                </div>
                <Button className="w-full sm:w-auto gap-2 shadow-sm" variant="default">
                    <Zap className="w-4 h-4 fill-current" />
                    Upgrade Plan
                </Button>
            </div>

            <Separator className="hidden md:block" />

            <div className="flex flex-col md:flex-row gap-6 md:gap-8">

                {/* NAVIGATION */}
                <div className="sticky top-0 z-10 -mx-4 px-4 py-2 md:p-0 md:mx-0 bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 md:static md:bg-transparent md:z-auto">
                    <nav className="flex md:flex-col gap-2 overflow-x-auto pb-1 md:pb-0 w-full md:w-64 shrink-0 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                        <TabButton active={activeTab === "general"} onClick={() => setActiveTab("general")} icon={<Activity className="w-4 h-4" />} label="Vue d'ensemble" />
                        <TabButton active={activeTab === "whatsapp"} onClick={() => setActiveTab("whatsapp")} icon={<Smartphone className="w-4 h-4" />} label="Instance WhatsApp" />
                        <TabButton active={activeTab === "export"} onClick={() => setActiveTab("export")} icon={<Download className="w-4 h-4" />} label="Export & Données" />
                        <TabButton active={activeTab === "danger"} onClick={() => setActiveTab("danger")} icon={<Trash2 className="w-4 h-4" />} label="Zone de Danger" isDanger />
                    </nav>
                </div>

                {/* CONTENT AREA */}
                <main className="flex-1 space-y-6 min-w-0">

                    {/* VUE D'ENSEMBLE */}
                    {activeTab === "general" && (
                        <div className="space-y-6">
                            <CustomCard className="shadow-sm p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                <CardHeader className="pb-4">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Activity className="w-5 h-5 text-primary" />
                                            Utilisation du forfait
                                        </CardTitle>
                                        <Badge variant={project.status === "inactive" ? "destructive" : "secondary"} className="w-fit">
                                            {project.status === "inactive" ? "Inactif" : project.plan || "Gratuit"}
                                        </Badge>
                                    </div>
                                    <CardDescription>
                                        Renouvellement le <span className="font-medium text-foreground">
                                            {project.stripeCurrentPeriodEnd?.toLocaleDateString() || project.expiredAt?.toLocaleDateString() || "Non défini"}
                                        </span>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex justify-between text-sm font-medium mb-3">
                                        <span className="text-muted-foreground">Messages automatisés</span>
                                        <span>{messageCount.toLocaleString()} / {allMessagesCount.toLocaleString()}</span>
                                    </div>
                                    <Progress value={usagePercentage} className={`h-2.5 ${usagePercentage > 85 ? "bg-red-100 dark:bg-red-950/50 [&>div]:bg-red-600" : ""}`} />
                                </CardContent>
                            </CustomCard>

                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
                                <StatCard title="7 jours" value={120} icon={<BarChart3 className="w-4 h-4 text-muted-foreground" />} />
                                <StatCard title="30 jours" value={650} icon={<MessageSquare className="w-4 h-4 text-muted-foreground" />} />
                                <StatCard title="Année" value={4000} icon={<Activity className="w-4 h-4 text-muted-foreground" />} />
                            </div>
                        </div>
                    )}

                    {/* INSTANCE WHATSAPP */}
                    {activeTab === "whatsapp" && (
                        <CustomCard className="shadow-sm p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <CardHeader>
                                <CardTitle>Comportement de l&apos;instance</CardTitle>
                                <CardDescription>
                                    Ajustez la façon dont votre numéro réagit sur WhatsApp via Evolution API.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <ToggleSetting
                                    title="Toujours en ligne"
                                    description="Force le statut WhatsApp à 'En ligne'."
                                    defaultChecked={true}
                                    onToggle={(v) => handleUpdateWhatsAppSetting("alwaysOnline", v)}
                                />
                                <Separator />
                                <ToggleSetting
                                    title="Marquer comme lu"
                                    description="Envoie les accusés de lecture dès réception."
                                    defaultChecked={false}
                                    onToggle={(v) => handleUpdateWhatsAppSetting("readReceipts", v)}
                                />
                                <Separator />
                                <ToggleSetting
                                    title="Indicateur de frappe"
                                    description="Simule 'est en train d'écrire...' avant la réponse."
                                    defaultChecked={true}
                                    onToggle={(v) => handleUpdateWhatsAppSetting("typingIndicator", v)}
                                />
                            </CardContent>
                        </CustomCard>
                    )}

                    {/* ONGLET : EXPORT */}
                    {activeTab === "export" && (
                        <CustomCard className="shadow-sm p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <CardHeader>
                                <CardTitle>Exportation des données</CardTitle>
                                <CardDescription>Téléchargez l&apos;historique complet de vos contacts.</CardDescription>
                            </CardHeader>
                            <CardContent className="flex flex-col sm:flex-row gap-4">
                                <Button variant="outline" className="w-full flex-1 gap-2 h-12! sm:h-10" onClick={() => handleExport("csv")}>
                                    <Download className="w-4 h-4" />
                                    <span className="font-medium">Export CSV</span>
                                </Button>
                                <Button variant="outline" className="w-full flex-1 gap-2 h-12! sm:h-10" onClick={() => handleExport("excel")}>
                                    <Download className="w-4 h-4" />
                                    <span className="font-medium">Export Excel</span>
                                </Button>
                            </CardContent>
                        </CustomCard>
                    )}

                    {/* ONGLET : DANGER ZONE */}
                    {activeTab === "danger" && (
                        <CustomCard className="border-destructive/20 p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-6">
                                <div className="space-y-1 flex-1">
                                    <h3 className={`font-semibold ${project.status !== "paused" && "text-destructive"}`}>{project.status === "paused" ? "Réactiver le projet" : "Désactiver le project"}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        {project.status === "paused" ? "Réactiver le project." : 'Déconnecte immédiatement l&apos;instance WhatsApp. Réactivation possible.'}
                                    </p>
                                </div>
                                <AlertDisable project={project} />
                            </CardContent>

                            <Separator className="my-4" />

                            <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6">
                                <div className="space-y-1 flex-1">
                                    <h3 className="font-semibold text-destructive">Supprimer le projet</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Détruit toutes les données de prospects. Action irréversible.
                                    </p>
                                </div>
                                <Button
                                    variant="destructive"
                                    className="w-full sm:w-auto"
                                    onClick={handleDeleteProject}
                                    disabled={isPending}
                                >
                                    {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                                    Supprimer
                                </Button>
                            </CardContent>
                        </CustomCard>
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
            className={`
                w-auto md:w-full justify-start gap-2 whitespace-nowrap shrink-0 snap-center rounded-full md:rounded-md transition-all
                ${active && !isDanger ? "bg-secondary text-secondary-foreground shadow-sm" : ""} 
                ${isDanger && !active ? "text-destructive hover:text-destructive hover:bg-destructive/10" : ""}
                ${!active ? "text-muted-foreground hover:text-foreground" : ""}
            `}
            onClick={onClick}
        >
            {icon}
            {label}
        </Button>
    );
}

function StatCard({ title, value, icon }: StatCardProps) {
    return (
        <Card className="shadow-sm rounded-none">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-4 md:p-6">
                <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground line-clamp-1">
                    {title}
                </CardTitle>
                {icon}
            </CardHeader>
            <CardContent className="p-4 pt-0 md:p-6 md:pt-0">
                <div className="text-xl md:text-2xl font-bold">{value.toLocaleString()}</div>
            </CardContent>
        </Card>
    );
}

function ToggleSetting({ title, description, defaultChecked = false, onToggle, disabled = false }: ToggleSettingProps) {
    const [checked, setChecked] = useState<boolean>(defaultChecked);

    const handleChange = (newChecked: boolean) => {
        setChecked(newChecked);
        onToggle(newChecked);
    };

    return (
        <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{title}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <Switch
                checked={checked}
                onCheckedChange={handleChange}
                className="shrink-0"
                disabled={disabled}
            />
        </div>
    );
}