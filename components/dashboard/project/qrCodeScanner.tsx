"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
    AlertCircle,
    ArrowRight,
    Check,
    CheckCircle2,
    Copy,
    Hash,
    Loader2,
    QrCode,
    RefreshCw,
    Smartphone,
} from "lucide-react";

import {
    getConnectionData,
    generatePairingCode,
} from "@/app/actions/instance-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConnectionData = Awaited<ReturnType<typeof getConnectionData>>;
type Method = "qr" | "phone";

const fetchConnection = ([, projectId]: readonly [string, string]) =>
    getConnectionData(projectId);

function normalizeQrImage(value: unknown): string | null {
    if (typeof value !== "string") return null;

    // On n'affiche pas une URL distante arbitraire comme secret de connexion.
    // Ce composant attend une image PNG/JPEG en data URL.
    if (
        value.length > 2_000_000 ||
        !/^data:image\/(?:png|jpeg);base64,[a-zA-Z0-9+/=\r\n]+$/.test(value)
    ) {
        return null;
    }

    return value;
}

export default function QRCodeScanner({
    projectId,
}: {
    projectId: string;
}) {
    // Le key isole les secrets locaux si le projet change.
    return <ConnectionPanel key={projectId} projectId={projectId} />;
}

function ConnectionPanel({ projectId }: { projectId: string }) {
    const router = useRouter();

    const [method, setMethod] = useState<Method>("qr");
    const [pairingCode, setPairingCode] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [opening, setOpening] = useState(false);

    const generationLock = useRef(false);
    const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const mounted = useRef(true);

    const { data, error, isLoading, isValidating, mutate } =
        useSWR<ConnectionData>(
            ["whatsapp-connection", projectId] as const,
            fetchConnection,
            {
                refreshInterval: (current) =>
                    current?.status === "connected" ? 0 : 3000,
                refreshWhenHidden: false,
                refreshWhenOffline: false,
                revalidateOnFocus: true,
                revalidateOnReconnect: true,
                dedupingInterval: 1000,
                errorRetryCount: 3,
                errorRetryInterval: 5000,
            },
        );

    const connected = data?.status === "connected";
    const unavailable = !!error || data?.status === "error";
    const qrImage = !unavailable
        ? normalizeQrImage(data?.qrCodeBase64)
        : null;

    useEffect(() => {
        mounted.current = true;

        return () => {
            mounted.current = false;

            if (copyTimer.current) {
                clearTimeout(copyTimer.current);
            }
        };
    }, []);

    useEffect(() => {
        if (!connected) return;

        setPairingCode(null);

        const timer = setTimeout(() => {
            setOpening(true);
            router.refresh();
        }, 700);

        return () => clearTimeout(timer);
    }, [connected, router]);

    async function requestPairingCode() {
        if (generationLock.current || connected) return;

        generationLock.current = true;
        setGenerating(true);
        setActionError(null);
        setCopied(false);

        // Un ancien code peut être invalidé par la nouvelle demande.
        setPairingCode(null);

        try {
            const result = await generatePairingCode(projectId);

            if (!mounted.current) return;

            if (
                !result.success ||
                typeof result.pairingCode !== "string" ||
                !result.pairingCode.trim()
            ) {
                setActionError(
                    "Impossible de générer le code. Vérifiez le numéro configuré pour ce projet.",
                );
                return;
            }

            const normalized = result.pairingCode
                .replace(/[\s-]/g, "")
                .toUpperCase();

            if (!/^[A-Z0-9]{4,32}$/.test(normalized)) {
                setActionError("Le serveur a retourné un code invalide.");
                return;
            }

            setPairingCode(normalized);
            void mutate();
        } catch {
            if (mounted.current) {
                setActionError(
                    "La demande n’a pas abouti. Vous pouvez réessayer.",
                );
            }
        } finally {
            generationLock.current = false;

            if (mounted.current) {
                setGenerating(false);
            }
        }
    }

    async function copyPairingCode() {
        if (!pairingCode) return;

        try {
            await navigator.clipboard.writeText(pairingCode);

            if (!mounted.current) return;

            setCopied(true);

            if (copyTimer.current) {
                clearTimeout(copyTimer.current);
            }

            copyTimer.current = setTimeout(() => {
                if (mounted.current) setCopied(false);
            }, 2000);
        } catch {
            setActionError(
                "La copie est indisponible. Vous pouvez sélectionner le code manuellement.",
            );
        }
    }

    if (connected) {
        return (
            <section
                aria-labelledby="connection-success-title"
                className="mx-auto w-full max-w-2xl rounded-2xl border border-border/70 bg-card p-6 text-center shadow-sm sm:p-10"
            >
                <div className="mx-auto mb-5 flex size-16 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10">
                    <CheckCircle2
                        aria-hidden="true"
                        className="size-8 text-emerald-700 dark:text-emerald-400"
                        strokeWidth={1.7}
                    />
                </div>

                <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                    Connexion établie
                </p>

                <h2
                    id="connection-success-title"
                    className="mt-2 text-2xl font-semibold tracking-tight"
                >
                    WhatsApp est connecté
                </h2>

                <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    L’instance de votre projet est prête.
                    Votre espace de conversation va s’ouvrir automatiquement.
                </p>

                <div
                    role="status"
                    className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground"
                >
                    <Loader2
                        aria-hidden="true"
                        className="size-4 animate-spin motion-reduce:animate-none"
                    />
                    {opening
                        ? "Ouverture des conversations…"
                        : "Préparation de votre espace…"}
                </div>

                <Button
                    type="button"
                    variant="outline"
                    className="mt-5 gap-2 rounded-xl"
                    onClick={() => router.refresh()}
                >
                    Ouvrir les conversations
                    <ArrowRight aria-hidden="true" className="size-4" />
                </Button>
            </section>
        );
    }

    const steps =
        method === "qr"
            ? [
                "Ouvrez WhatsApp sur votre téléphone.",
                "Accédez à « Appareils connectés », puis « Connecter un appareil ».",
                "Scannez le QR code affiché à droite.",
            ]
            : [
                "Ouvrez WhatsApp sur le téléphone du numéro configuré pour ce projet.",
                "Accédez à « Appareils connectés », puis « Connecter un appareil ».",
                "Choisissez la liaison avec un numéro de téléphone, puis saisissez le code.",
            ];

    return (
        <section
            aria-labelledby="whatsapp-connect-title"
            className="mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm"
        >
            <header className="border-b border-border/70 px-5 py-5 sm:px-7">
                <div className="flex items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border bg-muted/30">
                        <Smartphone
                            aria-hidden="true"
                            className="size-5 text-muted-foreground"
                        />
                    </div>

                    <div>
                        <h2
                            id="whatsapp-connect-title"
                            className="text-lg font-semibold tracking-tight"
                        >
                            Associer votre compte WhatsApp
                        </h2>

                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                            Choisissez une méthode, puis validez la connexion
                            depuis votre téléphone.
                        </p>
                    </div>
                </div>
            </header>

            <div className="grid md:grid-cols-[1fr_1.05fr]">
                <div className="space-y-6 border-b border-border/70 bg-muted/20 p-5 sm:p-7 md:border-b-0 md:border-r">
                    <fieldset>
                        <legend className="mb-3 text-xs font-semibold text-muted-foreground">
                            Méthode de connexion
                        </legend>

                        <div className="grid grid-cols-2 gap-1 rounded-xl border bg-background p-1">
                            {[
                                {
                                    value: "qr" as const,
                                    label: "QR code",
                                    icon: QrCode,
                                },
                                {
                                    value: "phone" as const,
                                    label: "Code de liaison",
                                    icon: Hash,
                                },
                            ].map(({ value, label, icon: Icon }) => (
                                <button
                                    key={value}
                                    type="button"
                                    aria-pressed={method === value}
                                    onClick={() => {
                                        setMethod(value);
                                        setActionError(null);
                                    }}
                                    className={cn(
                                        "flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-xs font-medium",
                                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                        method === value
                                            ? "bg-primary text-primary-foreground shadow-sm"
                                            : "text-muted-foreground hover:bg-muted",
                                    )}
                                >
                                    <Icon
                                        aria-hidden="true"
                                        className="size-4 shrink-0"
                                    />
                                    {label}
                                </button>
                            ))}
                        </div>
                    </fieldset>

                    <ol className="space-y-5">
                        {steps.map((step, index) => (
                            <li key={step} className="flex gap-3">
                                <span
                                    aria-hidden="true"
                                    className="flex size-7 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold tabular-nums"
                                >
                                    {index + 1}
                                </span>

                                <p className="pt-1 text-sm leading-relaxed text-muted-foreground">
                                    {step}
                                </p>
                            </li>
                        ))}
                    </ol>

                    <p className="text-xs leading-relaxed text-muted-foreground">
                        Le nom des options peut varier selon votre version
                        de WhatsApp.
                    </p>
                </div>

                <div className="flex min-h-97.5 flex-col items-center justify-center p-5 sm:p-7">
                    {unavailable ? (
                        <div className="w-full max-w-sm text-center">
                            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-destructive/10">
                                <AlertCircle
                                    aria-hidden="true"
                                    className="size-5 text-destructive"
                                />
                            </div>

                            <h3 className="text-base font-semibold">
                                Connexion temporairement indisponible
                            </h3>

                            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                Nous tentons de récupérer l’état de l’instance.
                                Vous pouvez aussi relancer la vérification.
                            </p>

                            <Button
                                type="button"
                                variant="outline"
                                disabled={isValidating}
                                onClick={() => void mutate()}
                                className="mt-5 gap-2 rounded-xl"
                            >
                                <RefreshCw
                                    aria-hidden="true"
                                    className={cn(
                                        "size-4",
                                        isValidating &&
                                        "animate-spin motion-reduce:animate-none",
                                    )}
                                />
                                Réessayer
                            </Button>
                        </div>
                    ) : method === "qr" ? (
                        <>
                            <div className="w-full max-w-68 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                                <div className="relative aspect-square w-full">
                                    {qrImage ? (
                                        <Image
                                            src={qrImage}
                                            alt="QR code de connexion WhatsApp. Scannez-le depuis les appareils connectés."
                                            fill
                                            sizes="240px"
                                            unoptimized
                                            className="object-contain"
                                        />
                                    ) : (
                                        <div
                                            role="status"
                                            className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center"
                                        >
                                            <Loader2
                                                aria-hidden="true"
                                                className="size-7 animate-spin text-zinc-500 motion-reduce:animate-none"
                                            />
                                            <p className="text-xs text-zinc-600">
                                                {isLoading
                                                    ? "Connexion à votre instance…"
                                                    : "Préparation du QR code…"}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <p
                                role="status"
                                className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"
                            >
                                <Loader2
                                    aria-hidden="true"
                                    className="size-3.5 animate-spin motion-reduce:animate-none"
                                />
                                En attente de validation sur le téléphone
                            </p>

                            <p className="mt-2 max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
                                L’affichage se met à jour automatiquement lorsque
                                le serveur fournit un nouveau QR code.
                            </p>
                        </>
                    ) : (
                        <div className="w-full max-w-sm">
                            <div className="mb-5 text-center">
                                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border bg-muted/30">
                                    <Hash
                                        aria-hidden="true"
                                        className="size-5 text-muted-foreground"
                                    />
                                </div>

                                <h3 className="text-base font-semibold">
                                    Connexion par code
                                </h3>

                                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                                    Le code sera associé au numéro WhatsApp
                                    configuré pour ce projet.
                                </p>
                            </div>

                            {pairingCode && (
                                <div className="mb-4 rounded-xl border bg-muted/20 p-4 text-center">
                                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                                        Code à saisir sur le téléphone
                                    </p>

                                    <p
                                        dir="ltr"
                                        className="mt-3 select-all break-all font-mono text-2xl font-semibold tracking-widest"
                                    >
                                        {pairingCode.match(/.{1,4}/g)?.join("-")}
                                    </p>

                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="mt-3 gap-2 rounded-lg"
                                        onClick={copyPairingCode}
                                    >
                                        {copied ? (
                                            <Check
                                                aria-hidden="true"
                                                className="size-4"
                                            />
                                        ) : (
                                            <Copy
                                                aria-hidden="true"
                                                className="size-4"
                                            />
                                        )}
                                        {copied ? "Code copié" : "Copier le code"}
                                    </Button>
                                </div>
                            )}

                            {actionError && (
                                <p
                                    role="alert"
                                    className="mb-4 rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-xs leading-relaxed text-destructive"
                                >
                                    {actionError}
                                </p>
                            )}

                            <Button
                                type="button"
                                disabled={generating}
                                onClick={requestPairingCode}
                                className="h-11 w-full gap-2 rounded-xl"
                                variant={pairingCode ? "outline" : "default"}
                            >
                                {generating && (
                                    <Loader2
                                        aria-hidden="true"
                                        className="size-4 animate-spin motion-reduce:animate-none"
                                    />
                                )}

                                {generating
                                    ? "Génération…"
                                    : pairingCode
                                        ? "Générer un nouveau code"
                                        : "Générer le code"}
                            </Button>

                            {pairingCode && (
                                <p
                                    role="status"
                                    className="mt-4 text-center text-xs text-muted-foreground"
                                >
                                    En attente de confirmation sur votre téléphone…
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <footer className="border-t border-border/70 px-5 py-4 sm:px-7">
                <p className="text-xs leading-relaxed text-muted-foreground">
                    <strong className="font-medium text-foreground">
                        Gardez ces codes privés.
                    </strong>{" "}
                    Le QR code et le code de liaison permettent d’associer un
                    appareil à votre compte. Ne les partagez pas, même avec
                    une personne se présentant comme le support.
                </p>
            </footer>
        </section>
    );
}