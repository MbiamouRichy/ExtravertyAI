"use client"

import * as React from "react"
import { useState, useTransition } from "react"
import { createProject } from "@/app/actions/projects"
import {
    Field,
    FieldDescription,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@/components/ui/input-group";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";


import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"


import { PhoneIcon, FolderIcon, Loader } from "lucide-react"
import { useHaptics } from "@/lib/webHaptics"

const formSchema = z
    .object({
        nom: z
            .string()
            .min(2, "Votre nom doit contenir au moins 02 caractères.")
            .max(32, "Votre nom doit contenir au maximum 32 caractères."),
        numero: z
            .string()
            .min(8, "Le numéro de téléphone doit contenir au moins 8 caractères.")
            .max(15, "Le numéro de téléphone doit contenir au maximum 15 caractères."),

    });


export function CreateProjectDialog({children}: {children: React.ReactNode}) {
    const { playHaptic } = useHaptics();
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [isPending, startTransition] = useTransition()

   const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        mode: "onChange"
    });
   
    async function onSubmit(data: z.infer<typeof formSchema>) {
        setLoading(true);
          startTransition(async () => {
              try {
                  await createProject(data)
                  setOpen(false) // Ferme la modale en cas de succès
              } catch (err) {
                  playHaptic("error");
                  toast.error("Une erreur s'est produite.", {
                      description:
                          err instanceof Error ? err.message : "Erreur inconnue",
                      position: "top-center",
                      className: "text-muted-foreground text-sm bg-card",
                      action: {
                          label: "Réessayer",
                          onClick: () => {
                              onSubmit(data);
                          },
                      },
                  });
              } finally {
                  setLoading(false)
              }
          })
      }
       
    

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!isPending) setOpen(v) }}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>

            <DialogContent className="sm:max-w-115 p-6 border border-border bg-card shadow-lg rounded-xl animate-in fade-in-50 duration-200">
                <DialogHeader className="space-y-1.5">
                    <DialogTitle className="text-xl font-semibold tracking-tight text-foreground">
                        Créer un projet
                    </DialogTitle>
                    <DialogDescription className="text-sm text-muted-foreground">
                        Associez un nom à votre canal et configurez le terminal de routage WhatsApp.
                    </DialogDescription>
                </DialogHeader>

                <form id="form-instance" onSubmit={form.handleSubmit(onSubmit)}>
                    <FieldGroup className="gap-4">
                        <Controller
                            name="nom"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={field.name}>
                                        Entrez le nom du projet
                                    </FieldLabel>
                                    <InputGroup>
                                        <InputGroupInput
                                            placeholder="Jean Exemple"
                                            type="text"
                                            {...field}
                                            id={field.name}
                                            aria-invalid={fieldState.invalid}
                                            disabled={loading}
                                        />
                                        <InputGroupAddon align="inline-start">
                                            <FolderIcon />
                                        </InputGroupAddon>
                                    </InputGroup>

                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />
                        <Controller
                            name="numero"
                            control={form.control}
                            render={({ field, fieldState }) => (
                                <Field data-invalid={fieldState.invalid}>
                                    <FieldLabel htmlFor={field.name}>
                                        Entrez le numéro WhatsApp à automatiser
                                    </FieldLabel>
                                    <InputGroup>
                                        <InputGroupInput
                                            placeholder="+2411234567890"
                                            type="tel"
                                            {...field}
                                            id={field.name}
                                            aria-invalid={fieldState.invalid}
                                            disabled={loading}
                                        />
                                        <InputGroupAddon align="inline-start">
                                            <PhoneIcon />
                                        </InputGroupAddon>
                                    </InputGroup>
                                    <FieldDescription>Entrez le numéro du compte WhatsApp à automatiser</FieldDescription>

                                    {fieldState.invalid && (
                                        <FieldError errors={[fieldState.error]} />
                                    )}
                                </Field>
                            )}
                        />
                        
                  <DialogFooter className="mt-4">
                            <DialogClose asChild>
                                <Button variant={"outline"} type="button">Close</Button>
                            </DialogClose>
                            <Button disabled={loading} type="submit" id="form-instance">
                                {loading ? <Loader className="animate-spin" /> : null}
                                Initialiser le projet
                            </Button>
                    </DialogFooter>
                    </FieldGroup>
                </form>
            </DialogContent>
        </Dialog>
    )
}