"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, Loader } from "lucide-react";
import { useState } from "react";
import { useHaptics } from "@/lib/webHaptics";

const formSchema = z.object({
  password: z
    .string()
    .min(8, "La mot de passe doit contenir au moins 8 caractères.")
    .max(10, "La mot de passe doit contenir au maximum 10 caractères."),
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
  }
  return (
    <div className="w-screen min-h-screen flex flex-col items-center justify-center p-2">
      <h1>Changer de mot de passe</h1>
      <Card className="w-full mt-2 md:max-w-prose">
        <CardHeader>
          <CardTitle>Reinitialiser votre mot de passe</CardTitle>
          <CardDescription>
            Entrer votre nouveau mot de passe pour recevoir pour le mettre à
            jour.
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                    <div className="relative">
                      <Input
                        {...field}
                        id={field.name}
                        aria-invalid={fieldState.invalid}
                        placeholder="Entrer votre nouveau mot de passe"
                        autoComplete="off"
                        type={showPassword ? "text" : "password"}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2 top-0 rounded-md p-0 data-[state=open]:bg-transparent"
                        type="button"
                      >
                        {showPassword ? (
                          <Eye className="h-4 w-4" />
                        ) : (
                          <EyeOff className="h-4 w-4" />
                        )}
                      </Button>
                    </div>

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
                    <Link title="s'identifier" href="sign-up">
                      S{`'`}incrire
                    </Link>
                  </FieldDescription>
                </Field>
              </FieldGroup>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
