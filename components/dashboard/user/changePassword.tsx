"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2, KeySquareIcon, EyeOff, Eye } from "lucide-react";
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
import * as z from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useHaptics } from "@/lib/webHaptics";

// 1. Correction du schéma Zod
const formSchema = z
    .object({
        currentPassword: z
            .string()
            .min(1, "Le mot de passe actuel est requis."),
        newPassword: z
            .string()
            .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
            .max(15, "Le mot de passe doit contenir au maximum 15 caractères."),
        confirmPassword: z
            .string()
            .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
            .max(15, "Le mot de passe doit contenir au maximum 15 caractères."),
        // On retire le .optional() pour aligner parfaitement les types TypeScript
        revokeSessions: z.boolean(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: "Les nouveaux mots de passe ne correspondent pas.",
        path: ["confirmPassword"],
    });

export function ChangePasswordDialog({ children }: { children: React.ReactNode }) {
    const { playHaptic } = useHaptics();
    const router = useRouter();

    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [currentPasswordVisible, setCurrentPasswordVisible] = useState(false);
    const [newPasswordVisible, setNewPasswordVisible] = useState(false);
    const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);

    // On supprime les state de revokeSessions, React Hook Form gère cela maintenant
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        mode: "onChange",
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
            revokeSessions: true,
        },
    });

    async function onSubmit(data: z.infer<typeof formSchema>) {
        setLoading(true);

        // 2. Appel à l'API Better Auth direct (Zod a déjà validé les longueurs et correspondances !)
        const { error: authError } = await authClient.changePassword({
            newPassword: data.newPassword,
            currentPassword: data.currentPassword,
            revokeOtherSessions: data.revokeSessions,
        });

        if (authError) {
            playHaptic("error");
            setLoading(false);

            if (authError.status === 403 || authError.code === "INVALID_PASSWORD") {
                toast.error("L'ancien mot de passe est incorrect.", {
                    position: "top-center",
                    action: (
                        <Button
                            onClick={() => {
                                form.setValue("currentPassword", "");
                                form.setFocus("currentPassword");
                            }}
                        >
                            Réessayer
                        </Button>
                    )
                });
            } else {
                toast.error(authError.message || "Une erreur est survenue.", {
                    position: "top-center",
                });
            }
            return;
        }

        // 3. Succès : On nettoie et on ferme
        setLoading(false);
        setOpen(false);
        form.reset(); // Réinitialise tout le formulaire d'un coup

        toast.success("Mot de passe modifié avec succès.", { position: "top-center" });
        router.refresh();
    }

    // Gestion des erreurs Zod (si le formulaire est invalide à la soumission)
    function onError() {
        playHaptic("error");
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className="cursor-pointer" asChild>
                {children}
            </DialogTrigger>

            <DialogContent className="sm:max-w-[425px]">
                {/* On passe la fonction onError pour jouer l'haptique si Zod bloque la soumission */}
                <form id="change-password-form" onSubmit={form.handleSubmit(onSubmit, onError)}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <KeyRound className="h-5 w-5 text-primary" />
                            Modifier le mot de passe
                        </DialogTitle>
                        <DialogDescription>
                            Assurez-vous d&apos;utiliser un mot de passe long et sécurisé.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <FieldGroup>
                            <Controller
                                name="currentPassword"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor={field.name}>Mot de passe actuel</FieldLabel>
                                        <InputGroup>
                                            <InputGroupInput
                                                {...field}
                                                id={field.name}
                                                aria-invalid={fieldState.invalid}
                                                placeholder="••••••••"
                                                autoComplete="off"
                                                type={currentPasswordVisible ? "text" : "password"}
                                            />
                                            <InputGroupAddon align="inline-start">
                                                <KeySquareIcon />
                                            </InputGroupAddon>
                                            <InputGroupAddon align="inline-end">
                                                <InputGroupButton
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={() => setCurrentPasswordVisible(!currentPasswordVisible)}
                                                    type="button"
                                                >
                                                    {currentPasswordVisible ? <Eye /> : <EyeOff />}
                                                </InputGroupButton>
                                            </InputGroupAddon>
                                        </InputGroup>
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )}
                            />

                            <Controller
                                name="newPassword"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor={field.name}>Nouveau mot de passe</FieldLabel>
                                        <InputGroup>
                                            <InputGroupInput
                                                {...field}
                                                id={field.name}
                                                aria-invalid={fieldState.invalid}
                                                placeholder="Minimum 8 caractères"
                                                autoComplete="off"
                                                type={newPasswordVisible ? "text" : "password"}
                                            />
                                            <InputGroupAddon align="inline-start">
                                                <KeySquareIcon />
                                            </InputGroupAddon>
                                            <InputGroupAddon align="inline-end">
                                                <InputGroupButton
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={() => setNewPasswordVisible(!newPasswordVisible)}
                                                    type="button"
                                                >
                                                    {newPasswordVisible ? <Eye /> : <EyeOff />}
                                                </InputGroupButton>
                                            </InputGroupAddon>
                                        </InputGroup>
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )}
                            />

                            <Controller
                                name="confirmPassword"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
                                        <FieldLabel htmlFor={field.name}>Confirmer le nouveau mot de passe</FieldLabel>
                                        <InputGroup>
                                            <InputGroupInput
                                                {...field}
                                                id={field.name}
                                                aria-invalid={fieldState.invalid}
                                                placeholder="••••••••"
                                                autoComplete="off"
                                                type={confirmPasswordVisible ? "text" : "password"}
                                            />
                                            <InputGroupAddon align="inline-start">
                                                <KeySquareIcon />
                                            </InputGroupAddon>
                                            <InputGroupAddon align="inline-end">
                                                <InputGroupButton
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={() => setConfirmPasswordVisible(!confirmPasswordVisible)}
                                                    type="button"
                                                >
                                                    {confirmPasswordVisible ? <Eye /> : <EyeOff />}
                                                </InputGroupButton>
                                            </InputGroupAddon>
                                        </InputGroup>
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )}
                            />

                            {/* 3. Correction du Checkbox */}
                            <Controller
                                name="revokeSessions"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid} className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 shadow-sm">
                                        <Checkbox
                                            id={field.name}
                                            // On remplace le {...field} par ces propriétés explicites :
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                            disabled={field.disabled}
                                            ref={field.ref}
                                            aria-invalid={fieldState.invalid}
                                            className="size-4! h-4! w-4!"
                                        />
                                        <div className="space-y-1 leading-none">
                                            <FieldLabel htmlFor={field.name} className="text-sm font-medium">
                                                Déconnecter tous les autres appareils
                                            </FieldLabel>
                                            <p className="text-xs text-muted-foreground">
                                                Recommandé pour des raisons de sécurité lors d&apos;un changement de mot de passe.
                                            </p>
                                        </div>
                                    </Field>
                                )}
                            />
                        </FieldGroup>
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setOpen(false)}
                            disabled={loading}
                        >
                            Annuler
                        </Button>
                        <Button type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Mise à jour...
                                </>
                            ) : (
                                "Enregistrer"
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}