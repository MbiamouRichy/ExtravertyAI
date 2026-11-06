"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Button } from "@/components/ui/button";

import {
  Field,
  FieldDescription,
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
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, KeySquareIcon, Loader } from "lucide-react";
import { useState } from "react";
import { useHaptics } from "@/lib/webHaptics";
import { AuthSimpleShell } from "@/components/auth/auth-simple-shell";

const formSchema = z.object({
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
    .max(256, "Le mot de passe doit contenir au maximum 256 caractères."),
});

export default function ResetPassword() {
  return (
    <React.Suspense
      fallback={
        <p role="status" className="p-8 text-center text-sm text-muted-foreground">
          Chargement…
        </p>
      }
    >
      <ResetPasswordForm />
    </React.Suspense>
  );
}

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") as string;
  const { playHaptic } = useHaptics();
  const [loading, setLoading] = useState<boolean>(false);
  const [showPassword, setShowPassword] = useState(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      password: "",
    },
  });
  async function onSubmit(data: z.infer<typeof formSchema>) {
    setLoading(true);
    try {
      await authClient.resetPassword(
        {
          newPassword: data.password as string,
          token: token,
        },
        {
          onSuccess: () => {
            playHaptic("success");

            toast.success("Mot de passe réinitialisé avec succès.", {
              description: (
                <p className="text-muted-foreground text-sm">
                  Votre mot de passe a été mis à jour. Vous pouvez maintenant
                  vous connecter avec votre nouveau mot de passe.
                </p>
              ),
              position: "top-center",
            });
            router.push("/sign-in");
          },
          onError: (error) => {
            playHaptic("error");
            toast.error("Une erreur s'est produite.", {
              description: (
                <p className="text-muted-foreground text-sm">
                  {error.error.message ===
                  "[body.token] Invalid input: expected string, received null"
                    ? "Le token de réinitialisation est invalide ou a expiré."
                    : "Une erreur inconnue s'est produite."}
                </p>
              ),
              position: "top-center",
              className: "text-muted-foreground text-sm bg-card",
              action: {
                label: "Réessayer",
                onClick: () => {
                  onSubmit(data);
                },
              },
            });
          },
        },
      );
      setLoading(false);
    } catch (error) {
      console.error("Erreur de réinitialisation du mot de passe:", error);
      playHaptic("error");
      toast.error("Une erreur s'est produite.", {
        description: "Quelque chose s'est mal passé. Veuillez réessayer.",
        position: "top-center",
        className: "text-muted-foreground text-sm bg-card",
        action: {
          label: "Réessayer",
          onClick: () => {
            onSubmit(data);
          },
        },
      });
    } finally {
      setLoading(false);
    }
  }
  return (
    <AuthSimpleShell
      title="Nouveau mot de passe"
      description="Choisissez un nouveau mot de passe pour sécuriser votre compte."
      footer={
          <>
            Pas encore de compte ?{" "}
            <Link
              className="font-medium text-foreground underline underline-offset-4"
              href="/sign-up"
            >
              S’inscrire
            </Link>
          </>
        }
    >
      <form noValidate aria-busy={loading} onSubmit={form.handleSubmit(onSubmit)}>
        <FieldGroup className="gap-5">
          <Controller
            name="password"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>
                  Nouveau mot de passe
                </FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={`${field.name}-description`}
                    disabled={loading}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    type={showPassword ? "text" : "password"}
                  />
                  <InputGroupAddon align="inline-start">
                    <KeySquareIcon />
                  </InputGroupAddon>
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      variant="ghost"
                      size="icon-xs"
                      aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword(!showPassword)}
                      type="button"
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                {fieldState.invalid ? (
                  <FieldError errors={[fieldState.error]} />
                ) : (
                  <FieldDescription id={`${field.name}-description`}>
                    8 caractères minimum.
                  </FieldDescription>
                )}
              </Field>
            )}
          />

          <Button disabled={loading} type="submit" size="lg" className="w-full">
            {loading && <Loader className="animate-spin" aria-hidden="true" />}
            {loading ? "Enregistrement…" : "Changer le mot de passe"}
          </Button>
        </FieldGroup>
      </form>
    </AuthSimpleShell>
  );
}
