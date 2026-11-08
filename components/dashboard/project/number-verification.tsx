"use client";

import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { CircleAlert, CircleCheck, Info, Loader2, ShieldCheck } from "lucide-react";

import {
  checkNumberMessage,
  confirmNumberCode,
  sendNumberCode,
  startNumberMessage,
} from "@/app/actions/phone-verification";
import { WhatsAppIcon } from "@/components/social-icon";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { safeCheckoutUrl } from "@/lib/checkout-url";
import type { VerificationTarget } from "@/lib/phone-verification";
import { cn } from "@/lib/utils";

/** Issue d’une ouverture du paiement, à la création comme à la reprise. */
export type CheckoutAttempt =
  | { success: true; url: string }
  | { success: false; code?: string; error: string };

export function toCheckoutAttempt(result: {
  success: boolean;
  url?: string;
  code?: string;
  error?: string;
}): CheckoutAttempt {
  if (result.success && result.url) return { success: true, url: result.url };
  return {
    success: false,
    code: result.code,
    error:
      result.error ||
      "Le paiement n’a pas pu être ouvert. Réessayez dans quelques instants.",
  };
}

const CodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, "Saisissez les 6 chiffres du code."),
});
type CodeValues = z.infer<typeof CodeSchema>;

/** Le numéro lui-même est en cause : seule une correction permet d’avancer. */
const NUMBER_PROBLEMS = new Set(["NOT_ON_WHATSAPP", "NUMBER_IN_USE", "INVALID_NUMBER"]);
/** Intervalle de lecture de l’état pendant que le client envoie son message. */
const POLL_MS = 3000;

type Method = "message" | "code";
type PendingMessage = {
  verificationId: string;
  code: string;
  link: string;
  to: string;
  expiresAt: number;
};

/**
 * Preuve que le numéro appartient à l’utilisateur, avant d’enregistrer le
 * projet ou d’ouvrir le paiement.
 *
 * Par défaut, il envoie lui-même un code depuis son WhatsApp au numéro
 * d’ExtravertyAI (un appui sur « Envoyer ») ; la page avance seule dès que le
 * message arrive. En secours, il reçoit un code et le recopie.
 * Le serveur revérifie tout ; ce composant ne fait que guider.
 */
