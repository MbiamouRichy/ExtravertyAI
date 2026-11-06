"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import useSWR from "swr";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  Copy,
  Hash,
  Loader2,
  MoreVertical,
  QrCode,
  RefreshCw,
} from "lucide-react";

import {
  getConnectionData,
  generatePairingCode,
} from "@/app/actions/instance-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ConnectionData = Awaited<ReturnType<typeof getConnectionData>>;
type Method = "qr" | "phone";

const fetchConnection = ([, projectId, method]: readonly [
  string,
  string,
  Method,
]) => getConnectionData(projectId, method);

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

export default function QRCodeScanner({ projectId }: { projectId: string }) {
  // Le key isole les secrets locaux si le projet change.
  return <ConnectionPanel key={projectId} projectId={projectId} />;
}

function ConnectionPanel({ projectId }: { projectId: string }) {
  const chatUrl = `/projects/${encodeURIComponent(projectId)}/chat`;

  const [method, setMethod] = useState<Method>("qr");
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);

  const generationLock = useRef(false);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  const { data, error, isValidating, mutate } =
    useSWR<ConnectionData>(
      // Par code : l’état seul est relu, pour ne pas relancer de QR code
      // qui invaliderait le code de liaison affiché.
      ["whatsapp-connection", projectId, method] as const,
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
  const qrImage = !unavailable ? normalizeQrImage(data?.qrCodeBase64) : null;
  const qrCode =
    !unavailable && typeof data?.qrCode === "string" && data.qrCode
      ? data.qrCode
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
      window.location.replace(chatUrl);
    }, 700);

    return () => clearTimeout(timer);
  }, [connected, chatUrl]);

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
          (!result.success && result.error) ||
            "Impossible de générer le code. Vérifiez le numéro configuré pour ce projet.",
        );
        return;
      }

      const normalized = result.pairingCode.replace(/[\s-]/g, "").toUpperCase();

      if (!/^[A-Z0-9]{4,32}$/.test(normalized)) {
        setActionError("Le serveur a retourné un code invalide.");
        return;
      }

      setPairingCode(normalized);
      void mutate();
    } catch {
      if (mounted.current) {
        setActionError("La demande n’a pas abouti. Vous pouvez réessayer.");
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
        className="rounded-3xl border bg-card p-8 text-center sm:p-12"
      >
        <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground motion-safe:animate-in motion-safe:zoom-in-75 motion-safe:duration-500">
          <Check aria-hidden="true" className="size-7" />
        </span>
        <h2
          id="connection-success-title"
          className="mt-5 text-2xl tracking-tight"
        >
          WhatsApp est connecté
        </h2>
        <p
          role="status"
          className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <Loader2
            aria-hidden="true"
            className="size-4 animate-spin motion-reduce:animate-none"
          />
          {opening ? "Ouverture des conversations…" : "Préparation…"}
        </p>
        <Button asChild variant="outline" className="mt-5">
          <a href={chatUrl}>
            Ouvrir les conversations
            <ArrowRight data-icon="inline-end" />
          </a>
        </Button>
      </section>
    );
  }

  const waiting =
    !unavailable && (method === "qr" ? !!(qrCode || qrImage) : !!pairingCode);

  return (
    <section
      aria-label="Connexion à WhatsApp"
      className="overflow-hidden rounded-3xl border bg-card"
    >
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div
          role="group"
          aria-label="Méthode de connexion"
          // Sélecteur segmenté : deux moitiés égales qui ne débordent jamais.
          className="grid w-full grid-cols-2 gap-1 rounded-xl bg-muted p-1 sm:w-72"
        >
          {[
            { value: "qr" as const, label: "QR code", icon: QrCode },
            { value: "phone" as const, label: "Code", icon: Hash },
          ].map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              type="button"
              variant="ghost"
              aria-pressed={method === value}
              onClick={() => {
                setMethod(value);
                setActionError(null);
                // Comme le QR code : le code est demandé dès le choix de la méthode.
                if (value === "phone" && !pairingCode)
                  void requestPairingCode();
              }}
              className={cn(
                "h-9 min-w-0 rounded-lg px-2",
                method === value
                  ? "bg-background text-foreground shadow-sm hover:bg-background"
                  : "text-muted-foreground hover:bg-background/60",
              )}
            >
              <Icon data-icon="inline-start" />
              {label}
            </Button>
          ))}
        </div>
        <span
          role="status"
          className={cn(
            "inline-flex w-fit shrink-0 items-center gap-2 text-xs text-muted-foreground",
            unavailable && "text-destructive",
          )}
        >
          <span className="relative flex size-2">
            {waiting && (
              <span className="absolute inline-flex size-full rounded-full bg-foreground/50 motion-safe:animate-ping" />
            )}
            <span
              className={cn(
                "relative inline-flex size-2 rounded-full",
                unavailable
                  ? "bg-destructive"
                  : waiting
                    ? "bg-foreground"
                    : "bg-muted-foreground/50",
              )}
            />
          </span>
          {unavailable
            ? "Service indisponible"
            : waiting
              ? "En attente du téléphone"
              : "Préparation…"}
        </span>
      </div>

      {/* Mobile : le QR code ou le code d’abord, les étapes ensuite. Pistes
          minmax(0, 1fr) : rien ne peut élargir la grille au-delà de la carte. */}
      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="flex min-h-80 min-w-0 flex-col items-center justify-center gap-4 border-b px-4 py-6 sm:p-6 md:border-b-0 md:border-r">
          {unavailable ? (
            <div className="text-center">
              <AlertCircle
                aria-hidden="true"
                className="mx-auto size-6 text-destructive"
              />
              <h2 className="mt-3 text-base font-semibold">
                Connexion indisponible
              </h2>
              <Button
                type="button"
                variant="outline"
                disabled={isValidating}
                onClick={() => void mutate()}
                className="mt-4"
              >
                <RefreshCw
                  aria-hidden="true"
                  className={cn(
                    isValidating && "animate-spin motion-reduce:animate-none",
                  )}
                />
                Réessayer
              </Button>
            </div>
          ) : method === "qr" ? (
            // Sombre sur blanc quel que soit le thème, sans logo ni animation :
            // WhatsApp lit ainsi le code du premier coup.
            <div className="w-full max-w-64 rounded-2xl bg-white p-4 ring-1 ring-border">
              <div className="relative aspect-square w-full">
                {qrCode ? (
                  <QRCodeSVG
                    value={qrCode}
                    size={256}
                    level="M"
                    marginSize={0}
                    bgColor="#ffffff"
                    fgColor="#0a0a0a"
                    title="QR code de connexion WhatsApp"
                    role="img"
                    aria-label="QR code de connexion WhatsApp"
                    className="size-full"
                  />
                ) : qrImage ? (
                  <Image
                    src={qrImage}
                    alt="QR code de connexion WhatsApp"
                    fill
                    sizes="256px"
                    unoptimized
                    className="object-contain"
                  />
                ) : (
                  <div
                    role="status"
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <Loader2
                      aria-hidden="true"
                      className="size-6 animate-spin text-neutral-400 motion-reduce:animate-none"
                    />
                    <span className="sr-only">Génération du QR code…</span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {pairingCode ? (
                <>
                  <p dir="ltr" className="sr-only">
                    {pairingCode.split("").join(" ")}
                  </p>
                  <div
                    aria-hidden="true"
                    className="flex w-full max-w-sm items-center justify-center gap-1 sm:gap-1.5"
                  >
                    {pairingCode.split("").map((char, index) => (
                      <span key={index} className="contents">
                        {index > 0 && index % 4 === 0 && (
                          <span className="mx-0.5 h-px w-2 shrink-0 bg-muted-foreground/50" />
                        )}
                        <span className="flex h-11 min-w-0 max-w-8 flex-1 basis-0 items-center justify-center rounded-lg border bg-background font-mono text-base font-semibold sm:text-lg">
                          {char}
                        </span>
                      </span>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ne partagez jamais ce code.
                  </p>
                </>
              ) : (
                !actionError && (
                  <div
                    role="status"
                    className="flex w-full max-w-sm items-center justify-center gap-1 sm:gap-1.5"
                  >
                    <span className="sr-only">Génération du code…</span>
                    {Array.from({ length: 8 }, (_, index) => (
                      <span key={index} aria-hidden="true" className="contents">
                        {index === 4 && (
                          <span className="mx-0.5 h-px w-2 shrink-0 bg-muted-foreground/50" />
                        )}
                        <span
                          className="h-11 min-w-0 max-w-8 flex-1 basis-0 rounded-lg border bg-background motion-safe:animate-pulse"
                          style={{ animationDelay: `${index * 90}ms` }}
                        />
                      </span>
                    ))}
                  </div>
                )
              )}

              {actionError && (
                <p
                  role="alert"
                  className="max-w-xs text-center text-sm text-destructive"
                >
                  {actionError}
                </p>
              )}

              {/* Pas de bouton avant le premier code : seulement pour en
                  obtenir un nouveau ou réessayer après une erreur. */}
              {(pairingCode || actionError) && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {pairingCode && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={copyPairingCode}
                    >
                      {copied ? (
                        <Check data-icon="inline-start" />
                      ) : (
                        <Copy data-icon="inline-start" />
                      )}
                      {copied ? "Copié" : "Copier"}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={generating}
                    onClick={requestPairingCode}
                  >
                    {generating ? (
                      <Loader2
                        data-icon="inline-start"
                        className="animate-spin motion-reduce:animate-none"
                      />
                    ) : (
                      <RefreshCw data-icon="inline-start" />
                    )}
                    {pairingCode ? "Nouveau code" : "Réessayer"}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        <ol className="min-w-0 space-y-5 self-center px-4 py-6 text-sm leading-relaxed text-muted-foreground sm:p-6">
          <Step number={1}>
            Ouvrez <Label>WhatsApp</Label> sur{" "}
            {method === "qr"
              ? "votre téléphone."
              : "le téléphone du numéro de ce projet."}
          </Step>
          <Step number={2}>
            <span className="block">
              Android : touchez{" "}
              <MoreVertical
                aria-hidden="true"
                className="inline size-4 align-text-bottom text-foreground"
              />
              <span className="sr-only">le menu à trois points</span>, puis{" "}
              <Label>Appareils connectés</Label>.
            </span>
            <span className="mt-1 block">
              iPhone : touchez <Label>Réglages</Label>, puis{" "}
              <Label>Appareils connectés</Label>.
            </span>
          </Step>
          <Step number={3}>
            Touchez <Label>Connecter un appareil</Label>.
          </Step>
          <Step number={4}>
            {method === "qr" ? (
              "Visez ce QR code avec votre téléphone."
            ) : (
              <>
                Touchez <Label>Connecter avec un numéro de téléphone</Label>,
                puis saisissez le code.
              </>
            )}
          </Step>
        </ol>
      </div>
    </section>
  );
}

function Step({ number, children }: { number: number; children: ReactNode }) {
  return (
    <li className="flex gap-2.5 sm:gap-3">
      <span
        aria-hidden="true"
        className="flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs text-foreground tabular-nums"
      >
        {number}
      </span>
      <div className="min-w-0">{children}</div>
    </li>
  );
}

/** Nom affiché dans WhatsApp, à retrouver tel quel à l’écran. */
function Label({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-foreground">{children}</strong>;
}
