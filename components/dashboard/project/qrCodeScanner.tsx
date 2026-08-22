"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import Image from "next/image";
import { getConnectionData, generatePairingCode } from "@/app/actions/instance-actions";
import {
    ShieldCheck,
    AlertCircle,
    Loader2,
    Smartphone,
    Lock,
    CheckCircle2,
    QrCode,
    Hash,
    RefreshCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import CustomCard from "@/components/ui/customCard";

const fetcher = (projectId: string) => getConnectionData(projectId);

export default function WhatsAppConnect({ projectId }: { projectId: string }) {
    const [method, setMethod] = useState<"qr" | "phone">("qr");
    const [pairingCode, setPairingCode] = useState<string | null>(null);
    const [isGeneratingCode, setIsGeneratingCode] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const router = useRouter()

    const { data, error } = useSWR(projectId, fetcher, {
        refreshInterval: (currentData) =>
            currentData?.status === "connected" || currentData?.status === "error" ? 0 : 3000,
        revalidateOnFocus: false,
    });

    const handleRequestPairingCode = async () => {
        setActionError(null);
        setIsGeneratingCode(true);

        const res = await generatePairingCode(projectId);

        // CORRECTION TS ICI : On vérifie que pairingCode est bien une string
        if (res.success && typeof res.pairingCode === "string") {
            const formattedCode = res.pairingCode.match(/.{1,4}/g)?.join("-") || res.pairingCode;
            setPairingCode(formattedCode);
        } else {
            setActionError(res.error || "Échec de la génération du code.");
        }

        setIsGeneratingCode(false);
    };

    // --- REDIRECTION AUTOMATIQUE LORS DE LA CONNEXION ---
    useEffect(() => {
        if (data?.status === "connected") {
            const timer = setTimeout(() => {
                // Adapte cette route selon la structure de ton application (ex: /projects/${projectId}/messages)
                router.refresh();
            }, 1500); // Petit délai de 1.5s pour laisser l'utilisateur voir le message de succès

            return () => clearTimeout(timer);
        }
    }, [data?.status, projectId, router]);

    // --- ÉTAT : ERREUR GLOBALE ---
    if (error || data?.status === "error") {
        return (
            <div className="w-full max-w-md my-auto mx-auto p-6 flex flex-col items-center text-center bg-card border rounded-xl shadow-sm">
                <div className="w-12 h-12 bg-red-50 text-red-500 dark:bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold mb-1">
                    Une erreur est survenue
                </h3>
                <p className="text-sm text-muted-foreground">
                    Le pont de sécurité n&apos;a pas pu être établi. Veuillez réessayer.
                </p>
                <Button
                    onClick={() => router.refresh()}
                >
                    Réessayer...
                </Button>
            </div>
        );
    }

    // --- ÉTAT : CHARGEMENT INITIAL ---
    if (!data) {
        return (
            <div className="w-full max-w-md my-auto mx-auto p-8 flex flex-col items-center text-center bg-card border rounded-xl shadow-sm">
                <div className="relative w-16 h-16 flex items-center justify-center mb-6">
                    <div className="absolute inset-0 border-2 border-muted-foreground/20 rounded-full"></div>
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
                <h3 className="text-sm font-medium mb-1">
                    Génération du jeton sécurisé
                </h3>
                <p className="text-xs text-muted-foreground animate-pulse">
                    Établissement du tunnel crypté en cours...
                </p>
            </div>
        );
    }

    // --- ÉTAT : CONNECTÉ (SUCCÈS) ---
    if (data.status === "connected") {
        return (
            <div className="w-full max-w-md mx-auto my-auto p-8 flex flex-col items-center text-center bg-card border rounded-xl shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-green-500/10 blur-3xl rounded-full"></div>
                <div className="relative z-10 w-16 h-16 bg-green-50 dark:bg-green-500/10 text-green-600 rounded-full flex items-center justify-center mb-4 border border-green-200 dark:border-green-900/50">
                    <ShieldCheck className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold mb-2">
                    Appareil Authentifié
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Votre compte WhatsApp est désormais sécurisé et relié à l&apos;infrastructure d&apos;ExtravertyAI.
                </p>
                <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 text-xs font-medium border border-green-200 dark:border-green-900 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-500/10">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <p>Pont de données actif</p>
                </div>
                <div className="flex items-center gap-2 mt-2 text-green-600 dark:text-green-400 text-xs font-medium border border-green-200 dark:border-green-900 px-3.5 py-2 rounded-full bg-green-50 dark:bg-green-500/10">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Ouverture du module de discussion</span>
                </div>
            </div>
        );
    }

    // --- ÉTAT : SÉLECTION DE LA MÉTHODE ---
    return (
        <CustomCard className="w-full max-w-md mx-auto my-auto p-6 md:p-8 flex flex-col items-center bg-card border shadow-sm">
            <div className="w-full text-center mb-6">
                <h3 className="text-xl font-semibold mb-2 tracking-tight">
                    Associer votre appareil
                </h3>

                <div className="flex items-center justify-between bg-muted p-1 rounded-lg mt-4 border">
                    <Button
                        onClick={() => setMethod("qr")}
                        variant={method === "qr" ? "outline" : "ghost"}
                        className="w-1/2 shadow-none"
                    >
                        <QrCode className="w-4 h-4 mr-2" /> QR Code
                    </Button>
                    <Button
                        onClick={() => setMethod("phone")}
                        variant={method === "phone" ? "outline" : "ghost"}
                        className="w-1/2 shadow-none"
                    >
                        <Hash className="w-4 h-4 mr-2" /> Numéro
                    </Button>
                </div>
            </div>

            <div className="flex flex-col items-center gap-4 w-full animate-in fade-in slide-in-from-bottom-2 duration-300 py-2">

                <div className="flex items-start gap-3 bg-muted/50 p-4 rounded-xl border mb-2 w-full">
                    <Smartphone className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground leading-relaxed text-left">
                        Ouvrez WhatsApp &gt; <strong>Appareils connectés</strong> &gt;{" "}
                        <b>Connecter un appareil</b>, puis scannez ce code.
                    </p>
                </div>

                {/* --- VUE : QR CODE (EMBELLIE) --- */}
                {method === "qr" && (
                    <div className="relative my-6 flex items-center justify-center">
                        {/* Coins de scan - Ajustés pour correspondre à l'image_912c86.png */}
                        <div className="absolute -top-2 -left-2 w-6 h-6 border-t-2 border-l-2 border-foreground rounded-tl-lg"></div>
                        <div className="absolute -top-2 -right-2 w-6 h-6 border-t-2 border-r-2 border-foreground rounded-tr-lg"></div>
                        <div className="absolute -bottom-2 -left-2 w-6 h-6 border-b-2 border-l-2 border-foreground rounded-bl-lg"></div>
                        <div className="absolute -bottom-2 -right-2 w-6 h-6 border-b-2 border-r-2 border-foreground rounded-br-lg"></div>

                        <div className="relative w-64 h-64 bg-white rounded-xl shadow-md border border-zinc-200 flex items-center justify-center p-3">
                            {data.qrCodeBase64 ? (
                                <div className="relative w-full h-full">
                                    <Image
                                        src={data.qrCodeBase64}
                                        alt="QR Code d'authentification WhatsApp"
                                        fill
                                        className="object-contain"
                                        unoptimized
                                    />
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center text-zinc-400">
                                    <Loader2 className="w-8 h-8 animate-spin mb-3 text-zinc-300" />
                                    <span className="text-xs font-medium">
                                        Création du code...
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* --- VUE : NUMÉRO DE TÉLÉPHONE (PAIRING CODE) --- */}
                {method === "phone" && (
                    <div className="w-full mt-2">
                        {actionError ? (
                            <div className="w-full border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-900/50 text-red-600 dark:text-red-400 p-3 rounded-lg mb-4 text-sm flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <p>{actionError}</p>
                            </div>
                        ) : !pairingCode ? (
                            <div className="w-full text-center">
                                <div className="flex items-start gap-3 p-4 rounded-xl border bg-muted/50 mb-6">
                                    <Hash className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                                    <p className="text-sm text-muted-foreground leading-relaxed text-left">
                                        Un code sera généré pour le numéro WhatsApp configuré dans les paramètres de ce projet.
                                    </p>
                                </div>

                                <Button
                                    onClick={handleRequestPairingCode}
                                    disabled={isGeneratingCode}
                                    className="w-full"
                                >
                                    {isGeneratingCode ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Génération...</>
                                    ) : (
                                        "Générer le code de couplage"
                                    )}
                                </Button>
                            </div>
                        ) : (
                            <div className="w-full flex flex-col items-center">
                                <div className="border bg-card rounded-xl p-6 w-full text-center relative group shadow-sm">
                                    <span className="block text-xs font-semibold tracking-widest text-muted-foreground uppercase mb-3">
                                        Votre Code
                                    </span>
                                    <span className="text-3xl md:text-4xl font-mono font-bold tracking-[0.2em] text-foreground">
                                        {pairingCode}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleRequestPairingCode}
                                        className="absolute top-2 right-2 h-8 w-8 text-muted-foreground hover:text-foreground"
                                        title="Générer un nouveau code"
                                    >
                                        <RefreshCcw className="w-4 h-4" />
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-5 flex items-center gap-2 animate-pulse">
                                    <Loader2 className="w-3 h-3 animate-spin" /> En attente de validation par l&apos;appareil...
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Badge de sécurité global */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-6 w-full justify-center border-t mt-4">
                <Lock className="w-3.5 h-3.5" />
                <span>Tunnel chiffré de bout en bout</span>
            </div>
        </CustomCard>
    );
}