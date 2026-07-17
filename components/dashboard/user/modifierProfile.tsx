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
    FieldError,
    FieldGroup,
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
import { Input } from "@/components/ui/input";
import { updateProfileAction } from "@/app/actions/upload";

const formSchema = z.object({
    nom: z
        .string()
        .min(2, "Le nom doit contenir au moins 2 caractères.")
        .max(50, "Le nom doit contenir au maximum 50 caractères.").optional()
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
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        const selectedFile = e.target.files?.[0];

        if (!selectedFile) return;

        // Vérification de la taille côté client (2 Mo)
        if (selectedFile.size > 2 * 1024 * 1024) {
            playHaptic("error");
            toast.error("Une erreur s'est produite.", {
                description: (
                    <p className="text-muted-foreground text-sm">
                        L&apos;image est trop lourde. Veuillez choisir un fichier de moins de 2 Mo.
                    </p>
                ),
                position: "top-center",
            });
            setError("L'image est trop lourde. Veuillez choisir un fichier de moins de 2 Mo.");
            setFile(null);
            if (preview) URL.revokeObjectURL(preview);
            setPreview(null);
            return;
        }

        setFile(selectedFile);

        // Créer un aperçu local de l'image
        if (preview) URL.revokeObjectURL(preview);
        const objectUrl = URL.createObjectURL(selectedFile);
        setPreview(objectUrl);
    };
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        mode: "onChange",
        defaultValues: {
            nom: user.name,
        },
    });
    async function onSubmit(data: z.infer<typeof formSchema>) {
        setLoading(true);
        try {
            console.log(data, file);
            const formData = new FormData();
            if (data.nom) {
                formData.append("nom", data.nom);
            }
            if (user.id) {
                formData.append("userId", user.id);
            }
            if (file) {
                formData.append("file", file);
            }
            const result = await updateProfileAction(formData);
            if (result?.error) throw new Error(result.error);
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

                <div className="flex flex-col justify-center relative items-center w-full gap-4 mb-4">
                    <div className="relative w-32 h-32">
                        <Avatar className="h-full w-full border border-neutral-200">
                            <AvatarImage src={preview ? preview : user.image ? user.image : undefined} alt={user.name} />
                            <AvatarFallback className="bg-neutral-100 text-neutral-900 text-xl font-medium">
                                {user.name.charAt(0).toUpperCase()}{user.name.charAt(1).toLowerCase()}
                            </AvatarFallback>
                        </Avatar>
                        <Button variant="outline" size="icon-sm" className="rounded-full absolute bottom-0 right-0 pointer-events-none" >
                            <CameraIcon />
                        </Button>

                        <Input
                            type="file"
                            className="absolute bottom-0 right-0 w-full h-full opacity-0 cursor-pointer"
                            accept="image/jpeg, image/jpg, image/png, image/webp"
                            onChange={handleFileChange}
                        />
                    </div>
                    {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
                </div>
                <Controller
                    name="nom"
                    control={form.control}
                    render={({ field, fieldState }) => (
                        <Field data-invalid={fieldState.invalid}>
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
                        <Button disabled={loading} type="submit">
                            {loading ? <Loader className="animate-spin" /> : null}
                            Enregistrer
                        </Button>
                    </Field>
                </FieldGroup>
            </FieldGroup>
        </form >
    )
}
