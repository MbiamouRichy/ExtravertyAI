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
import { useRouter } from "next/navigation";
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
const formEmailSchema = z.object({
    newEmail: z.string().email("Entrer une adresse email valide."),
});

const formPasswordSchema = z.object({
    password: z.string()
        .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
        .max(256, "Le mot de passe ne peut pas dépasser 256 caractères."),
});

export default function ChangeEmailForm({ children, currentEmail }: { children: React.ReactNode; currentEmail: string }) {
    const router = useRouter();
    const { playHaptic } = useHaptics();
    const [loading, setLoading] = useState<boolean>(false);
    const [currentPasswordVisible, setCurrentPasswordVisible] = useState(false);
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [open, setOpen] = useState<boolean>(false);
    const form = useForm<z.infer<typeof formEmailSchema>>({
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

    // Réinitialiser l'état quand on ferme la modale
    const handleOpenChange = (open: boolean) => {
        setOpen(open);
        if (!open) {
            setTimeout(() => {
                setStep(1);
                formPassword.reset();
                form.reset();
            }, 300); // Attendre la fin de l'animation de fermeture
        }
    };

    // Étape 1 : Vérification du mot de passe
    const handleVerifyPassword = async (data: z.infer<typeof formPasswordSchema>) => {
        setLoading(true);
        try {
            // Astuce Better Auth : On tente une connexion silencieuse pour valider le mot de passe
            const { error } = await authClient.signIn.email({
                email: currentEmail,
                password: data.password,
            });

            if (error) {
                playHaptic("error")
                toast.error("Mot de passe incorrect.");
                return;
            }

            // Si le mot de passe est bon, on passe à l'étape 2
            setStep(2);
        } catch {
            playHaptic("error")
            toast.error("Une erreur est survenue.");
        } finally {
            setLoading(false);
        }
    };

    async function onSubmit(data: z.infer<typeof formEmailSchema>) {
        setLoading(true);
        await authClient.changeEmail(
            {
                newEmail: data.newEmail as string,
                callbackURL: "/dashboard/user",
            },
            {
                onSuccess: () => {
                    playHaptic("success");
                    toast.success("Email modifier avec succes.", {
                        position: "top-center",
                    });
                    router.refresh();
                },
                onError: () => {
                    playHaptic("error");
                    toast.error("Une erreur s'est produite.", {
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
        setStep(3);
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

                {step === 2 && (<form id="form-rhf-demo" onSubmit={form.handleSubmit(onSubmit)}>
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
                            control={form.control}
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
                            Un lien de confirmation a été envoyé à <strong>{form.getValues("newEmail")}</strong>.
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
