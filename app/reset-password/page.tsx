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
import { DecorIcon } from "@/components/decor-icon";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  password: z
    .string()
    .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
    .max(15, "Le mot de passe doit contenir au maximum 15 caractères."),
});

export default function ResetPassword() {
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
   try{ await authClient.resetPassword(
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
                Votre mot de passe a été mis à jour. Vous pouvez maintenant vous
                connecter avec votre nouveau mot de passe.
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
      description:
        "Quelque chose s'est mal passé. Veuillez réessayer.",
      position: "top-center",
      className: "text-muted-foreground text-sm bg-card",
      action: {
        label: "Réessayer",
        onClick: () => {
          onSubmit(data);
        },
      },
    });
      }finally {
        setLoading(false);
      }
    }
  return (
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden px-6 md:px-8">
      <div
        className={cn(
          "relative flex w-full max-w-md flex-col justify-between p-6 md:p-8",
          "dark:bg-[radial-gradient(50%_80%_at_20%_0%,--theme(--color-foreground/.1),transparent)]"
        )}
      >
        <div className="absolute -inset-y-6 -left-px w-px bg-border" />
        <div className="absolute -inset-y-6 -right-px w-px bg-border" />
        <div className="absolute -inset-x-6 -top-px h-px bg-border" />
        <div className="absolute -inset-x-6 -bottom-px h-px bg-border" />
        <DecorIcon position="top-left" />
        <DecorIcon position="bottom-right" />
        <div className="w-full max-w-md animate-in space-y-8">
          <div className="flex flex-col space-y-1">
            <h1 className="font-bold text-2xl tracking-wide">Reinitialisation</h1>
            <p className="text-base text-muted-foreground">
              Saisissez votre nouveau mot de passe pour sécuriser l&apos;accès à votre compte.
            </p>
          </div>
          <div className="space-y-4">
            <form id="form-rhf-demo" onSubmit={form.handleSubmit(onSubmit)}>
              <FieldGroup>
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
                          placeholder="Entrez le nouveau mot de passe."
                          autoComplete="off"
                          type={showPassword ? "text" : "password"}
                        />
                        <InputGroupAddon align="inline-start">
                          <KeySquareIcon />
                        </InputGroupAddon>
                        <InputGroupAddon align="inline-end">
                          <InputGroupButton
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setShowPassword(!showPassword)}
                            type="button"
                          >
                            {showPassword ? (
                              <Eye />
                            ) : (
                              <EyeOff />
                            )}</InputGroupButton>
                        </InputGroupAddon>
                      </InputGroup>

                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />

                <FieldGroup>
                  <Field>
                    <Button disabled={loading} type="submit" id="form-rhf-demo">
                      {loading ? <Loader className="animate-spin" /> : null}
                      Changer de mot de passe
                    </Button>

                    <FieldDescription className="px-6 text-center">
                      Je n{`'`}ai pas de compte?{" "}
                      <Link title="s'inscrire" href="/sign-up">
                        S{`'`}incrire
                      </Link>
                    </FieldDescription>
                  </Field>
                </FieldGroup>
              </FieldGroup>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
