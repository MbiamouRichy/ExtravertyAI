"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { CircleAlert, CircleCheck, Info, Loader2, ShieldCheck } from "lucide-react";

import {
  confirmNumberCode,
  sendNumberCode,
} from "@/app/actions/phone-verification";
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

/**
 * Preuve que le numéro appartient à l’utilisateur : un code à 6 chiffres envoyé
 * par WhatsApp, avant d’enregistrer le projet ou d’ouvrir le paiement.
 * Le serveur revérifie tout ; ce composant ne fait que guider la saisie.
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
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const [sending, setSending] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [notice, setNotice] = useState<string | null>(null);
  const [numberProblem, setNumberProblem] = useState(false);
  const [trialUsed, setTrialUsed] = useState(false);
  const autoSent = useRef(false);
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
        // Preuve expirée (plus de 30 minutes) : un nouveau code est nécessaire.
        setVerified(false);
        setVerificationId(null);
        setTrialUsed(false);
        setNotice("Votre vérification a expiré. Demandez un nouveau code.");
      } else {
        setNotice(result.error);
      }
    } catch {
      setNotice("La connexion a été interrompue. Réessayez.");
    } finally {
      setContinuing(false);
    }
  }

  async function send() {
    if (sending || busy) return;
    setSending(true);
    setNotice(null);
    try {
      const result = await sendNumberCode(target);
      if (result.success) {
        setVerificationId(result.verificationId);
        setVerified(false);
        setResendAt(new Date(result.resendAt).getTime());
        setNow(Date.now());
        form.reset({ code: "" });
        form.setFocus("code");
        toast.success("Code envoyé sur WhatsApp.");
        return;
      }
      if ("code" in result) {
        // Numéro déjà prouvé (reprise d’un paiement) : on passe directement au paiement.
        if (result.code === "ALREADY_VERIFIED") {
          setVerified(true);
          return void (await proceed(undefined));
        }
        if (result.code === "RATE_LIMITED" && result.retryAfterSeconds) {
          setResendAt(Date.now() + result.retryAfterSeconds * 1000);
          setNow(Date.now());
        }
        setNumberProblem(!!result.code && NUMBER_PROBLEMS.has(result.code));
      }
      setNotice(result.error);
    } catch {
      setNotice("La connexion a été interrompue. Réessayez.");
    } finally {
      setSending(false);
    }
  }

  // Premier code envoyé dès l’arrivée sur l’étape, une seule fois.
  useEffect(() => {
    if (autoSent.current) return;
    autoSent.current = true;
    void send();
    // Envoi initial uniquement : les renvois passent par le bouton.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onSubmit(values: CodeValues) {
    if (!verificationId) return;
    setNotice(null);
    try {
      const result = await confirmNumberCode({ verificationId, code: values.code });
      if (result.success) {
        setVerified(true);
        await proceed(result.verificationId);
        return;
      }
      if ("code" in result) {
        if (
          result.code === "WRONG_CODE" ||
          result.code === "EXPIRED" ||
          result.code === "TOO_MANY_ATTEMPTS"
        ) {
          form.setError("code", { type: "server", message: result.error });
          if (result.code !== "WRONG_CODE") form.setValue("code", "");
          form.setFocus("code");
          return;
        }
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
          {verified
            ? "Numéro vérifié :"
            : verificationId
              ? "Code à 6 chiffres envoyé sur WhatsApp au"
              : "Nous envoyons un code à 6 chiffres sur WhatsApp au"}{" "}
          <span className="font-medium whitespace-nowrap text-foreground tabular-nums">
            {number}
          </span>
          {verified ? "" : "."}
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
            onClick={() => void proceed(verificationId ?? undefined, true)}
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
            onClick={() => void proceed(verificationId ?? undefined)}
          >
            {busy && <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />}
            {busy ? "Ouverture du paiement…" : "Continuer vers le paiement"}
          </Button>
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
                  disabled={busy || !verificationId}
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
                  bout de 10 minutes.
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
            disabled={busy || !verificationId}
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
              onClick={() => void send()}
            >
              {sending && <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" />}
              {wait > 0
                ? `Renvoyer dans ${wait} s`
                : verificationId
                  ? "Renvoyer le code"
                  : "Envoyer le code"}
            </Button>
          </div>
        </form>
      )}

      <p className="text-center text-xs leading-5 text-muted-foreground">
        Ce code prouve que le numéro vous appartient : l’essai gratuit est
        accordé une seule fois par numéro. Ne le communiquez à personne.
      </p>
    </section>
  );
}
