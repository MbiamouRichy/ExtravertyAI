"use client";

import { useState } from "react";
import useSWR from "swr";
import Image from "next/image";
import { getConnectionData, generatePairingCode } from "@/app/actions/instance-actions"; // Adapte le chemin
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

const fetcher = (projectId: string) => getConnectionData(projectId);

export default function WhatsAppConnect({ projectId }: { projectId: string }) {
    const [method, setMethod] = useState<"qr" | "phone">("qr");
    const [pairingCode, setPairingCode] = useState<string | null>(null);
    const [isGeneratingCode, setIsGeneratingCode] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);

    // Polling SWR optimisé
    const { data, error } = useSWR(projectId, fetcher, {
        refreshInterval: (currentData) =>
            currentData?.status === "connected" || currentData?.status === "error" ? 0 : 3000,
        revalidateOnFocus: false,
    });

    const handleRequestPairingCode = async () => {
        setActionError(null);
        setIsGeneratingCode(true);

        const res = await generatePairingCode(projectId);

        if (res.success && res.pairingCode) {
            const formattedCode = res.pairingCode.match(/.{1,4}/g)?.join("-") || res.pairingCode;
            setPairingCode(formattedCode);
        } else {
            setActionError(res.error || "Échec de la génération du code.");
        }

        setIsGeneratingCode(false);
    };

    // --- ÉTAT : ERREUR GLOBALE ---
    if (error || data?.status === "error") {
        return (
            <div className="w-full max-w-md my-auto mx-auto p-6 flex flex-col items-center text-center bg-card border rounded-xl shadow-sm">
                <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mb-4">
                    <AlertCircle className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-semibold mb-1">
                    Échec de l&apos;authentification
                </h3>
                <p className="text-sm text-muted-foreground">
                    {data?.error || "Le pont de sécurité n'a pas pu être établi. Veuillez réessayer."}
                </p>
            </div>
        );
    }

    // --- ÉTAT : CHARGEMENT INITIAL ---
    if (!data) {
        return (
            <div className="w-full max-w-md my-auto mx-auto p-8 flex flex-col items-center text-center bg-card border rounded-xl shadow-sm">
                <div className="relative w-16 h-16 flex items-center justify-center mb-6">
                    <div className="absolute inset-0 border-2 border-muted-foreground rounded-full"></div>
                    <Loader2 className="w-8 h-8animate-spin" />
                </div>
                <h3 className="text-sm font-medium mb-1">
                    Génération du jeton sécurisé
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 animate-pulse">
                    Établissement du tunnel crypté en cours...
                </p>
            </div>
        );
    }

    // --- ÉTAT : CONNECTÉ (SUCCÈS) ---
    if (data.status === "connected") {
        return (
            <div className="w-full max-w-md mx-auto my-auto p-8 flex flex-col items-center text-center bg-card border rounded-xl shadow-sm relative overflow-hidden">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-zinc-500/5 blur-3xl rounded-full"></div>
                <div className="relative z-10 w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4 border border-zinc-200 dark:border-zinc-800">
                    <ShieldCheck className="w-8 h-8 " />
                </div>
                <h3 className="text-lg font-bold mb-2">
                    Appareil Authentifié
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Votre compte WhatsApp est désormais sécurisé et relié à l&apos;infrastructure d&apos;ExtravertyAI.
                </p>
                <div className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium border px-3 py-1.5 rounded-full">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <p>Pont de données actif</p>
                </div>
            </div>
        );
    }

    // --- ÉTAT : SÉLECTION DE LA MÉTHODE ---
    return (
        <div className="w-full max-w-md mx-auto my-auto p-6 md:p-8 flex flex-col items-center bg-card border  rounded-xl shadow-sm">
            <div className="w-full text-center mb-6">
                <h3 className="text-xl font-semibold mb-2 tracking-tight">
                    Associer votre appareil
                </h3>

                <div className="flex items-center justify-between bg-muted p-1 rounded-lg mt-4 border">
                    <Button
                        onClick={() => setMethod("qr")}
                        variant={method === "qr" ? "outline" : "ghost"}
                        className="w-1/2"
                    >
                        <QrCode className="w-4 h-4" /> QR Code
                    </Button>
                    <Button
                        onClick={() => setMethod("phone")}
                        variant={method === "phone" ? "outline" : "ghost"}
                        className="w-1/2"
                    >
                        <Hash className="w-4 h-4" /> Numéro
                    </Button>
                </div>
            </div>
            <div className="flex flex-col items-center gap-4 w-full animate-in fade-in slide-in-from-bottom-2 duration-300 py-4">
                <div className="flex items-start gap-3 bg-muted p-4 rounded-xl border mb-6 w-full">
                    <Smartphone className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground leading-relaxed text-left">
                        Ouvrez WhatsApp &gt; <strong>Appareils connectés</strong> &gt;{" "}
                        <b>Connecter un appareil</b>, puis scannez ce code.
                    </p>
                </div>
                {/* VUE : QR CODE */}
                {method === "qr" && (


                    <div className="relative mb-6">
                        <div className="absolute -top-3 -left-3 w-8 h-8 border-t-2 border-l-2 border-foreground rounded-tl-lg"></div>
                        <div className="absolute -top-3 -right-3 w-8 h-8 border-t-2 border-r-2 border-foreground rounded-tr-lg"></div>
                        <div className="absolute -bottom-3 -left-3 w-8 h-8 border-b-2 border-l-2 border-foreground rounded-bl-lg"></div>
                        <div className="absolute -bottom-3 -right-3 w-8 h-8 border-b-2 border-r-2 border-foreground rounded-br-lg"></div>

                        {data.qrCodeBase64 ? (
                            <div className="relative w-55 h-55 p-3 rounded-xl shadow-sm border">
                                <Image
                                    src={data.qrCodeBase64}
                                    alt="QR Code d'authentification WhatsApp"
                                    fill
                                    className="object-contain p-2"
                                    unoptimized
                                />
                            </div>
                        ) : (
                            <div className="w-55 h-55 flex flex-col items-center justify-center rounded-xl border">
                                <Loader2 className="w-6 h-6 text-muted-foreground animate-spin mb-3" />
                                <span className="text-xs font-medium text-muted-foreground">
                                    Création de la session...
                                </span>
                            </div>
                        )}
                    </div>
                )}
                {/* VUE : NUMÉRO DE TÉLÉPHONE (PAIRING CODE) */}
                {method === "phone" && (
                    <>
                        {actionError && (
                            <div className="w-full border p-3 rounded-lg mb-4 text-sm flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                                <p>{actionError}</p>
                            </div>
                        )}

                        {!pairingCode ? (
                            <div className="w-full text-center">
                                <div className="flex items-start gap-3 p-4 rounded-xl border bg-muted mb-6">
                                    <Hash className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                                    <p className="text-sm text-muted-foreground leading-relaxed text-left">
                                        Un code sera généré pour le numéro WhatsApp configuré dans les paramètres de ce projet.
                                    </p>
                                </div>

                                <Button
                                    onClick={handleRequestPairingCode}
                                    disabled={isGeneratingCode}
                                >
                                    {isGeneratingCode ? (
                                        <><Loader2 className="w-4 h-4 animate-spin" /> Génération en cours...</>
                                    ) : (
                                        "Générer le code de couplage"
                                    )}
                                </Button>
                            </div>
                        ) : (
                            <div className="w-full flex flex-col items-center">
                                <div className="border rounded-xl p-6 w-full text-center relative group">
                                    <span className="block text-xs font-semibold tracking-widest uppercase mb-2">
                                        Votre Code
                                    </span>
                                    <span className="text-3xl md:text-4xl font-mono font-bold tracking-[0.2em]">
                                        {pairingCode}
                                    </span>
                                    <Button
                                        variant="ghost"
                                        size="icon-sm"
                                        onClick={handleRequestPairingCode}
                                        className="absolute top-3 right-3"
                                        title="Générer un nouveau code"
                                    >
                                        <RefreshCcw className="w-4 h-4" />
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-4 flex items-center gap-2 animate-pulse">
                                    <Loader2 className="w-3 h-3 animate-spin" /> En attente de validation par l&apos;appareil...
                                </p>
                            </div>
                        )}
                    </>)
                }
            </div>


            {/* Badge de sécurité global */}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground pt-6 w-full justify-center border-t border-muted">
                <Lock className="w-3.5 h-3.5" />
                <span>Tunnel chiffré de bout en bout</span>
            </div>
        </div>
    );
}