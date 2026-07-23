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
import { useRouter } from "next/navigation";
import { AtSignIcon, Loader } from "lucide-react";
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
const formSchema = z.object({
    email: z.string().email("Entrer une adresse email valide."),
});

export default function ChangeEmailForm({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { playHaptic } = useHaptics();
    const [loading, setLoading] = useState<boolean>(false);
    const [open, setOpen] = useState<boolean>(false);
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        mode: "onChange",
        defaultValues: {
            email: "",
        },
    });
    async function onSubmit(data: z.infer<typeof formSchema>) {
        setLoading(true);
        await authClient.changeEmail(
            {
                newEmail: data.email as string,
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
        setOpen(false);
    }
    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger className="cursor-pointer" asChild>
                {children}
            </DialogTrigger>

            <DialogContent className="sm:max-w-106.25">
                <form id="form-rhf-demo" onSubmit={form.handleSubmit(onSubmit)}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AtSignIcon className="h-5 w-5 text-primary" />
                            Changer l&apos;adresse email
                        </DialogTitle>
                        <DialogDescription>
                            Entrez votre adresse nouvel adresse e-mail.
                            Appuyer sur Enregistrer une fois terminer.
                        </DialogDescription>
                    </DialogHeader>
                    <FieldGroup className="space-y-2 py-4">
                        <Controller
                            name="email"
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
                                Modifier l&apos;email
                            </Button>
                        </DialogFooter>
                    </FieldGroup>
                </form>
            </DialogContent>
        </Dialog>
    );
}
