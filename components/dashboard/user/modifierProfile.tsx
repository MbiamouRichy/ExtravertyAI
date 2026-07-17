"use client"

import * as React from "react"

import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer"
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
    InputGroupText,
} from "@/components/ui/input-group";
import { useHaptics } from "@/lib/webHaptics";
import { useState } from "react";
import * as z from "zod"
import { toast } from "sonner";
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { CameraIcon, Loader, UserIcon } from "lucide-react"
import { User } from "better-auth"
import { useIsMobile } from "@/hooks/use-mobile"

const MAX_FILE_SIZE = 2000000; // 2 Mo
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const formSchema = z.object({
    nom: z
        .string()
        .min(2, "Le nom doit contenir au moins 2 caractères.")
        .max(50, "Le nom doit contenir au maximum 50 caractères.").optional(),
    avatar: z.instanceof(File)
        .refine((file) => file.size <= MAX_FILE_SIZE, `La taille maximale est de 2 Mo.`)
        .refine(
            (file) => ACCEPTED_IMAGE_TYPES.includes(file.type),
            "Seuls les formats .jpg, .jpeg, .png et .webp sont supportés."
        )
});


export function ModifierProfile({ children, open, setOpen, user }: { children?: React.ReactNode, open?: boolean, setOpen?: (open: boolean) => void, user: User }) {
    const isMobile = useIsMobile()

    if (!isMobile) {
        return (
            <Dialog open={open} onOpenChange={setOpen}>
                {children && (
                    <DialogTrigger asChild>
                        {children}
                    </DialogTrigger>
                )}
                <DialogContent className="sm:max-w-106.25">
                    <DialogHeader>
                        <DialogTitle>Modifier le profil</DialogTitle>
                        <DialogDescription>
                            Faites des modifications à votre profil ici. Cliquez sur enregistrer lorsque vous avez terminé.
                        </DialogDescription>
                    </DialogHeader>
                    <ProfileForm user={user} />
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Drawer open={open} onOpenChange={setOpen}>
            {children && (
                <DrawerTrigger asChild>
                    {children}
                </DrawerTrigger>
            )}
            <DrawerContent>
                <DrawerHeader className="text-left">
                    <DrawerTitle>Modifier le profil</DrawerTitle>
                    <DrawerDescription>
                        Faites des modifications à votre profil ici. Cliquez sur enregistrer lorsque vous avez terminé.
                    </DrawerDescription>
                </DrawerHeader>
                <ProfileForm user={user} className="p-4" />
            </DrawerContent>
        </Drawer>
    )
}

function ProfileForm({ className, user }: React.ComponentProps<"form"> & { user: User }) {
    const { playHaptic } = useHaptics();
    const [loading, setLoading] = useState<boolean>(false);
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        mode: "onChange",
        defaultValues: {
            nom: user.name,
            avatar: undefined,
        },
    });
    async function onSubmit(data: z.infer<typeof formSchema>) {
        setLoading(true);
        try {
            console.log(data);
            playHaptic("success");
            toast.success("Informations mises à jour avec succès.", {
                position: "top-center",
            });

        } catch (error) {
            console.error("Error submitting profile form:", error);
            playHaptic("error");
            toast.error("Une erreur s'est produite.", {
                description: (
                    <p className="text-muted-foreground text-sm">Une erreur s&apos;est produite lors de la mise à jour de votre profil.</p>
                ),
                position: "top-center",
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
        <form className={className} id="profile-Form" onSubmit={form.handleSubmit(onSubmit)}>
            <FieldGroup className="gap-4">

                <div className="flex justify-center relative items-center w-full gap-4 mb-4">
                    <div className="relative w-32 h-32">
                        <Avatar className="h-full w-full border border-neutral-200">
                            <AvatarImage src={user.image || ""} alt={user.name} />
                            <AvatarFallback className="bg-neutral-100 text-neutral-900 text-xl font-medium">
                                {user.name.charAt(0).toUpperCase()}{user.name.charAt(1).toLowerCase()}
                            </AvatarFallback>
                        </Avatar>
                        <Button variant="secondary" size="icon-sm" className="rounded-full absolute bottom-0 right-0" >
                            <CameraIcon />
                        </Button>
                    </div>
                </div>

                <Controller
                    name="nom"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
                            <FieldLabel htmlFor={field.name}>Entrez votre nom</FieldLabel>
                            <InputGroup>
                                <InputGroupInput
                                    type="text"
                                    {...field}
                                    id={field.name}
                                    aria-invalid={fieldState.invalid}
                                    placeholder="Votre nom"
                                />
                                <InputGroupAddon align="block-start">
                                    <UserIcon />
                                    <InputGroupText>Modifier votre nom</InputGroupText>
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
                        <Button disabled={loading} type="submit" id="profile-Form">
                            {loading ? <Loader className="animate-spin" /> : null}
                            Enregistrer
                        </Button>
                    </Field>
                </FieldGroup>
            </FieldGroup>
        </form >
    )
}
