"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { useRouter } from "next/navigation";

// --- Tes composants UI ---
import { Button } from "@/components/ui/button";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";

// --- Logique & Auth ---
// IMPORT TON CLIENT BETTER AUTH ICI (Exemple générique)
import { authClient } from "@/lib/auth-client";
import {
  AtSignIcon,
  Eye,
  EyeOff,
  KeySquareIcon,
  Loader2,
  User,
} from "lucide-react";
import { consumeInvitation } from "@/app/actions/invite";

import Link from "next/link";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import { useHaptics } from "@/lib/webHaptics";

// Schéma de validation pro (Email est ignoré car en lecture seule)
const formSchema = z.object({
  name: z
    .string()
    .min(2, "Votre nom doit contenir au moins 2 caractères.")
    .max(50, "Votre nom est trop long."),
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
    .regex(/[a-z]/, "Doit contenir au moins une lettre minuscule.")
    .regex(/[0-9]/, "Doit contenir au moins un chiffre."),
});

interface InviteFormProps {
  email: string;
  token: string;
  projectName: string;
  inviterName: string;
}

export function InviteForm({
  email,
  token,
  projectName,
  inviterName,
}: InviteFormProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const { playHaptic } = useHaptics();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      password: "",
    },
  });

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true);

    try {
      // 1. Création du compte via Better Auth
      const { error: signUpError } = await authClient.signUp.email({
        email: email,
        password: data.password,
        name: data.name,
      });

      if (signUpError) {
        throw new Error(
          signUpError.message || "Erreur lors de la création du compte.",
        );
      }

      // 2. Valider l'invitation et lier l'utilisateur au projet
      const result = await consumeInvitation(token);

      if (!result.success) {
        throw new Error(result.error);
      }
      playHaptic("success");
      toast.success("Compte créé avec succès !", {
        description: result.message,
        position: "top-center",
      });

      // 3. Redirection vers le projet
      router.push(`/projects/${result.projectId}`);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Une erreur est survenue.";
      playHaptic("error");
      toast.error("Une erreur est survenue", {
        description: message,
        position: "top-center",
      });
      setIsLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Invitation à collaborer
        </p>
        <h1 className="text-3xl md:text-4xl">Votre équipe vous attend.</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">{inviterName}</span>{" "}
          vous invite à rejoindre{" "}
          <span className="font-medium text-foreground break-words">
            {projectName}
          </span>
          .
        </p>
        <p className="text-sm text-muted-foreground">
          Créez votre compte pour accéder au projet.
        </p>
      </header>
      <form
        id="invite-form"
        noValidate
        aria-busy={isLoading}
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FieldGroup>
          {/* EMAIL (Disabled / Read-only) */}
          <Field>
            <FieldLabel htmlFor="invite-email">
              Adresse email invitée
            </FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="invite-email"
                aria-invalid={false}
                value={email}
                readOnly
                type="email"
                autoComplete="email"
                className="bg-muted text-muted-foreground"
              />
              <InputGroupAddon align="inline-start">
                <AtSignIcon />
              </InputGroupAddon>
            </InputGroup>
          </Field>

          {/* NOM COMPLET */}
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="invite-name">Nom complet</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    {...field}
                    id="invite-name"
                    aria-describedby={
                      fieldState.invalid ? "invite-name-error" : undefined
                    }
                    aria-invalid={fieldState.invalid}
                    placeholder="Jean Dupont"
                    disabled={isLoading}
                    autoComplete="name"
                  />
                  <InputGroupAddon align="inline-start">
                    <User />
                  </InputGroupAddon>
                </InputGroup>
                {fieldState.invalid && (
                  <FieldError
                    id="invite-name-error"
                    errors={[fieldState.error]}
                  />
                )}
              </Field>
            )}
          />

          {/* MOT DE PASSE */}
          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor="invite-password">Mot de passe</FieldLabel>

                <InputGroup>
                  <InputGroupInput
                    {...field}
                    id="invite-password"
                    aria-describedby={
                      fieldState.invalid
                        ? "invite-password-help invite-password-error"
                        : "invite-password-help"
                    }
                    aria-invalid={fieldState.invalid}
                    placeholder="••••••••"
                    disabled={isLoading}
                    autoComplete="new-password"
                    type={showPassword ? "text" : "password"}
                  />
                  <InputGroupAddon align="inline-start">
                    <KeySquareIcon />
                  </InputGroupAddon>
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      variant="ghost"
                      size="icon-sm"
                      aria-label={
                        showPassword
                          ? "Masquer le mot de passe"
                          : "Afficher le mot de passe"
                      }
                      aria-pressed={showPassword}
                      disabled={isLoading}
                      onClick={() => setShowPassword(!showPassword)}
                      type="button"
                    >
                      {showPassword ? <Eye /> : <EyeOff />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <FieldDescription id="invite-password-help">
                  Au moins 8 caractères, une minuscule et un chiffre.
                </FieldDescription>
                {fieldState.invalid && (
                  <FieldError
                    id="invite-password-error"
                    errors={[fieldState.error]}
                  />
                )}
              </Field>
            )}
          />
        </FieldGroup>
      </form>

      <div className="space-y-4">
        <Button
          type="submit"
          form="invite-form"
          size="lg"
          className="w-full"
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <Loader2 className="animate-spin" aria-hidden="true" />
              Création du compte...
            </>
          ) : (
            "Créer mon compte et rejoindre"
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Déjà un compte ?{" "}
          <Link
            className="font-medium text-foreground underline underline-offset-4"
            href={
              "/sign-in?callbackUrl=" +
              encodeURIComponent("/invite?token=" + token)
            }
          >
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
