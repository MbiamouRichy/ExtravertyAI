"use client";

import { useState, type ChangeEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Controller,
  useForm,
  type ControllerFieldState,
  type RefCallBack,
} from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import {
  AtSignIcon,
  Eye,
  EyeOff,
  KeySquareIcon,
  Loader,
  MailIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { emailOtp, signIn } from "@/lib/auth-client";
import { useHaptics } from "@/lib/webHaptics";

const email = z.string().trim().email("Entrer une adresse email valide.");

const codeSchema = z.object({ email });
const passwordSchema = z.object({
  email,
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
    .max(256, "Le mot de passe doit contenir au maximum 256 caractères."),
});

type CodeValues = z.infer<typeof codeSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;

const normalize = (value: string) => value.trim().toLowerCase();

function networkError() {
  toast.error("Erreur de connexion", {
    description: "Vérifiez votre connexion internet et réessayez.",
    position: "top-center",
  });
}

// The email field of either form, whatever its other fields.
type EmailFieldProps = {
  name: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  ref: RefCallBack;
  disabled?: boolean;
};

function EmailInput({
  field,
  fieldState,
  disabled,
  autoFocus,
  autoComplete,
}: {
  field: EmailFieldProps;
  fieldState: ControllerFieldState;
  disabled: boolean;
  autoFocus?: boolean;
  autoComplete: "email" | "username";
}) {
  return (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor="sign-in-email">Email</FieldLabel>
      <InputGroup>
        <InputGroupInput
          type="email"
          inputMode="email"
          autoComplete={autoComplete}
          {...field}
          id="sign-in-email"
          autoFocus={autoFocus}
          aria-invalid={fieldState.invalid}
          disabled={disabled}
          placeholder="vous@entreprise.com"
        />
        <InputGroupAddon align="inline-start">
          <AtSignIcon />
        </InputGroupAddon>
      </InputGroup>
      {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
    </Field>
  );
}

/** Passwordless sign-in: asks for a one-time code sent to the address. */
export function CodeSignInForm({
  defaultEmail,
  autoFocus,
  onCodeSent,
  onUsePassword,
}: {
  defaultEmail: string;
  autoFocus?: boolean;
  onCodeSent: (email: string) => void;
  onUsePassword: (email: string) => void;
}) {
  const { playHaptic } = useHaptics();
  const [loading, setLoading] = useState(false);
  const form = useForm<CodeValues>({
    resolver: zodResolver(codeSchema),
    defaultValues: { email: defaultEmail },
  });

  async function onSubmit(data: CodeValues) {
    setLoading(true);
    try {
      const address = normalize(data.email);
      // Same answer for known and unknown addresses: only an existing
      // account receives the code.
      const { error } = await emailOtp.sendVerificationOtp({
        email: address,
        type: "sign-in",
      });
      if (error) {
        playHaptic("error");
        toast.error("Le code n’a pas pu être envoyé.", {
          description:
            error.code === "TOO_MANY_CODES"
              ? "Trop de codes demandés pour cette adresse. Réessayez dans une heure."
              : error.status === 429
                ? "Trop de demandes. Patientez une minute avant de réessayer."
                : "Réessayez dans un instant.",
          position: "top-center",
        });
        return;
      }
      playHaptic("success");
      onCodeSent(address);
    } catch {
      playHaptic("error");
      networkError();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form noValidate aria-busy={loading} onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup className="gap-5">
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <EmailInput
              field={field}
              fieldState={fieldState}
              disabled={loading}
              autoFocus={autoFocus}
              autoComplete="email"
            />
          )}
        />
        <div className="flex flex-col gap-2">
          <Button disabled={loading} type="submit" size="lg" className="w-full">
            {loading && <Loader className="animate-spin" aria-hidden="true" />}
            {loading ? "Envoi du code…" : "Recevoir un code"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            disabled={loading}
            onClick={() => onUsePassword(form.getValues("email"))}
          >
            <KeySquareIcon data-icon="inline-start" />
            Utiliser mon mot de passe
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

/** Email and password sign-in, kept for accounts that prefer it. */
export function PasswordSignInForm({
  defaultEmail,
  callbackUrl,
  onUnverified,
  onUseCode,
}: {
  defaultEmail: string;
  callbackUrl: string;
  /** Right password on an unconfirmed address: Better Auth just sent a code. */
  onUnverified: (email: string) => void;
  onUseCode: (email: string) => void;
}) {
  const router = useRouter();
  const { playHaptic } = useHaptics();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    mode: "onChange",
    defaultValues: { email: defaultEmail, password: "" },
  });

  async function onSubmit(data: PasswordValues) {
    setLoading(true);
    try {
      await signIn.email(
        { email: data.email, password: data.password, rememberMe: remember },
        {
          onSuccess: () => {
            playHaptic("success");
            toast.success("Connexion réussie.", { position: "top-center" });
            router.push(callbackUrl);
            form.reset();
          },
          onError: (context) => {
            // Only reachable with the right password: safe to say so.
            if (context.error.code === "EMAIL_NOT_VERIFIED") {
              onUnverified(normalize(data.email));
              return;
            }
            // Message unifié : ne révèle pas si le compte existe.
            playHaptic("error");
            toast.error("Échec de l'authentification", {
              description:
                context.error.status === 429
                  ? "Trop de tentatives. Patientez une minute avant de réessayer."
                  : "Email ou mot de passe incorrect. Veuillez réessayer.",
              position: "top-center",
            });
          },
        },
      );
    } catch {
      // Une panne réseau ne doit pas bloquer l'interface.
      playHaptic("error");
      networkError();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form noValidate aria-busy={loading} onSubmit={form.handleSubmit(onSubmit)}>
      <FieldGroup className="gap-5">
        <Controller
          name="email"
          control={form.control}
          render={({ field, fieldState }) => (
            <EmailInput
              field={field}
              fieldState={fieldState}
              disabled={loading}
              autoFocus={!defaultEmail}
              autoComplete="username"
            />
          )}
        />
        <Controller
          name="password"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <div className="flex w-full items-center justify-between gap-3">
                <FieldLabel htmlFor="sign-in-password" className="shrink-0">
                  Mot de passe
                </FieldLabel>
                {/* Short label under 360 px so both stay on one line. */}
                <Link
                  href="/forget-password"
                  aria-label="Mot de passe oublié ?"
                  className="whitespace-nowrap text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
                >
                  <span className="min-[360px]:hidden">Oublié ?</span>
                  <span className="max-[359px]:hidden">Mot de passe oublié ?</span>
                </Link>
              </div>
              <InputGroup>
                <InputGroupInput
                  {...field}
                  id="sign-in-password"
                  autoFocus={!!defaultEmail}
                  aria-invalid={fieldState.invalid}
                  disabled={loading}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  type={showPassword ? "text" : "password"}
                />
                <InputGroupAddon align="inline-start">
                  <KeySquareIcon />
                </InputGroupAddon>
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    variant="ghost"
                    size="icon-xs"
                    aria-label={
                      showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                    type="button"
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
              {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
            </Field>
          )}
        />

        <Field orientation="horizontal">
          <Checkbox
            id="remember-me"
            checked={remember}
            disabled={loading}
            onCheckedChange={(value) => setRemember(value === true)}
          />
          <FieldLabel htmlFor="remember-me" className="font-normal">
            Se souvenir de moi
          </FieldLabel>
        </Field>

        <div className="flex flex-col gap-2">
          <Button disabled={loading} type="submit" size="lg" className="w-full">
            {loading && <Loader className="animate-spin" aria-hidden="true" />}
            {loading ? "Connexion…" : "Se connecter"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-muted-foreground"
            disabled={loading}
            onClick={() => onUseCode(form.getValues("email"))}
          >
            <MailIcon data-icon="inline-start" />
            Recevoir un code à la place
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
