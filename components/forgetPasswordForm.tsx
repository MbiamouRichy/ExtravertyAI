"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { DecorIcon } from "@/components/decor-icon";

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
  InputGroupInput,
} from "@/components/ui/input-group";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { AtSignIcon, Loader } from "lucide-react";
import { useState } from "react";
import { useHaptics } from "@/lib/webHaptics";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  email: z.string().email("Entrer une addresse email."),
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
    await authClient.requestPasswordReset(
      {
        email: data.email as string,
        redirectTo: "/reset-password",
      },
      {
        onSuccess: () => {
          playHaptic("success");
          toast.success("Email de réinitialisation envoyé.", {
            description: (
              <p className="text-muted-foreground text-sm">
                Vérifiez votre boîte de réception e-mail pour les instructions
                de réinitialisation.
              </p>
            ),
            position: "top-center",
          });
          router.push(`/verify?email=${data.email}`);
        },
        onError: (error) => {
          playHaptic("error");
          toast.error("Une erreur s'est produite.", {
            description: (
              <p className="text-muted-foreground text-sm">
                {error.error.message === "User not found"
                  ? "Aucun compte trouvé avec cette adresse e-mail."
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
            <h1 className="font-bold text-2xl tracking-wide">Reinitialiser le mot de passe</h1>
            <p className="text-base text-muted-foreground">
              Entrez votre adresse e-mail pour recevoir les instructions de réinitialisation.
            </p>
          </div>
          <div className="space-y-4">
            <form id="form-rhf-demo" onSubmit={form.handleSubmit(onSubmit)}>
              <FieldGroup>
                <Controller
                  name="email"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                      <InputGroup>
                        <InputGroupInput
                          type="email"
                          {...field}
                          id={field.name}
                          aria-invalid={fieldState.invalid}
                          placeholder="votre.email@example.com"
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

                <FieldGroup>
                  <Field>
                    <Button disabled={loading} type="submit" id="form-rhf-demo">
                      {loading ? <Loader className="animate-spin" /> : null}
                      Réinitialiser le mot de passe
                    </Button>

                    <FieldDescription className="px-6 text-center">
                      Je n{`'`}ai pas de compte?{" "}
                      <Link title="s'identifier" href="/sign-up">
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
