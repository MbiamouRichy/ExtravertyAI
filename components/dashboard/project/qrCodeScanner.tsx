"use client";

import { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import {
  AlertCircle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Hash,
  Link2,
  Loader2,
  QrCode,
  RefreshCw,
  ScanLine,
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

  const { data, error, isLoading, isValidating, mutate } =
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
        className="relative isolate mx-auto w-full max-w-2xl overflow-hidden rounded-3xl border bg-card p-8 text-center sm:p-12"
      >
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-[radial-gradient(var(--border)_1px,transparent_1px)] mask-[radial-gradient(ellipse_at_center,black,transparent_70%)] bg-size-[18px_18px]"
        />
        <span className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-foreground/10 motion-safe:animate-in motion-safe:zoom-in-75 motion-safe:duration-500">
          <CheckCircle2
            aria-hidden="true"
            className="size-8"
            strokeWidth={1.7}
          />
        </span>
        <p className="mt-6 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Connexion établie
        </p>
        <h2
          id="connection-success-title"
          className="mt-2 text-3xl tracking-tight"
        >
          WhatsApp est connecté
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm text-muted-foreground">
          Votre numéro est associé au projet. La messagerie va s’ouvrir
          automatiquement.
        </p>
        <p
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

  const steps =
    method === "qr"
      ? [
          { icon: Smartphone, text: "Ouvrez WhatsApp sur votre téléphone." },
          {
            icon: Link2,
            text: "Touchez « Appareils connectés », puis « Connecter un appareil ».",
          },
          { icon: ScanLine, text: "Pointez l’appareil photo vers le QR code." },
        ]
      : [
          {
            icon: Smartphone,
            text: "Ouvrez WhatsApp sur le téléphone du numéro configuré pour ce projet.",
          },
          {
            icon: Link2,
            text: "Touchez « Appareils connectés », puis « Connecter un appareil ».",
          },
          {
            icon: Hash,
            text: "Choisissez « Associer avec un numéro de téléphone » et saisissez le code.",
          },
        ];
  const waiting =
    !unavailable && (method === "qr" ? !!(qrCode || qrImage) : !!pairingCode);

  return (
    <section
      aria-labelledby="whatsapp-connect-title"
      className="mx-auto w-full max-w-4xl overflow-hidden rounded-3xl border bg-card shadow-xl shadow-foreground/5"
    >
      <header className="flex flex-col gap-4 border-b px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
        {/* Mobile : icône et titre sur une ligne, description sur toute la largeur. */}
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground sm:row-span-2 sm:self-start">
            <Smartphone aria-hidden="true" className="size-5" />
          </span>
          <h2
            id="whatsapp-connect-title"
            className="font-heading text-lg font-semibold tracking-tight"
          >
            Associer votre compte WhatsApp
          </h2>
          <p className="col-span-2 text-sm text-muted-foreground sm:col-span-1 sm:col-start-2 sm:-mt-1.5">
            Validez la connexion depuis votre téléphone, en moins d’une minute.
          </p>
        </div>
        <span
          role="status"
          className={cn(
            "inline-flex w-fit shrink-0 items-center gap-2 rounded-full border px-3 py-1 text-xs",
            unavailable && "border-destructive/30 text-destructive",
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
      </header>

      <div className="grid md:grid-cols-[1fr_1.05fr]">
        <div className="space-y-7 border-b bg-muted/30 p-5 sm:p-7 md:border-b-0 md:border-r">
          <div
            role="group"
            aria-label="Méthode de connexion"
            // Sélecteur segmenté : deux moitiés égales qui ne débordent jamais.
            className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
          >
            {[
              {
                value: "qr" as const,
                label: "QR code",
                short: "QR code",
                icon: QrCode,
              },
              {
                value: "phone" as const,
                label: "Code de liaison",
                short: "Code",
                icon: Hash,
              },
            ].map(({ value, label, short, icon: Icon }) => (
              <Button
                key={value}
                type="button"
                variant="ghost"
                aria-pressed={method === value}
                aria-label={label}
                onClick={() => {
                  setMethod(value);
                  setActionError(null);
                  // Comme le QR code : le code est demandé dès le choix de la méthode.
                  if (value === "phone" && !pairingCode)
                    void requestPairingCode();
                }}
                className={cn(
                  "h-10 min-w-0 rounded-lg px-2",
                  method === value
                    ? "bg-background text-foreground shadow-sm hover:bg-background"
                    : "text-muted-foreground hover:bg-background/60",
                )}
              >
                <Icon data-icon="inline-start" />
                <span className="truncate">
                  <span className="sm:hidden">{short}</span>
                  <span className="hidden sm:inline">{label}</span>
                </span>
              </Button>
            ))}
          </div>

          <ol className="relative space-y-6 before:absolute before:inset-y-4 before:left-[17px] before:w-px before:bg-border">
            {steps.map(({ icon: Icon, text }, index) => (
              <li key={text} className="relative flex gap-4">
                <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border bg-background">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <div className="pt-0.5">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Étape {index + 1}
                  </p>
                  <p className="mt-0.5 text-sm leading-relaxed">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex min-h-[26rem] flex-col items-center justify-center p-5 sm:p-8">
          {unavailable ? (
            <div className="w-full max-w-sm text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/5">
                <AlertCircle
                  aria-hidden="true"
                  className="size-5 text-destructive"
                />
              </span>
              <h3 className="mt-4 text-base font-semibold">
                Connexion temporairement indisponible
              </h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Nous tentons de récupérer l’état de l’instance. Vous pouvez
                aussi relancer la vérification.
              </p>
              <Button
                type="button"
                variant="outline"
                disabled={isValidating}
                onClick={() => void mutate()}
                className="mt-5"
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
            <>
              {/* Un QR code doit rester sombre sur fond clair, quel que soit le thème. */}
              <div className="relative w-full max-w-72 rounded-3xl border bg-white p-5 shadow-lg shadow-foreground/10">
                <span
                  aria-hidden="true"
                  className="absolute left-2.5 top-2.5 size-5 rounded-tl-lg border-l-2 border-t-2 border-neutral-900"
                />
                <span
                  aria-hidden="true"
                  className="absolute right-2.5 top-2.5 size-5 rounded-tr-lg border-r-2 border-t-2 border-neutral-900"
                />
                <span
                  aria-hidden="true"
                  className="absolute bottom-2.5 left-2.5 size-5 rounded-bl-lg border-b-2 border-l-2 border-neutral-900"
                />
                <span
                  aria-hidden="true"
                  className="absolute bottom-2.5 right-2.5 size-5 rounded-br-lg border-b-2 border-r-2 border-neutral-900"
                />
                <div className="relative aspect-square w-full overflow-hidden">
                  {qrCode ? (
                    <QRCodeSVG
                      value={qrCode}
                      size={256}
                      level="H"
                      marginSize={0}
                      bgColor="#ffffff"
                      fgColor="#0a0a0a"
                      title="QR code de connexion WhatsApp"
                      role="img"
                      aria-label="QR code de connexion WhatsApp. Scannez-le depuis les appareils connectés."
                      className="size-full"
                      imageSettings={{
                        src: "/logo.png",
                        height: 52,
                        width: 52,
                        excavate: true,
                      }}
                    />
                  ) : qrImage ? (
                    <Image
                      src={qrImage}
                      alt="QR code de connexion WhatsApp. Scannez-le depuis les appareils connectés."
                      fill
                      sizes="256px"
                      unoptimized
                      className="object-contain"
                    />
                  ) : (
                    <div
                      role="status"
                      className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center"
                    >
                      <div
                        aria-hidden="true"
                        className="grid size-24 grid-cols-3 gap-1.5 opacity-60"
                      >
                        {Array.from({ length: 9 }, (_, cell) => (
                          <span
                            key={cell}
                            className="rounded-sm bg-neutral-200 motion-safe:animate-pulse"
                            style={{ animationDelay: `${cell * 90}ms` }}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-neutral-600">
                        {isLoading
                          ? "Connexion à votre instance…"
                          : "Génération du QR code…"}
                      </p>
                    </div>
                  )}
                  {(qrCode || qrImage) && (
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-linear-to-b from-transparent via-neutral-900/5 to-transparent motion-safe:animate-[qr-scan_2.8s_ease-in-out_infinite] motion-reduce:hidden"
                    />
                  )}
                </div>
              </div>
              <p className="mt-5 max-w-xs text-center text-xs leading-relaxed text-muted-foreground">
                Le QR code se renouvelle automatiquement. Cette page passe à la
                messagerie dès que votre téléphone valide la connexion.
              </p>
            </>
          ) : (
            <div className="w-full max-w-sm">
              <div className="mb-5 text-center">
                <h3 className="text-base font-semibold">Connexion par code</h3>
              </div>

              {!pairingCode && !actionError && (
                <div
                  role="status"
                  className="mb-5 rounded-2xl border bg-muted/30 p-5 text-center"
                >
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Génération du code…
                  </p>
                  <div
                    aria-hidden="true"
                    className="mt-4 flex items-center justify-center gap-1 sm:gap-1.5"
                  >
                    {Array.from({ length: 8 }, (_, index) => (
                      <span key={index} className="contents">
                        {index === 4 && (
                          <span className="mx-0.5 h-px w-2 bg-muted-foreground/50" />
                        )}
                        <span
                          className="h-10 w-6 rounded-lg sm:h-11 sm:w-8 border bg-background motion-safe:animate-pulse"
                          style={{ animationDelay: `${index * 90}ms` }}
                        />
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {pairingCode && (
                <div className="mb-5 rounded-2xl border bg-muted/30 p-5 text-center">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    Code à saisir sur le téléphone
                  </p>
                  <p dir="ltr" className="sr-only">
                    {pairingCode.split("").join(" ")}
                  </p>
                  <div
                    aria-hidden="true"
                    className="mt-4 flex items-center justify-center gap-1 sm:gap-1.5"
                  >
                    {pairingCode.split("").map((char, index) => (
                      <span key={index} className="contents">
                        {index > 0 && index % 4 === 0 && (
                          <span className="mx-0.5 h-px w-2 bg-muted-foreground/50" />
                        )}
                        <span className="flex h-10 w-6 items-center justify-center rounded-lg border bg-background font-mono text-base font-semibold shadow-xs sm:h-11 sm:w-8 sm:text-lg">
                          {char}
                        </span>
                      </span>
                    ))}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-4"
                    onClick={copyPairingCode}
                  >
                    {copied ? (
                      <Check data-icon="inline-start" />
                    ) : (
                      <Copy data-icon="inline-start" />
                    )}
                    {copied ? "Code copié" : "Copier le code"}
                  </Button>
                </div>
              )}

              {actionError && (
                <p
                  role="alert"
                  className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs leading-relaxed text-destructive"
                >
                  {actionError}
                </p>
              )}

              {/* Pas de bouton avant le premier code : seulement pour en
                  obtenir un nouveau ou réessayer après une erreur. */}
              {(pairingCode || actionError) && (
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  disabled={generating}
                  onClick={requestPairingCode}
                  className="w-full"
                >
                  {generating && (
                    <Loader2
                      aria-hidden="true"
                      className="animate-spin motion-reduce:animate-none"
                    />
                  )}
                  {generating
                    ? "Génération…"
                    : pairingCode
                      ? "Générer un nouveau code"
                      : "Réessayer"}
                </Button>
              )}

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
    </section>
  );
}
