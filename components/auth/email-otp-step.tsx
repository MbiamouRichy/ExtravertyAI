"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { Eye, EyeOff, KeySquareIcon, Loader, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { emailOtp, signIn } from "@/lib/auth-client";
import {
  accountPasswordSchema,
  SIGN_UP_INTENT,
  SIGN_UP_INTENT_HEADER,
} from "@/lib/sign-up";
import { useHaptics } from "@/lib/webHaptics";

const CODE_LENGTH = 6;
// The server sends a code right before this step and rate limits resends.
const RESEND_DELAY_SECONDS = 60;

export type CodePurpose = "email-verification" | "sign-in" | "sign-up";

const COPY: Record<
  CodePurpose,
  {
    title: string;
    label: string;
    hint: string;
    submit: string;
    pending: string;
    success: string;
  }
> = {
  "email-verification": {
    title: "Vérifiez votre e-mail",
    label: "Code de vérification",
    hint: "Rien reçu ? Regardez dans vos courriers indésirables.",
    submit: "Confirmer mon adresse",
    pending: "Vérification…",
    success: "Adresse e-mail confirmée.",
  },
  "sign-in": {
    title: "Consultez votre boîte mail",
    label: "Code de connexion",
    hint: "Rien reçu ? Vérifiez l’adresse et vos courriers indésirables.",
    submit: "Se connecter",
    pending: "Connexion…",
    success: "Connexion réussie.",
  },
  "sign-up": {
    title: "Vérifiez votre e-mail",
    label: "Code de vérification",
    hint: "Rien reçu ? Regardez dans vos courriers indésirables.",
    submit: "Créer mon compte",
    pending: "Création du compte…",
    success: "Bienvenue sur ExtravertyAI.",
  },
};

const formSchema = z
  .object({
    otp: z
      .string()
      .regex(/^\d{6}$/, `Saisissez les ${CODE_LENGTH} chiffres du code.`),
    withPassword: z.boolean(),
    password: z.string(),
  })
  .superRefine((values, ctx) => {
    if (!values.withPassword) return;
    const password = accountPasswordSchema.safeParse(values.password);
    if (!password.success)
      ctx.addIssue({
        code: "custom",
        path: ["password"],
        message: password.error.issues[0]?.message,
      });
  });

type FormValues = z.infer<typeof formSchema>;

function errorMessage(error: { code?: string; status?: number }) {
  if (error.code === "TOO_MANY_CODES")
    return "Trop de codes demandés pour cette adresse. Réessayez dans une heure.";
  if (error.status === 429)
    return "Trop de tentatives. Patientez une minute avant de réessayer.";
  switch (error.code) {
    case "OTP_EXPIRED":
      return "Ce code a expiré. Demandez-en un nouveau.";
    case "TOO_MANY_ATTEMPTS":
      return "Trop d’essais avec ce code. Demandez-en un nouveau.";
    case "INVALID_OTP":
      return "Code incorrect. Vérifiez les chiffres et réessayez.";
    case "SIGN_UP_NAME_REQUIRED":
      return "Revenez à l’étape précédente pour indiquer votre nom.";
    default:
      return "Impossible de vérifier ce code. Réessayez dans un instant.";
  }
}

const signUpFetch = { headers: { [SIGN_UP_INTENT_HEADER]: SIGN_UP_INTENT } };

/**
 * Checks the one-time code Better Auth just emailed: it confirms the address,
 * signs in without a password, or creates the account (sign-up). Whatever the
 * purpose, the session is open once the code is accepted.
 */
