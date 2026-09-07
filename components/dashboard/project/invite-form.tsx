"use client";

import * as React from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Eye,
    EyeOff,
    CheckCircle2,
    Loader2,
    Lock,
    User,
    ArrowRight,
    ShieldCheck,
    Building2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
    Field,
    FieldError,
    FieldGroup,
    FieldLabel,
} from "@/components/ui/field";

import { toast } from "sonner";
import { acceptInvitationAndRegister, type InvitationDetails } from "@/app/actions/invite";
import { useHaptics } from "@/lib/webHaptics";

const registerSchema = z.object({
    name: z.string().min(2, "Veuillez entrer votre nom complet."),
    password: z
        .string()
        .min(8, "Le mot de passe doit contenir au moins 8 caractères.")
});

type RegisterFormValues = z.infer<typeof registerSchema>;

interface InviteFormProps {
    invitation: InvitationDetails;
    token: string;
}

export function InviteForm({ invitation, token }: InviteFormProps) {
    const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [isPending, startTransition] = useTransition();
    const { playHaptic } = useHaptics();
    const form = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            name: "",
            password: "",
        },
    });

    const onSubmit = (values: RegisterFormValues) => {
        startTransition(async () => {
            const res = await acceptInvitationAndRegister({
                token,
                name: values.name,
                password: values.password,
            });

            if (res.success) {
                playHaptic("success");
                toast.success("Compte créé avec succès ! Bienvenue à bord.");
                router.push(`/projects/${res.projectId}`);
            } else {
                playHaptic("error");
                toast.error(res.error || "Une erreur est survenue.");
            }
        });
    };

    const getRoleLabel = (role: string) => {
        switch (role) {
            case "ADMIN":
                return "Administrateur";
            case "OWNER":
                return "Propriétaire";
            default:
                return "Agent / Utilisateur";
        }
    };

    return (
        <Card className="w-full bg-card/50 max-w-lg">
            {/* HEADER VISUEL DU PROJET */}
            <CardHeader className="p-2 md:p-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 justify-between mb-4">
                    <Badge variant="secondary" className="gap-1.5 py-1 px-3 text-xs font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Invitation valide
                    </Badge>
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                        {getRoleLabel(invitation.role)}
                    </Badge>
                </div>

                <div className="flex items-center gap-4 pt-1">
                    <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary">
                        <Building2 className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-foreground">
                            {invitation.project.name}
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Invité(e) par <span className="font-medium text-foreground">{invitation.inviter.name}</span>
                        </p>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-2 md:p-4 space-y-6">
                <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-foreground">Créez votre compte</h3>
                    <p className="text-sm text-muted-foreground">
                        Finalisez votre profil pour accéder à l&apos;espace de travail.
                    </p>
                </div>

                <form id="accept-invite-form" onSubmit={form.handleSubmit(onSubmit)}>
                    <FieldGroup>
                        {/* EMAIL (READONLY) */}
                        <Field>
                            <FieldLabel className="text-xs font-medium text-muted-foreground">
                                Adresse email attribuée
                            </FieldLabel>
                            <div className="relative">
                                <Input
                                    value={invitation.email}
                                    disabled
                                    readOnly
                                    className="bg-muted/40 font-medium text-muted-foreground cursor-not-allowed select-none"
                                />
                                <ShieldCheck className="absolute right-3 top-2.5 h-4 w-4 text-emerald-500" />
                            </div>
                        </Field>

                        {/* NOM COMPLET */}
                        <Field data-invalid={!!form.formState.errors.name}>
                            <FieldLabel htmlFor="name">Nom complet</FieldLabel>
                            <div className="relative">
                                <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    {...form.register("name")}
                                    id="name"
                                    placeholder="ex: Paul Mbadinga"
                                    className="pl-9"
                                    disabled={isPending}
                                    autoComplete="name"
                                />
                            </div>
                            {form.formState.errors.name && (
                                <FieldError errors={[form.formState.errors.name]} />
                            )}
                        </Field>

                        {/* MOT DE PASSE */}
                        <Field data-invalid={!!form.formState.errors.password}>
                            <FieldLabel htmlFor="password">Mot de passe</FieldLabel>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    {...form.register("password")}
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="••••••••••••"
                                    className="pl-9 pr-10"
                                    disabled={isPending}
                                    autoComplete="new-password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                            {form.formState.errors.password && (
                                <FieldError errors={[form.formState.errors.password]} />
                            )}
                        </Field>
                    </FieldGroup>
                </form>
            </CardContent>

            <CardFooter className="p-2 md:p-4 flex flex-col gap-3">
                <Button
                    type="submit"
                    form="accept-invite-form"
                    className="w-full"
                    disabled={isPending}
                >
                    {isPending ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Création du compte...
                        </>
                    ) : (
                        <>
                            Rejoindre l&apos;équipe <ArrowRight className="w-4 h-4" />
                        </>
                    )}
                </Button>
                <p className="text-xs text-center text-muted-foreground">
                    En rejoignant le projet, vous acceptez les conditions d&apos;utilisation d&apos;ExtravertyAI.
                </p>
            </CardFooter>
        </Card>
    );
}