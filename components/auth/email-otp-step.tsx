"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Loader } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { emailOtp } from "@/lib/auth-client";
import { useHaptics } from "@/lib/webHaptics";

const CODE_LENGTH = 6;
// The server sends a code right before this step and rate limits resends.
const RESEND_DELAY_SECONDS = 60;

const formSchema = z.object({
  otp: z
    .string()
    .regex(/^\d{6}$/, `Saisissez les ${CODE_LENGTH} chiffres du code.`),
});

type FormValues = z.infer<typeof formSchema>;

function errorMessage(error: { code?: string; status?: number }) {
  if (error.status === 429)
    return "Trop de tentatives. Patientez une minute avant de réessayer.";
  switch (error.code) {
    case "OTP_EXPIRED":
      return "Ce code a expiré. Demandez-en un nouveau.";
    case "TOO_MANY_ATTEMPTS":
      return "Trop d’essais avec ce code. Demandez-en un nouveau.";
    case "INVALID_OTP":
      return "Code incorrect. Vérifiez les chiffres et réessayez.";
    default:
      return "Impossible de vérifier ce code. Réessayez dans un instant.";
  }
}

/** Confirms an address with the one-time code Better Auth just emailed to it. */
export function EmailOtpStep({
  email,
  onVerified,
  onChangeEmail,
  changeEmailLabel = "Modifier l’adresse",
}: {
  email: string;
  /** Runs once the code is accepted and the session is open. */
  onVerified: () => void | Promise<void>;
  onChangeEmail?: () => void;
  changeEmailLabel?: string;
}) {
  const { playHaptic } = useHaptics();
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_DELAY_SECONDS);
  // A pasted or autofilled code submits on its own: block a second request.
  const submitting = useRef(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { otp: "" },
  });

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function onSubmit({ otp }: FormValues) {
    if (submitting.current) return;
    submitting.current = true;
    setVerifying(true);
    try {
      const { error } = await emailOtp.verifyEmail({ email, otp });
      if (error) {
        playHaptic("error");
        if (error.code === "OTP_EXPIRED" || error.code === "TOO_MANY_ATTEMPTS")
          form.setValue("otp", "");
        form.setError("otp", { message: errorMessage(error) }, { shouldFocus: true });
        return;
      }
      playHaptic("success");
      toast.success("Adresse e-mail confirmée.", { position: "top-center" });
      await onVerified();
    } catch {
      playHaptic("error");
      toast.error("Erreur de connexion", {
        description: "Vérifiez votre connexion internet et réessayez.",
        position: "top-center",
      });
    } finally {
      submitting.current = false;
      setVerifying(false);
    }
  }

  async function resend() {
    if (cooldown > 0 || resending) return;
    setResending(true);
    try {
      const { error } = await emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      });
      if (error) {
        toast.error("Le code n’a pas pu être renvoyé.", {
          description: errorMessage(error),
          position: "top-center",
        });
        if (error.status === 429) setCooldown(RESEND_DELAY_SECONDS);
        return;
      }
      form.reset({ otp: "" });
      setCooldown(RESEND_DELAY_SECONDS);
      toast.success("Nouveau code envoyé.", {
        description: "L’ancien code ne fonctionne plus.",
        position: "top-center",
      });
    } catch {
      toast.error("Erreur de connexion", {
        description: "Vérifiez votre connexion internet et réessayez.",
        position: "top-center",
      });
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <h1 className="text-3xl md:text-4xl">Vérifiez votre e-mail</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Saisissez le code à {CODE_LENGTH} chiffres envoyé à{" "}
        <span className="font-medium wrap-anywhere text-foreground">{email}</span>.
        Il expire dans 10 minutes.
      </p>

      <form
        noValidate
        aria-busy={verifying}
        onSubmit={form.handleSubmit(onSubmit)}
        className="mt-8"
      >
        <FieldGroup className="gap-5">
          <Controller
            name="otp"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="email-otp">Code de vérification</FieldLabel>
                <Input
                  {...field}
                  id="email-otp"
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={CODE_LENGTH}
                  placeholder="000000"
                  disabled={verifying}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid ? undefined : "email-otp-description"
                  }
                  className="h-12 text-center font-mono text-2xl tracking-[0.5em] tabular-nums"
                  onChange={(event) => {
                    const value = event.target.value
                      .replace(/\D/g, "")
                      .slice(0, CODE_LENGTH);
                    field.onChange(value);
                    if (value.length === CODE_LENGTH)
                      void form.handleSubmit(onSubmit)();
                  }}
                />
                {fieldState.invalid ? (
                  <FieldError errors={[fieldState.error]} />
                ) : (
                  <FieldDescription id="email-otp-description">
                    Rien reçu ? Regardez dans vos courriers indésirables.
                  </FieldDescription>
                )}
              </Field>
            )}
          />

          <Button disabled={verifying} type="submit" size="lg" className="w-full">
            {verifying && <Loader className="animate-spin" aria-hidden="true" />}
            {verifying ? "Vérification…" : "Confirmer mon adresse"}
          </Button>
        </FieldGroup>
      </form>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2 text-sm">
        <Button
          type="button"
          variant="link"
          className="h-auto px-0"
          disabled={cooldown > 0 || resending}
          onClick={resend}
        >
          {resending && <Loader className="animate-spin" aria-hidden="true" />}
          {cooldown > 0 ? (
            <>
              Renvoyer le code{" "}
              <span className="tabular-nums text-muted-foreground">
                ({Math.floor(cooldown / 60)}:{(cooldown % 60).toString().padStart(2, "0")})
              </span>
            </>
          ) : (
            "Renvoyer le code"
          )}
        </Button>
        {onChangeEmail && (
          <Button
            type="button"
            variant="link"
            className="h-auto px-0 text-muted-foreground"
            onClick={onChangeEmail}
          >
            {changeEmailLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