export function EmailOtpStep({
  email,
  name,
  onVerified,
  onChangeEmail,
  changeEmailLabel = "Modifier l’adresse",
  purpose = "email-verification",
  allowPassword = false,
}: {
  email: string;
  /** Sign-up only: the name of the account the code creates. */
  name?: string;
  /** Runs once the code is accepted and the session is open. */
  onVerified: (extra: { password?: string }) => void | Promise<void>;
  onChangeEmail?: () => void;
  changeEmailLabel?: string;
  purpose?: CodePurpose;
  /** Offers to choose a password on the same step (optional). */
  allowPassword?: boolean;
}) {
  const copy = COPY[purpose];
  const { playHaptic } = useHaptics();
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_DELAY_SECONDS);
  const [showPassword, setShowPassword] = useState(false);
  // A pasted or autofilled code submits on its own: block a second request.
  const submitting = useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { otp: "", withPassword: false, password: "" },
    // A retyped code is checked when complete, not flagged at every digit.
    reValidateMode: "onSubmit",
  });
  // UI state; the form value of the same name drives validation.
  const [withPassword, setWithPassword] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  function verify(otp: string) {
    if (purpose === "sign-up") return signIn.emailOtp({ email, otp, name });
    if (purpose === "sign-in") return signIn.emailOtp({ email, otp });
    return emailOtp.verifyEmail({ email, otp });
  }

  async function onSubmit({ otp, withPassword, password }: FormValues) {
    if (submitting.current) return;
    submitting.current = true;
    setVerifying(true);
    try {
      const { error } = await verify(otp);
      if (error) {
        playHaptic("error");
        if (error.code === "OTP_EXPIRED" || error.code === "TOO_MANY_ATTEMPTS")
          form.setValue("otp", "");
        form.setError("otp", { message: errorMessage(error) });
        // Keep the keyboard open and select the wrong code: the next digits replace it.
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }
      playHaptic("success");
      toast.success(copy.success, { position: "top-center" });
      await onVerified({ password: withPassword ? password : undefined });
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
      // A sign-up code is a sign-in code that may create the account.
      const { error } =
        purpose === "sign-up"
          ? await emailOtp.sendVerificationOtp({ email, type: "sign-in" }, signUpFetch)
          : await emailOtp.sendVerificationOtp({ email, type: purpose });
      if (error) {
        toast.error("Le code n’a pas pu être renvoyé.", {
          description: errorMessage(error),
          position: "top-center",
        });
        if (error.status === 429) setCooldown(RESEND_DELAY_SECONDS);
        return;
      }
      form.resetField("otp");
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

  function togglePassword(open: boolean) {
    setWithPassword(open);
    form.setValue("withPassword", open);
    if (!open) {
      form.resetField("password");
      setShowPassword(false);
      inputRef.current?.focus();
    }
  }

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <h1 className="text-3xl md:text-4xl">{copy.title}</h1>
      {purpose === "sign-in" ? (
        // Same words for known and unknown addresses: nothing to learn here.
        <p className="mt-2 text-sm text-muted-foreground">
          Si{" "}
          <span className="font-medium wrap-anywhere text-foreground">{email}</span>{" "}
          correspond à un compte ExtravertyAI, un code à {CODE_LENGTH} chiffres
          vient d’y être envoyé. Il expire dans 10 minutes.
        </p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">
          Saisissez le code à {CODE_LENGTH} chiffres envoyé à{" "}
          <span className="font-medium wrap-anywhere text-foreground">{email}</span>.
          Il expire dans 10 minutes.
        </p>
      )}

      <form
        noValidate
        aria-busy={verifying}
        onSubmit={(event) => void form.handleSubmit(onSubmit)(event)}
        className="mt-8"
      >
        <FieldGroup className="gap-5">
          <Controller
            name="otp"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="email-otp">{copy.label}</FieldLabel>
                <Input
                  {...field}
                  ref={(element) => {
                    field.ref(element);
                    inputRef.current = element;
                  }}
                  id="email-otp"
                  autoFocus
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={CODE_LENGTH}
                  placeholder="000000"
                  // Read-only, not disabled: a disabled field loses focus and closes
                  // the mobile keyboard while the code is checked.
                  readOnly={verifying}
                  aria-invalid={fieldState.invalid}
                  aria-describedby={
                    fieldState.invalid ? undefined : "email-otp-description"
                  }
                  className="h-12 text-center font-mono text-2xl tracking-[0.5em] tabular-nums"
                  onChange={(event) => {
                    const value = event.target.value
                      .replace(/\D/g, "")
                      .slice(0, CODE_LENGTH);
                    if (fieldState.invalid) form.clearErrors("otp");
                    field.onChange(value);
                    // With a password to type, the button submits instead.
                    if (value.length === CODE_LENGTH && !form.getValues("withPassword"))
                      void form.handleSubmit(onSubmit)();
                  }}
                />
                {fieldState.invalid ? (
                  <FieldError errors={[fieldState.error]} />
                ) : (
                  <FieldDescription id="email-otp-description">
                    {copy.hint}
                  </FieldDescription>
                )}
              </Field>
            )}
          />

          {allowPassword &&
            (withPassword ? (
              <Controller
                name="password"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field
                    data-invalid={fieldState.invalid}
                    className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1"
                  >
                    {/* Lets password managers save the pair under this address. */}
                    <input
                      type="email"
                      name="username"
                      autoComplete="username"
                      value={email}
                      readOnly
                      hidden
                    />
                    <div className="flex items-center justify-between gap-3">
                      <FieldLabel htmlFor="sign-up-password">
                        Mot de passe
                      </FieldLabel>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="text-muted-foreground"
                        disabled={verifying}
                        onClick={() => togglePassword(false)}
                      >
                        <X data-icon="inline-start" aria-hidden />
                        Retirer
                      </Button>
                    </div>
                    <InputGroup>
                      <InputGroupInput
                        {...field}
                        id="sign-up-password"
                        autoFocus
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        readOnly={verifying}
                        aria-invalid={fieldState.invalid}
                        aria-describedby="sign-up-password-help"
                      />
                      <InputGroupAddon align="inline-start">
                        <KeySquareIcon />
                      </InputGroupAddon>
                      <InputGroupAddon align="inline-end">
                        <InputGroupButton
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label={
                            showPassword
                              ? "Masquer le mot de passe"
                              : "Afficher le mot de passe"
                          }
                          aria-pressed={showPassword}
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff /> : <Eye />}
                        </InputGroupButton>
                      </InputGroupAddon>
                    </InputGroup>
                    {fieldState.invalid ? (
                      <FieldError errors={[fieldState.error]} />
                    ) : (
                      <FieldDescription id="sign-up-password-help">
                        8 caractères minimum. Vous pourrez toujours vous
                        connecter avec un code reçu par e-mail.
                      </FieldDescription>
                    )}
                  </Field>
                )}
              />
            ) : (
              <Button
                type="button"
                variant="ghost"
                className="-mt-1 w-fit px-2 text-muted-foreground"
                disabled={verifying}
                onClick={() => togglePassword(true)}
              >
                <Plus data-icon="inline-start" aria-hidden />
                Ajouter un mot de passe (facultatif)
              </Button>
            ))}

          <Button disabled={verifying} type="submit" size="lg" className="w-full">
            {verifying && <Loader className="animate-spin" aria-hidden="true" />}
            {verifying ? copy.pending : copy.submit}
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
