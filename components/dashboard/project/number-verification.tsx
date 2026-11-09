"use client";

import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";
import { CircleAlert, CircleCheck, Info, Loader2 } from "lucide-react";

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
};

/**
 * Preuve que le numéro appartient à l’utilisateur, avant d’enregistrer le
 * projet ou d’ouvrir le paiement.
 *
 * Par défaut, il envoie lui-même un code depuis son WhatsApp au numéro
 * d’ExtravertyAI (un appui sur « Envoyer ») ; la page avance seule dès que le
 * message arrive. En secours, il reçoit un code et le recopie.
 * Chaque état ne propose qu’une action principale. Le serveur revérifie tout ;
 * ce composant ne fait que guider.
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

  // Le champ n’apparaît qu’avec un code envoyé : il prend alors le focus.
  useEffect(() => {
    if (codeId) form.setFocus("code");
  }, [codeId, form]);

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
    const resend = !!codeId;
    setSending(true);
    setNotice(null);
    try {
      const result = await sendNumberCode(target);
      if (result.success) {
        setCodeId(result.verificationId);
        setResendAt(new Date(result.resendAt).getTime());
        setNow(Date.now());
        form.reset({ code: "" });
        // Le premier envoi se voit (le champ apparaît) ; un renvoi, non.
        if (resend) toast.success("Nouveau code envoyé sur WhatsApp.");
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

  const spinner = (
    <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />
  );
  const mainButton = "h-11 w-full";
  const quietLink = "h-auto min-h-10 px-1 text-muted-foreground hover:text-foreground";

  const noticeAlert = notice && (
    <Alert variant="destructive">
      <CircleAlert aria-hidden />
      <AlertDescription>{notice}</AlertDescription>
    </Alert>
  );

  /** Attente discrète : préparation, envoi, ou arrivée du message. */
  const waitingLine = (label: string) => (
    <p
      role="status"
      className="flex min-h-11 items-center justify-center gap-2 text-sm text-muted-foreground"
    >
      <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
      {label}
    </p>
  );

  /** Après un échec, une seule issue : corriger le numéro, ou réessayer. */
  const recovery = (retry: () => void) =>
    numberProblem ? (
      onEditNumber && (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className={mainButton}
          disabled={busy}
          onClick={onEditNumber}
        >
          Modifier le numéro
        </Button>
      )
    ) : (
      <Button
        type="button"
        variant="outline"
        size="lg"
        className={mainButton}
        disabled={sending || busy || wait > 0}
        onClick={retry}
      >
        {sending && spinner}
        {wait > 0 ? `Réessayer dans ${wait} s` : "Réessayer"}
      </Button>
    );

  const otherWay = (label: string, onClick: () => void) => (
    <Button
      type="button"
      variant="link"
      className={quietLink}
      disabled={busy || sending}
      onClick={onClick}
    >
      {label}
    </Button>
  );

  return (
    <section aria-labelledby={titleId} className={cn("space-y-6", className)}>
      <div className="space-y-1">
        <Heading
          id={titleId}
          className={cn(
            "font-semibold! leading-tight! tracking-tight!",
            headingLevel === "h1" ? "text-2xl! sm:text-3xl!" : "text-xl!",
          )}
        >
          Vérifiez votre numéro
        </Heading>
        <div className="flex min-h-10 flex-wrap items-center gap-x-2">
          <span className="font-medium whitespace-nowrap tabular-nums">{number}</span>
          {onEditNumber && !verified && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto min-h-10 px-1"
              aria-label={`Modifier le numéro ${number}`}
              disabled={busy}
              onClick={onEditNumber}
            >
              Modifier
            </Button>
          )}
        </div>
      </div>

      {trialUsed ? (
        <div className="space-y-4">
          <Alert role="status">
            <Info aria-hidden />
            <AlertTitle>Essai déjà utilisé par ce numéro</AlertTitle>
            <AlertDescription>
              Le premier mois sera prélevé à la validation du paiement.
            </AlertDescription>
          </Alert>
          {noticeAlert}
          <Button
            size="lg"
            className={mainButton}
            disabled={busy}
            onClick={() => void proceed(proofId, true)}
          >
            {busy && spinner}
            {leaving ? "Ouverture du paiement…" : "Payer sans essai"}
          </Button>
        </div>
      ) : verified ? (
        <div className="space-y-4">
          <p role="status" className="flex items-center gap-2 text-sm font-medium">
            <CircleCheck aria-hidden className="size-4 text-primary" />
            Numéro vérifié
          </p>
          {noticeAlert}
          <Button
            size="lg"
            className={mainButton}
            disabled={busy}
            onClick={() => void proceed(proofId)}
          >
            {busy && spinner}
            {busy ? "Ouverture du paiement…" : "Continuer vers le paiement"}
          </Button>
        </div>
      ) : method === "message" ? (
        <div className="space-y-4">
          {message && !messageExpired ? (
            <>
              <p className="text-sm leading-6 text-muted-foreground">
                Envoyez le code{" "}
                <strong className="font-mono font-semibold tracking-wider text-foreground tabular-nums">
                  {message.code}
                </strong>{" "}
                depuis ce numéro. La page avancera toute seule.
              </p>
              {/* Sur ordinateur : le téléphone du numéro scanne, WhatsApp s’ouvre avec le message prêt. */}
              <figure className="hidden flex-col items-center gap-3 rounded-xl border p-5 sm:flex">
                {/* Fond clair dans les deux thèmes : les appareils photo lisent mieux le code. */}
                <div className="rounded-lg bg-background p-2 text-foreground dark:bg-foreground dark:text-background">
                  <QRCodeSVG
                    value={message.link}
                    level="M"
                    bgColor="transparent"
                    fgColor="currentColor"
                    role="img"
                    aria-label="QR code ouvrant WhatsApp avec le message de vérification"
                    className="size-36"
                  />
                </div>
                <figcaption className="text-xs text-muted-foreground">
                  Scannez avec votre téléphone
                </figcaption>
              </figure>
              <Button asChild size="lg" className={mainButton}>
                <a href={message.link} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon aria-hidden className="size-4" />
                  Envoyer sur WhatsApp
                </a>
              </Button>
              {waitingLine("En attente de votre message…")}
            </>
          ) : notice ? (
            <>
              {noticeAlert}
              {recovery(() => void startMessage())}
            </>
          ) : messageExpired ? (
            <>
              <p role="status" className="text-sm text-muted-foreground">
                Ce code a expiré.
              </p>
              <Button
                size="lg"
                className={mainButton}
                disabled={sending || busy}
                onClick={() => void startMessage()}
              >
                {sending && spinner}
                Nouveau code
              </Button>
            </>
          ) : (
            waitingLine("Préparation du code…")
          )}
          <div className="flex justify-center">
            {otherWay("Recevoir un code à la place", chooseCode)}
          </div>
        </div>
      ) : codeId ? (
        <form noValidate onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            name="code"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={`${titleId}-code`}>Code reçu sur WhatsApp</FieldLabel>
                <Input
                  {...field}
                  id={`${titleId}-code`}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="000000"
                  disabled={busy}
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
                  Ne le communiquez à personne.
                </FieldDescription>
                {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
              </Field>
            )}
          />

          {noticeAlert}

          <Button type="submit" size="lg" className={mainButton} disabled={busy}>
            {busy && spinner}
            {busy ? "Vérification…" : "Vérifier"}
          </Button>

          <div className="flex flex-wrap items-center justify-center gap-x-4">
            <Button
              type="button"
              variant="link"
              className={quietLink}
              disabled={sending || busy || wait > 0 || numberProblem}
              onClick={() => void sendCode()}
            >
              {sending && spinner}
              {wait > 0 ? `Renvoyer dans ${wait} s` : "Renvoyer le code"}
            </Button>
            {messageAvailable && otherWay("Envoyer un message à la place", chooseMessage)}
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          {notice ? (
            <>
              {noticeAlert}
              {recovery(() => void sendCode())}
            </>
          ) : (
            waitingLine("Envoi du code…")
          )}
          {messageAvailable && (
            <div className="flex justify-center">
              {otherWay("Envoyer un message à la place", chooseMessage)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