export function NumberVerification({
  target,
  number,
  onContinue,
  onEditNumber,
  withoutTrial = false,
  headingLevel = "h2",
  className,
}: {
  target: VerificationTarget;
  /** Numéro au format international, affiché en entier pour repérer une faute. */
  number: string;
  /** Enregistre le projet (ou reprend son paiement) avec la preuve obtenue. */
  onContinue: (
    verificationId: string | undefined,
    withoutTrial: boolean,
  ) => Promise<CheckoutAttempt>;
  /** Retour au formulaire pour corriger le numéro. */
  onEditNumber?: () => void;
  withoutTrial?: boolean;
  headingLevel?: "h1" | "h2";
  className?: string;
}) {
  const [method, setMethod] = useState<Method>("message");
  // Vérification inversée : code à envoyer, et son état côté serveur.
  const [message, setMessage] = useState<PendingMessage | null>(null);
  const [messageExpired, setMessageExpired] = useState(false);
  const [messageAvailable, setMessageAvailable] = useState(true);
  // Secours : code reçu par WhatsApp, à recopier.
  const [codeId, setCodeId] = useState<string | null>(null);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  // Preuve obtenue, par l’une ou l’autre voie.
  const [verified, setVerified] = useState(false);
  const [proofId, setProofId] = useState<string | undefined>(undefined);
  const [sending, setSending] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [numberProblem, setNumberProblem] = useState(false);
  const [trialUsed, setTrialUsed] = useState(false);
  const started = useRef(false);
  const codeRequested = useRef(false);
  const proceeding = useRef(false);
  const Heading = headingLevel;
  const titleId = useId();

  const form = useForm<CodeValues>({
    resolver: zodResolver(CodeSchema),
    defaultValues: { code: "" },
  });
  const verifying = form.formState.isSubmitting;
  const busy = verifying || continuing || leaving;

  // Compte à rebours du renvoi, rafraîchi chaque seconde tant qu’il court.
  const wait = Math.max(0, Math.ceil((resendAt - now) / 1000));
  useEffect(() => {
    if (resendAt <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);

  /** Ouvre le paiement : projet enregistré, essai déjà utilisé, ou erreur à afficher. */
  async function proceed(id: string | undefined, paid = withoutTrial) {
    // L’arrivée du message peut être lue deux fois (minuteur et retour sur la page).
    if (proceeding.current) return;
    proceeding.current = true;
    setContinuing(true);
    setNotice(null);
    try {
      const result = await onContinue(id, paid);
      if (result.success) {
        const url = safeCheckoutUrl(result.url);
        if (url) {
          setLeaving(true);
          window.location.assign(url);
          return;
        }
        setNotice("Le paiement n’a pas pu être ouvert. Réessayez dans quelques instants.");
      } else if (result.code === "TRIAL_UNAVAILABLE") {
        setTrialUsed(true);
      } else if (result.code === "NUMBER_NOT_VERIFIED") {
        // Preuve expirée (plus de 30 minutes) : une nouvelle vérification est nécessaire.
        setVerified(false);
        setProofId(undefined);
        setTrialUsed(false);
        setCodeId(null);
        setMessageExpired(true);
        setNotice("Votre vérification a expiré. Recommencez avec un nouveau code.");
      } else {
        setNotice(result.error);
      }
    } catch {
      setNotice("La connexion a été interrompue. Réessayez.");
    } finally {
      proceeding.current = false;
      setContinuing(false);
    }
  }

  function markVerified(id: string | undefined) {
    setVerified(true);
    setProofId(id);
    void proceed(id);
  }

  /** Échec commun aux deux voies : numéro à corriger, attente, ou message. */
  function showFailure(result: { error: string; code?: string; retryAfterSeconds?: number }) {
    if (result.code === "RATE_LIMITED" && result.retryAfterSeconds) {
      setResendAt(Date.now() + result.retryAfterSeconds * 1000);
      setNow(Date.now());
    }
    setNumberProblem(!!result.code && NUMBER_PROBLEMS.has(result.code));
    setNotice(result.error);
  }

  async function startMessage() {
    if (sending || busy) return;
    setSending(true);
    setNotice(null);
    let fallBack = false;
    try {
      const result = await startNumberMessage(target);
      if (result.success) {
        setMessage({
          verificationId: result.verificationId,
          code: result.code,
          link: result.link,
          to: result.to,
          expiresAt: new Date(result.expiresAt).getTime(),
        });
        setMessageExpired(false);
        setNumberProblem(false);
      } else if ("code" in result && result.code === "ALREADY_VERIFIED") {
        markVerified(undefined);
      } else if ("code" in result && result.code === "UNAVAILABLE") {
        // Message non configuré : le code reçu prend le relais.
        setMessageAvailable(false);
        setMethod("code");
        fallBack = true;
      } else {
        showFailure(result);
      }
    } catch {
      setNotice("La connexion a été interrompue. Réessayez.");
    } finally {
      setSending(false);
    }
    if (fallBack) await sendCode(true);
  }

  async function sendCode(force = false) {
    if (!force && (sending || busy)) return;
    codeRequested.current = true;
    setSending(true);
    setNotice(null);
    try {
      const result = await sendNumberCode(target);
      if (result.success) {
        setCodeId(result.verificationId);
        setResendAt(new Date(result.resendAt).getTime());
        setNow(Date.now());
        form.reset({ code: "" });
        form.setFocus("code");
        toast.success("Code envoyé sur WhatsApp.");
        return;
      }
      if ("code" in result && result.code === "ALREADY_VERIFIED")
        return markVerified(undefined);
      showFailure(result);
    } catch {
      setNotice("La connexion a été interrompue. Réessayez.");
    } finally {
      setSending(false);
    }
  }

  function chooseCode() {
    setMethod("code");
    setNotice(null);
    if (!codeRequested.current) void sendCode();
  }

  function chooseMessage() {
    setMethod("message");
    setNotice(null);
    if (!message || messageExpired) void startMessage();
  }

  // Le code à envoyer est préparé dès l’arrivée sur l’étape, une seule fois.
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void startMessage();
    // Préparation initiale uniquement : les suivantes passent par les boutons.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pendant que le client envoie son message, la page vérifie s’il est arrivé.
  const checkMessage = useEffectEvent(async (verificationId: string) => {
    if (verified || document.visibilityState === "hidden") return;
    try {
      const result = await checkNumberMessage({ verificationId });
      if (!result.success) return;
      if (result.status === "verified") markVerified(verificationId);
      else if (result.status === "expired") setMessageExpired(true);
    } catch {
      // Réseau coupé : nouvel essai au prochain tour.
    }
  });
  const waitingId =
    method === "message" && message && !messageExpired && !verified
      ? message.verificationId
      : null;
  useEffect(() => {
    if (!waitingId) return;
    const check = () => void checkMessage(waitingId);
    const timer = window.setInterval(check, POLL_MS);
    // Retour depuis WhatsApp : lecture immédiate, sans attendre le minuteur.
    const onReturn = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [waitingId]);

  async function onSubmit(values: CodeValues) {
    if (!codeId) return;
    setNotice(null);
    try {
      const result = await confirmNumberCode({ verificationId: codeId, code: values.code });
      if (result.success) {
        setVerified(true);
        setProofId(result.verificationId);
        await proceed(result.verificationId);
        return;
      }
      if (
        "code" in result &&
        (result.code === "WRONG_CODE" ||
          result.code === "EXPIRED" ||
          result.code === "TOO_MANY_ATTEMPTS")
      ) {
        form.setError("code", { type: "server", message: result.error });
        if (result.code !== "WRONG_CODE") form.setValue("code", "");
        form.setFocus("code");
        return;
      }
      setNotice(result.error);
    } catch {
      setNotice("La connexion a été interrompue. Réessayez.");
    }
  }

  const noticeAlert = notice && (
    <Alert variant="destructive">
      <CircleAlert aria-hidden />
      <AlertDescription>{notice}</AlertDescription>
    </Alert>
  );
  const numberLabel = (
    <span className="font-medium whitespace-nowrap text-foreground tabular-nums">
      {number}
    </span>
  );
  const switchLink = (label: string, onClick: () => void) => (
    <div className="flex justify-center">
      <Button
        type="button"
        variant="link"
        className="h-auto min-h-10 px-1 text-muted-foreground"
        disabled={busy || sending}
        onClick={onClick}
      >
        {label}
      </Button>
    </div>
  );

  return (
    <section aria-labelledby={titleId} className={cn("space-y-6", className)}>
      <div className="space-y-2">
        <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ShieldCheck aria-hidden className="size-5" />
        </span>
        <Heading
          id={titleId}
          className="text-xl! font-semibold! leading-tight! tracking-tight!"
        >
          Vérifiez votre numéro WhatsApp
        </Heading>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {verified ? (
            <>Numéro vérifié : {numberLabel}</>
          ) : method === "message" ? (
            <>Envoyez votre code depuis le WhatsApp du {numberLabel} : c’est la preuve qu’il vous appartient.</>
          ) : (
            <>
              {codeId
                ? "Code à 6 chiffres envoyé sur WhatsApp au"
                : "Nous envoyons un code à 6 chiffres sur WhatsApp au"}{" "}
              {numberLabel}.
            </>
          )}
        </p>
        {onEditNumber && (
          <Button
            type="button"
            variant={numberProblem ? "outline" : "link"}
            size={numberProblem ? "default" : "sm"}
            className={cn(!numberProblem && "h-auto min-h-10 px-0")}
            disabled={busy}
            onClick={onEditNumber}
          >
            Modifier le numéro
          </Button>
        )}
      </div>

      {trialUsed ? (
        <div className="space-y-4">
          <Alert role="status">
            <Info aria-hidden />
            <AlertTitle>Essai déjà utilisé pour ce numéro</AlertTitle>
            <AlertDescription>
              Votre numéro est vérifié, mais il a déjà bénéficié de l’essai
              gratuit. Le premier mois sera prélevé dès la validation du paiement.
            </AlertDescription>
          </Alert>
          {noticeAlert}
          <Button
            size="lg"
            className="h-11 w-full"
            disabled={busy}
            onClick={() => void proceed(proofId, true)}
          >
            {busy && <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />}
            {leaving ? "Ouverture du paiement…" : "Payer sans essai"}
          </Button>
        </div>
      ) : verified ? (
        <div className="space-y-4">
          <p role="status" className="flex items-center gap-2 text-sm font-medium">
            <CircleCheck aria-hidden className="size-4 text-primary" />
            Ce numéro vous appartient bien.
          </p>
          {noticeAlert}
          <Button
            size="lg"
            className="h-11 w-full"
            disabled={busy}
            onClick={() => void proceed(proofId)}
          >
            {busy && <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />}
            {busy ? "Ouverture du paiement…" : "Continuer vers le paiement"}
          </Button>
        </div>
      ) : method === "message" ? (
        <div className="space-y-4">
          {message && !messageExpired ? (
            <>
              <div className="rounded-xl border bg-muted/40 p-4 text-center">
                <p className="text-xs text-muted-foreground">Votre code</p>
                <p className="mt-1 font-mono text-2xl font-semibold tracking-[0.3em] tabular-nums">
                  {message.code}
                </p>
              </div>
              <Button asChild size="lg" className="h-11 w-full">
                <a href={message.link} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon aria-hidden className="size-4" />
                  Envoyer le code sur WhatsApp
                </a>
              </Button>
              <p className="text-xs leading-5 text-muted-foreground">
                WhatsApp s’ouvre avec le message déjà écrit pour ExtravertyAI (
                <span className="whitespace-nowrap tabular-nums">{message.to}</span>
                ) : appuyez sur Envoyer, puis revenez ici. La page continue toute
                seule.
              </p>
              <figure className="hidden items-center gap-4 rounded-xl border p-4 sm:flex">
                {/* Fond clair dans les deux thèmes : les appareils photo lisent mieux le code. */}
                <div className="shrink-0 rounded-lg bg-background p-2 text-foreground dark:bg-foreground dark:text-background">
                  <QRCodeSVG
                    value={message.link}
                    level="M"
                    bgColor="transparent"
                    fgColor="currentColor"
                    role="img"
                    aria-label="QR code ouvrant WhatsApp avec le message de vérification"
                    className="size-28"
                  />
                </div>
                <figcaption className="text-xs leading-5 text-muted-foreground">
                  Sur ordinateur, scannez ce QR code avec le téléphone du{" "}
                  {numberLabel} : WhatsApp s’ouvre avec le message prêt à
                  envoyer.
                </figcaption>
              </figure>
              <p
                role="status"
                className="flex items-center justify-center gap-2 text-sm text-muted-foreground"
              >
                <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
                En attente de votre message…
              </p>
            </>
          ) : (
            <div className="space-y-4">
              {messageExpired && !notice && (
                <p role="status" className="text-sm text-muted-foreground">
                  Ce code a expiré. Obtenez-en un nouveau pour continuer.
                </p>
              )}
              <Button
                size="lg"
                variant={message ? "default" : "outline"}
                className="h-11 w-full"
                disabled={sending || busy || numberProblem}
                onClick={() => void startMessage()}
              >
                {sending && <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />}
                {sending ? "Préparation du code…" : "Obtenir un nouveau code"}
              </Button>
            </div>
          )}
          {noticeAlert}
          {switchLink("Je préfère recevoir un code", chooseCode)}
        </div>
      ) : (
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            name="code"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${titleId}-code`}>Code de vérification</FieldLabel>
                <Input
                  {...field}
                  id={`${titleId}-code`}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="000000"
                  disabled={busy || !codeId}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={`${titleId}-help`}
                  onChange={(event) => {
                    // Collage accepté avec espaces ou tirets : seuls les chiffres comptent.
                    const digits = event.target.value.replace(/\D/g, "").slice(0, 6);
                    field.onChange(digits);
                    if (fieldState.error) form.clearErrors("code");
                    if (digits.length === 6 && !verifying) void form.handleSubmit(onSubmit)();
                  }}
                  className="h-12 text-center font-mono text-xl tracking-[0.5em] tabular-nums placeholder:tracking-[0.5em]"
                />
                <FieldDescription id={`${titleId}-help`}>
                  Le code arrive dans WhatsApp, envoyé par ExtravertyAI. Il expire au
                  bout de 10 minutes. Ne le communiquez à personne.
                </FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          {noticeAlert}

          <Button
            type="submit"
            size="lg"
            className="h-11 w-full"
            disabled={busy || !codeId}
          >
            {busy && <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />}
            {busy ? "Vérification…" : "Vérifier et continuer vers le paiement"}
          </Button>

          <div className="flex justify-center">
            <Button
              type="button"
              variant="link"
              className="h-auto min-h-10 px-1"
              disabled={sending || busy || wait > 0 || numberProblem}
              onClick={() => void sendCode()}
            >
              {sending && <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />}
              {wait > 0
                ? `Renvoyer dans ${wait} s`
                : codeId
                  ? "Renvoyer le code"
                  : "Envoyer le code"}
            </Button>
          </div>
          {messageAvailable && switchLink("Envoyer plutôt un message WhatsApp", chooseMessage)}
        </form>
      )}

      <p className="text-center text-xs leading-5 text-muted-foreground">
        Cette vérification prouve que le numéro vous appartient : l’essai gratuit
        est accordé une seule fois par numéro.
      </p>
    </section>
  );
}
