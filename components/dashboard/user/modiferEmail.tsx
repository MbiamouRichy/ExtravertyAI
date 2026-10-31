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
  InputGroupInput,
} from "@/components/ui/input-group";

import { authClient } from "@/lib/auth-client";
import {
  AtSignIcon,
  CheckCircle2,
  Loader,
} from "lucide-react";
import { useState } from "react";
import { useHaptics } from "@/lib/webHaptics";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const formEmailSchema = z.object({
  newEmail: z.string().email("Entrer une adresse email valide."),
});

export default function ChangeEmailForm({
  children,
}: {
  children: React.ReactNode;
}) {
  const { playHaptic } = useHaptics();
  const [loading, setLoading] = useState<boolean>(false);
  const [newEmail, setNewEmail] = useState<string>("");
  const [sent, setSent] = useState<boolean>(false);
  const [open, setOpen] = useState<boolean>(false);
  const formEmail = useForm<z.infer<typeof formEmailSchema>>({
    resolver: zodResolver(formEmailSchema),
    mode: "onChange",
    defaultValues: {
      newEmail: "",
    },
  });

  // La reconnexion récente remplace le mot de passe : les comptes Google ou
  // TikTok n’en ont pas. Le serveur la revérifie sur /change-email.
  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      // Nettoyage fluide sans glitch visuel
      setTimeout(() => {
        setSent(false);
        formEmail.reset();
        setNewEmail("");
      }, 300);
    }
  };

  async function onSubmit(data: z.infer<typeof formEmailSchema>) {
    // 1. On bloque l'interface
    setLoading(true);
    try {
      await authClient.changeEmail(
        {
          newEmail: data.newEmail,
          callbackURL: "/projects/user",
        },
        {
          onSuccess: () => {
            // 2. On retire le chargement ET on affiche la confirmation UNIQUEMENT en cas de succès
            setSent(true);
            setNewEmail(data.newEmail);
            playHaptic("success");
            toast.success("Email modifié avec succès.", {
              position: "top-center",
            });
          },
          onError: (ctx) => {
            playHaptic("error");
            const errorMessage =
              ctx?.error?.message ||
              "Une erreur s'est produite lors de la modification.";
            toast.error(errorMessage, {
              position: "top-center",
              className: "text-muted-foreground text-sm bg-card",
            });
          },
        },
      );
    } catch {
      playHaptic("error");
      toast.error("Une erreur réseau est survenue.");
    } finally {
      setLoading(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger className="cursor-pointer" asChild>
        {children}
      </DialogTrigger>

      <DialogContent className="sm:max-w-106.25">
        {!sent && (
          <form id="form-rhf-demo" onSubmit={formEmail.handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AtSignIcon className="h-5 w-5 text-primary" />
                Changer l&apos;adresse email
              </DialogTitle>
              <DialogDescription>
                Entrez votre nouvel adresse e-mail.
              </DialogDescription>
            </DialogHeader>
            <FieldGroup className="space-y-2 py-4">
              <Controller
                name="newEmail"
                control={formEmail.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={field.name}>
                      Nouvelle adresse email
                    </FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        type="email"
                        {...field}
                        id={field.name}
                        aria-invalid={fieldState.invalid}
                        placeholder="votre.nouvelemail@example.com"
                        autoComplete="email"
                      />
                      <InputGroupAddon align="inline-start">
                        <AtSignIcon />
                      </InputGroupAddon>
                    </InputGroup>
                    <FieldDescription>
                      L&apos;email est lie a votre authentification.
                    </FieldDescription>
                    {fieldState.invalid && (
                      <FieldError errors={[fieldState.error]} />
                    )}
                  </Field>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setOpen(false)}
                  disabled={loading}
                >
                  Annuler
                </Button>
                <Button disabled={loading} type="submit">
                  {loading ? <Loader className="animate-spin" /> : null}
                  {loading ? "Modification en cours..." : "Modifier l'email"}
                </Button>
              </DialogFooter>
            </FieldGroup>
          </form>
        )}

        {sent && (
          <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-2">
              <CheckCircle2 className="h-6 w-6 text-foreground" />
            </div>
            <DialogTitle>Vérifiez votre boîte mail</DialogTitle>
            <DialogDescription className="text-base">
              Un lien de confirmation a été envoyé à <strong>{newEmail}</strong>
              . Cliquez sur le lien pour confirmer le changement. <br />
              <br />
              <span className="p-4 bg-muted rounded-lg inline-flex border-l-4 border-foreground leading-relaxed text-sm text-muted-foreground">
                Un email de sécurité a également été envoyé à votre ancienne
                adresse pour vous informer du changement.
              </span>
            </DialogDescription>
            <div className="pt-4 w-full">
              <Button className="w-full" onClick={() => setOpen(false)}>
                Terminer
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
