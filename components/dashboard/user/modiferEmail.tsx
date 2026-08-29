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

import { authClient } from "@/lib/auth-client";
import { ArrowRight, AtSignIcon, CheckCircle2, Eye, EyeOff, Loader, Lock } from "lucide-react";
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
import { VerifyPasswordAction } from "@/app/actions/verify-password";


const formEmailSchema = z.object({
    newEmail: z.string().email("Entrer une adresse email valide."),
});

const formPasswordSchema = z.object({
    password: z.string()
        .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
        .max(256, "Le mot de passe ne peut pas dépasser 256 caractères."),
});

type Step = 1 | 2 | 3;

export default function ChangeEmailForm({ children }: { children: React.ReactNode }) {
    const { data: session } = authClient.useSession();
    const { playHaptic } = useHaptics();
    const [loading, setLoading] = useState<boolean>(false);
    const [newEmail, setNewEmail] = useState<string>("");
    const [currentPasswordVisible, setCurrentPasswordVisible] = useState(false);
    const [step, setStep] = useState<Step>(1);
    const [open, setOpen] = useState<boolean>(false);
    const formEmail = useForm<z.infer<typeof formEmailSchema>>({
        resolver: zodResolver(formEmailSchema),
        mode: "onChange",
        defaultValues: {
            newEmail: "",
        },
    });

    const formPassword = useForm<z.infer<typeof formPasswordSchema>>({
        resolver: zodResolver(formPasswordSchema),
        mode: "onChange",
        defaultValues: {
            password: "",
        },
    });

    // 2. Gestion de l'ouverture du modal et vérification du Provider
    const handleOpenChange = async (isOpen: boolean) => {
        setOpen(isOpen);

        if (isOpen) {
            setLoading(true);
            try {
                const { data: accounts } = await authClient.listAccounts();
                const hasPasswordAccount = accounts?.some((acc) => acc.providerId === "credential");

                // Contournement intelligent pour les comptes OAuth (Google, GitHub)
                setStep(hasPasswordAccount ? 1 : 2);
            } catch (error) {
                console.error("Erreur lors de la récupération des comptes", error);
                setStep(1); // Fallback sécurisé : exiger le mot de passe en cas de doute
            } finally {
                setLoading(false);
            }
        } else {
            // Nettoyage fluide sans glitch visuel
            setTimeout(() => {
                setStep(1);
                formPassword.reset();
                formEmail.reset();
                setCurrentPasswordVisible(false);
                setNewEmail("")
            }, 300);
        }
    };

    // Étape 1 : Vérification du mot de passe
    const handleVerifyPassword = async (data: z.infer<typeof formPasswordSchema>) => {
        if (!session?.user?.email) {
            toast.error("Impossible de vérifier votre identité.");
            return;
        }
        setLoading(true);
        try {
            const response = await VerifyPasswordAction(data.password);

            if (!response.success) {
                playHaptic("error");
                // On affiche l'erreur assainie renvoyée par le serveur
                toast.error(response.error || "Mot de passe incorrect.");
                // Optionnel : Vider le champ mot de passe après une erreur
                formPassword.setValue("password", "");
                return;
            }

            playHaptic("success");
            setStep(2);
        } catch {
            playHaptic("error");
            toast.error("Une erreur réseau est survenue.");
        } finally {
            setLoading(false);
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
                        // 2. On retire le chargement ET on passe à l'étape 3 UNIQUEMENT en cas de succès
                        setStep(3);
                        setNewEmail(data.newEmail)
                        playHaptic("success");
                        toast.success("Email modifié avec succès.", {
                            position: "top-center",
                        });
                    },
                    onError: (ctx) => {
                        playHaptic("error");
                        const errorMessage = ctx?.error?.message || "Une erreur s'est produite lors de la modification.";
                        toast.error(errorMessage, {
                            position: "top-center",
                            className: "text-muted-foreground text-sm bg-card",

                        });
                    },
                },
            );
        } catch {
            playHaptic("error");
            toast.error("Une erreur réseau est survenue.")
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

                {step === 1 && (
                    <form onSubmit={formPassword.handleSubmit(handleVerifyPassword)}>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Lock className="h-5 w-5 text-primary" />
                                Vérification de sécurité
                            </DialogTitle>
                            <DialogDescription>
                                Pour des raisons de sécurité, veuillez confirmer votre mot de passe actuel avant de modifier votre email.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-6 space-y-4">
                            <Controller
                                name="password"
                                control={formPassword.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor={field.name}>Mot de passe actuel</FieldLabel>
                                        <InputGroup>
                                            <InputGroupInput
                                                type={currentPasswordVisible ? "text" : "password"}
                                                {...field}
                                                id={field.name}
                                                aria-invalid={fieldState.invalid}
                                                placeholder="••••••••"

                                            />
                                            <InputGroupAddon align="inline-start">
                                                <Lock />
                                            </InputGroupAddon>
                                            <InputGroupAddon align="inline-end">
                                                <InputGroupButton
                                                    type="button"
                                                    variant="ghost"
                                                    size={"icon-sm"}
                                                    onClick={() => setCurrentPasswordVisible(!currentPasswordVisible)}>
                                                    {currentPasswordVisible ? <EyeOff /> : <Eye />}
                                                </InputGroupButton></InputGroupAddon>
                                        </InputGroup>
                                        <FieldDescription>
                                            Entrez votre mot de passe actuel pour confirmer votre identité avant de modifier votre adresse e-mail.
                                        </FieldDescription>
                                        {fieldState.invalid && (
                                            <FieldError errors={[fieldState.error]} />
                                        )}
                                    </Field>
                                )}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                                Annuler
                            </Button>
                            <Button type="submit" disabled={loading}>
                                {loading ? "Vérification..." : "Continuer"}
                                {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                            </Button>
                        </DialogFooter>
                    </form>
                )}

                {step === 2 && (<form id="form-rhf-demo" onSubmit={formEmail.handleSubmit(onSubmit)}>
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
                                    <FieldLabel htmlFor={field.name}>Nouvelle adresse email</FieldLabel>
                                    <InputGroup>
                                        <InputGroupInput
                                            type="email"
                                            {...field}
                                            id={field.name}
                                            aria-invalid={fieldState.invalid}
                                            placeholder="votre.nouvelemail@example.com"
                                            autoComplete="current-password"
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
                </form>)}

                {step === 3 && (
                    <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
                        <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mb-2">
                            <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                        </div>
                        <DialogTitle>Vérifiez votre boîte mail</DialogTitle>
                        <DialogDescription className="text-base">
                            Un lien de confirmation a été envoyé à <strong>{newEmail}</strong>.
                            Cliquez sur le lien pour confirmer le changement. <br /><br />
                            <span className="p-4 bg-muted rounded-lg inline-flex border-l-4 border-foreground leading-relaxed text-sm text-muted-foreground">
                                Un email de sécurité a également été envoyé à votre ancienne adresse pour vous informer du changement.
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
