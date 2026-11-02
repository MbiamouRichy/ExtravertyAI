"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Button } from "@/components/ui/button";

import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { AtSignIcon, Loader } from "lucide-react";
import { useState } from "react";
import { useHaptics } from "@/lib/webHaptics";
import { AuthSimpleShell } from "./auth-simple-shell";
import { state } from "@/lib/proxy-state";

const formSchema = z.object({
  email: z.string().email("Entrer une adresse email valide."),
});

export default function ForgetPasswordForm() {
  const router = useRouter();
  const { playHaptic } = useHaptics();
  const [loading, setLoading] = useState<boolean>(false);
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
    },
  });
  async function onSubmit(data: z.infer<typeof formSchema>) {
    setLoading(true);

    // 1. Définition d'un comportement de succès standard et générique
    const handleSecureSuccess = () => {
      playHaptic("success");
      toast.success("Vérifiez votre boîte de réception.", {
        description: (
          <p className="text-muted-foreground text-sm">
            Si cette adresse e-mail est associée à un compte, vous recevrez un lien de réinitialisation sous peu.
          </p>
        ),
        position: "top-center",
      });

      // Redirection SANS exposer l'email dans l'URL. 
      // Si la page /verify a absolument besoin de l'email, passez-le via un State management (Zustand/Context) ou un stockage temporaire (sessionStorage).
      router.push("/verify");
    };

    try {
      await authClient.requestPasswordReset(
        {
          email: data.email, // 'as string' retiré car Zod gère déjà le typage
          redirectTo: "/reset-password",
        },
        {
          onSuccess: () => {
            state.email = data.email;
            handleSecureSuccess();
          },
          onError: (error) => {
            // 2. MITIGATION DE L'ÉNUMÉRATION D'UTILISATEURS
            // Si l'erreur est "User not found", on l'intercepte et on simule un succès.
            // L'attaquant (et l'utilisateur légitime) verra un message de succès dans tous les cas.
            if (error?.error?.message === "User not found") {
              handleSecureSuccess();
              return; // On arrête l'exécution ici
            }

            // 3. Gestion des vraies erreurs (Rate limit, serveurs inaccessibles, etc.)
            playHaptic("error");
            toast.error("Une erreur s'est produite.", {
              description: (
                <p className="text-muted-foreground text-sm">
                  Impossible de traiter votre demande pour le moment. Veuillez réessayer plus tard.
                </p>
              ),
              position: "top-center",
              className: "text-muted-foreground text-sm bg-card",
            });
          },
        }
      );
    } catch {
      // 4. Gestion des erreurs de réseau (ex: perte de wifi)
      playHaptic("error");
      toast.error("Erreur de connexion", {
        description: "Veuillez vérifier votre connexion internet et réessayer."
      });
    } finally {
      setLoading(false);
    }
  }
  return (
    <AuthSimpleShell
      title="Mot de passe oublié"
      description="Entrez votre adresse e-mail pour recevoir un lien de réinitialisation."
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
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field data-invalid={fieldState.invalid}>
                <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                <InputGroup>
                  <InputGroupInput
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    {...field}
                    id={field.name}
                    aria-invalid={fieldState.invalid}
                    disabled={loading}
                    placeholder="vous@entreprise.com"
                  />
                  <InputGroupAddon align="inline-start">
                    <AtSignIcon />
                  </InputGroupAddon>
                </InputGroup>
                {fieldState.invalid && (
                  <FieldError errors={[fieldState.error]} />
                )}
              </Field>
            )}
          />

          <Button disabled={loading} type="submit" size="lg" className="w-full">
            {loading && <Loader className="animate-spin" aria-hidden="true" />}
            {loading ? "Envoi…" : "Envoyer le lien"}
          </Button>
        </FieldGroup>
      </form>
    </AuthSimpleShell>
  );
}
