"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, m } from "motion/react";
import { QRCodeSVG } from "qrcode.react";
import {
  Check,
  Copy,
  Link2Off,
  Loader2,
  LockKeyhole,
  QrCode,
  ScanLine,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  EASE_OUT,
  SPRING,
  usePrefersReducedMotion,
} from "@/components/website/vitrine/motion";

import type { ConnectionMethodId } from "./data";

const QR_REFRESH_S = 20;
const LINK_DELAY_MS = 1400;
// 32 symbols: a random byte maps onto it without bias.
const PAIRING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generatePairingCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (byte) => PAIRING_ALPHABET[byte % 32]).join("");
}

interface WhatsAppConnectionCardProps {
  method: ConnectionMethodId;
  /** International display format, or null while the number is invalid. */
  phoneLabel: string | null;
  e164: string | null;
  connected: boolean;
  onConnectedChange: (e164: string | null) => void;
}

/**
 * Maquette du parcours réel (QRCodeScanner) : le QR code et le code de liaison
 * sont fictifs et n’associent aucun appareil.
 */
export function WhatsAppConnectionCard({
  method,
  phoneLabel,
  e164,
  connected,
  onConnectedChange,
}: WhatsAppConnectionCardProps) {
  const [revealed, setRevealed] = useState(false);
  const [linking, setLinking] = useState(false);
  const [seed, setSeed] = useState(1);
  const [pairingCode, setPairingCode] = useState("");
  const linkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduce = usePrefersReducedMotion();
  const locked = !e164;

  useEffect(
    () => () => {
      if (linkTimer.current) clearTimeout(linkTimer.current);
    },
    [],
  );

  function reveal() {
    setPairingCode(generatePairingCode());
    setRevealed(true);
  }

  function simulateLink() {
    if (!e164 || linking) return;
    setLinking(true);
    linkTimer.current = setTimeout(() => {
      setLinking(false);
      onConnectedChange(e164);
      toast.success("WhatsApp connecté", {
        description: `${phoneLabel} est associé au projet. L’agent attend le lancement.`,
      });
    }, LINK_DELAY_MS);
  }

  async function copyPairingCode() {
    try {
      await navigator.clipboard.writeText(pairingCode);
      toast.success("Code copié");
    } catch {
      toast.error("Copie indisponible : sélectionnez le code manuellement.");
    }
  }

  const status = connected
    ? "Connecté"
    : linking
      ? "Association…"
      : revealed
        ? "En attente du téléphone"
        : "Non connecté";

  return (
    <section
      aria-labelledby="whatsapp-link-title"
      className="overflow-hidden rounded-xl border bg-card"
    >
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h3
          id="whatsapp-link-title"
          className="flex items-center gap-2 font-mono text-[11px] font-medium tracking-widest uppercase"
        >
          <Smartphone aria-hidden="true" className="size-3.5" />
          Appareil lié
        </h3>
        <p
          role="status"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px]",
            connected
              ? "border-transparent bg-primary text-primary-foreground"
              : "text-muted-foreground",
          )}
        >
          <span aria-hidden="true" className="relative flex size-1.5">
            {(linking || (revealed && !connected)) && (
              <span className="absolute inline-flex size-full rounded-full bg-current opacity-60 motion-safe:animate-ping" />
            )}
            <span className="relative inline-flex size-1.5 rounded-full bg-current" />
          </span>
          {status}
        </p>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {connected ? (
          <m.div
            key="connected"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center"
          >
            <m.span
              initial={{ scale: 0.6 }}
              animate={{ scale: 1 }}
              transition={SPRING}
              className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <Check aria-hidden="true" className="size-6" strokeWidth={2.5} />
            </m.span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">WhatsApp est connecté</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                <span className="font-mono tabular-nums text-foreground">{phoneLabel}</span>{" "}
                est lié. L’agent reste en pause jusqu’au lancement.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setRevealed(false);
                onConnectedChange(null);
              }}
            >
              <Link2Off data-icon="inline-start" />
              Déconnecter
            </Button>
          </m.div>
        ) : (
          <m.div
            key="pending"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: EASE_OUT }}
            className="grid gap-6 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-8"
          >
            <div className="flex flex-col items-center gap-3">
              <div className="relative grid size-44 place-items-center overflow-hidden rounded-lg border bg-background p-3">
                <AnimatePresence mode="wait" initial={false}>
                  {method === "code" && revealed ? (
                    <m.div
                      key="code"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ duration: 0.25, ease: EASE_OUT }}
                      className="flex flex-col items-center gap-3"
                    >
                      <span className="font-mono text-[11px] text-muted-foreground">
                        Code de liaison
                      </span>
                      <span
                        aria-label={`Code de liaison : ${pairingCode.split("").join(" ")}`}
                        className="font-mono text-xl font-semibold tracking-[0.18em] tabular-nums"
                      >
                        {pairingCode.slice(0, 4)}-{pairingCode.slice(4)}
                      </span>
                      <Button type="button" variant="outline" size="xs" onClick={copyPairingCode}>
                        <Copy data-icon="inline-start" />
                        Copier
                      </Button>
                    </m.div>
                  ) : (
                    <m.div
                      key={`qr-${seed}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="size-full"
                    >
                      <QRCodeSVG
                        value={`ExtravertyAI · aperçu de connexion n° ${seed} · aucun appareil ne sera associé`}
                        level="M"
                        bgColor="transparent"
                        fgColor="currentColor"
                        role="img"
                        aria-label={
                          revealed
                            ? "QR code de connexion (aperçu fictif)"
                            : "QR code masqué"
                        }
                        className={cn(
                          "size-full text-foreground transition-[filter,opacity] duration-500",
                          !revealed && "opacity-25 blur-xs",
                        )}
                      />
                    </m.div>
                  )}
                </AnimatePresence>

                {revealed && method === "qr" && !linking && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-2 top-0 h-1/3 bg-linear-to-b from-transparent via-foreground/10 to-transparent animate-[qr-scan_2.8s_ease-in-out_infinite] motion-reduce:hidden"
                  />
                )}

                {!revealed && (
                  <div className="absolute inset-0 grid place-items-center p-4">
                    <Button
                      type="button"
                      size="sm"
                      disabled={locked}
                      onClick={reveal}
                      className="shadow-lg"
                    >
                      {method === "qr" ? (
                        <QrCode data-icon="inline-start" />
                      ) : (
                        <LockKeyhole data-icon="inline-start" />
                      )}
                      {method === "qr" ? "Afficher le QR code" : "Obtenir le code"}
                    </Button>
                  </div>
                )}

                {linking && (
                  <div className="absolute inset-0 grid place-items-center bg-background/80 backdrop-blur-xs">
                    <span className="flex flex-col items-center gap-2 font-mono text-[11px]">
                      <Loader2 aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />
                      Association…
                    </span>
                  </div>
                )}
              </div>

              {revealed && method === "qr" && !reduce && !linking && (
                <div className="w-44">
                  <span className="block h-0.5 overflow-hidden rounded-full bg-border">
                    <m.span
                      key={seed}
                      aria-hidden="true"
                      className="block h-full origin-left bg-foreground/60"
                      initial={{ scaleX: 1 }}
                      animate={{ scaleX: 0 }}
                      transition={{ duration: QR_REFRESH_S, ease: "linear" }}
                      onAnimationComplete={() => setSeed((value) => value + 1)}
                    />
                  </span>
                  <span className="mt-1.5 block text-center font-mono text-[10px] text-muted-foreground">
                    Renouvelé toutes les {QR_REFRESH_S} s
                  </span>
                </div>
              )}
            </div>

            <div className="min-w-0">
              <ol className="space-y-3 text-sm">
                {instructions(method, phoneLabel).map((line, index) => (
                  <li key={index} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2">
                    <span
                      aria-hidden="true"
                      className="flex size-6 items-center justify-center rounded-full border font-mono text-[11px] tabular-nums"
                    >
                      {index + 1}
                    </span>
                    <span className="pt-0.5 text-pretty text-muted-foreground">{line}</span>
                  </li>
                ))}
              </ol>

              <div className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4">
                {locked ? (
                  <p className="text-xs text-muted-foreground">
                    Saisissez un numéro valide pour générer le code.
                  </p>
                ) : revealed ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={linking}
                    onClick={simulateLink}
                  >
                    <ScanLine data-icon="inline-start" />
                    {method === "qr" ? "Simuler le scan" : "Simuler la saisie du code"}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Vous pouvez aussi connecter le numéro après le lancement.
                  </p>
                )}
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </section>
  );
}

function instructions(method: ConnectionMethodId, phoneLabel: string | null): ReactNode[] {
  const phone = phoneLabel ? (
    <span className="font-mono tabular-nums text-foreground">{phoneLabel}</span>
  ) : (
    "votre numéro"
  );
  return [
    <>Ouvrez WhatsApp sur le téléphone du {phone}.</>,
    <>
      Touchez <strong className="font-medium text-foreground">Appareils connectés</strong>{" "}
      dans le menu (Android) ou les réglages (iPhone).
    </>,
    method === "qr" ? (
      <>
        Touchez <strong className="font-medium text-foreground">Connecter un appareil</strong>{" "}
        et visez ce QR code.
      </>
    ) : (
      <>
        Choisissez{" "}
        <strong className="font-medium text-foreground">Connecter avec un numéro</strong> et
        saisissez le code.
      </>
    ),
  ];
}
