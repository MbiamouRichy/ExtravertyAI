"use client";

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, ShieldCheck, Lock, Smartphone, Folder, Sparkles, CheckCircle2, FolderPenIcon } from "lucide-react";

// Assurez-vous d'avoir ces composants shadcn/ui installés
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

// --- VALIDATION ZOD ---
const formSchema = z.object({
    name: z.string().min(3, "Le nom doit contenir au moins 3 caractères."),
    numero: z.string().regex(/^\+[1-9]\d{1,14}$/, "Format invalide. Utilisez le format international (ex: +33612345678)."),
    plan: z.enum(["starter", "business", "pro"] as const, {
        message: "Veuillez sélectionner un forfait.",
    }),
});

type FormValues = z.infer<typeof formSchema>;

// --- DONNÉES DES FORFAITS ---
const PLANS = [
    {
        id: "starter",
        name: "Starter",
        price: "29€",
        messages: 1000,
        description: "Idéal pour lancer son automatisation.",
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_STARTER,
    },
    {
        id: "business",
        name: "Business",
        price: "79€",
        messages: 5000,
        description: "Pour les entreprises en pleine croissance.",
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_BUSINESS,
        isPopular: true,
    },
    {
        id: "pro",
        name: "Pro",
        price: "199€",
        messages: 20000,
        description: "Volume intensif et support prioritaire.",
        stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO,
    },
];

export default function CreateProjectForm() {
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            numero: "",
            plan: "business", // On pré-sélectionne le forfait le plus populaire
        },
    });

    const selectedPlanId = form.watch("plan");
    const selectedPlan = PLANS.find((p) => p.id === selectedPlanId);

    async function onSubmit(data: FormValues) {
        setIsLoading(true);
        try {
            // 1. Appel à votre Server Action pour créer le projet en base (statut: trialing)
            // const newProject = await createProjectBaseAction(data);

            // 2. Appel de l'action Stripe que nous avons créée précédemment
            // const priceId = PLANS.find(p => p.id === data.plan)?.stripePriceId;
            // const { url } = await createCheckoutSession(priceId, newProject.id);

            // 3. Redirection vers Stripe
            // router.push(url);

            // Simulation pour l'UI :
            await new Promise((resolve) => setTimeout(resolve, 2000));
            console.log("Données soumises :", data);
        } catch (error) {
            console.error("Erreur lors de la création", error);
            // Afficher un toast d'erreur ici
        } finally {
            setIsLoading(false);
        }
    }

    return (
        <div className="mx-auto max-w-5xl py-10 px-4 sm:px-6 lg:px-8">
            <div className="mb-8 text-center sm:text-left">
                <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
                    Déployez votre agent <span className="text-primary">ExtravertyAI</span>
                </h1>
                <p className="mt-2 text-muted-foreground">
                    Configurez votre instance WhatsApp en quelques clics. Vous ne serez facturé qu&apos;après votre période d&apos;essai.
                </p>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* COLONNE GAUCHE : Formulaire */}
                <div className="lg:col-span-7 space-y-8">

                    {/* Section 1 : Informations du projet */}
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Folder className="h-5 w-5 text-primary" />
                                Informations de l&apos;instance
                            </CardTitle>
                            <CardDescription>
                                Ces informations permettront d&apos;identifier votre bot.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <FieldGroup>
                                <Controller
                                    name="name"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor={field.name}>Nom du projet</FieldLabel>
                                            <InputGroup>
                                                <InputGroupInput
                                                    type="text"
                                                    {...field}
                                                    id={field.name}
                                                    aria-invalid={fieldState.invalid}
                                                    placeholder="Ex: Support Client - Boutique Paris"
                                                />
                                                <InputGroupAddon align="inline-start">
                                                    <FolderPenIcon />
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
                                            <FieldLabel htmlFor={field.name}>Numéro WhatsApp cible</FieldLabel>
                                            <InputGroup>
                                                <InputGroupInput
                                                    type="text"
                                                    {...field}
                                                    id={field.name}
                                                    aria-invalid={fieldState.invalid}
                                                    placeholder="+33612345678"
                                                />
                                                <InputGroupAddon align="inline-start">
                                                    <Smartphone />
                                                </InputGroupAddon>
                                            </InputGroup>
                                            <FieldDescription>
                                                Le numéro de téléphone qui sera automatisé par l&apos;IA (format international requis).
                                            </FieldDescription>
                                            {fieldState.invalid && (
                                                <FieldError errors={[fieldState.error]} />
                                            )}
                                        </Field>
                                    )}
                                />
                            </FieldGroup>
                        </CardContent>
                    </Card>

                    {/* Section 2 : Choix du Forfait */}
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Sparkles className="h-5 w-5 text-primary" />
                                Choisissez votre volume
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <FieldGroup>
                                <Controller
                                    control={form.control}
                                    name="plan"
                                    render={({ field, fieldState }) => (
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            value={field.value} // 🔄 CORRECTION: "value" au lieu de "defaultValue" pour le mode contrôlé
                                            className="grid grid-cols-1 sm:grid-cols-3 gap-4"
                                        >
                                            {PLANS.map((plan) => (
                                                <Field data-invalid={fieldState.invalid} key={plan.id}>
                                                    {/* 🔄 CORRECTION: Ajout de l'ID pour lier le label */}
                                                    <RadioGroupItem value={plan.id} id={`plan-${plan.id}`} className="peer sr-only" />
                                                    {/* 🔄 CORRECTION: Ajout du htmlFor pour rendre la carte cliquable */}
                                                    <FieldLabel htmlFor={`plan-${plan.id}`} className="cursor-pointer flex flex-col items-center justify-between rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 [&:has([data-state=checked])]:border-primary transition-all">
                                                        {plan.isPopular && (
                                                            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full absolute -mt-7">
                                                                POPULAIRE
                                                            </span>
                                                        )}
                                                        <div className="text-center w-full">
                                                            <div className="font-semibold text-lg">{plan.name}</div>
                                                            <div className="text-2xl font-bold mt-2">{plan.price}<span className="text-sm font-normal text-muted-foreground">/mois</span></div>
                                                            <div className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">
                                                                Jusqu&apos;à {plan.messages.toLocaleString('fr-FR')} msgs
                                                            </div>
                                                        </div>
                                                    </FieldLabel>
                                                </Field>
                                            ))}
                                        </RadioGroup>
                                    )}
                                />
                                {/* Message d'erreur global pour le forfait si besoin */}
                                {form.formState.errors.plan?.message && (
                                    <p className="text-[0.8rem] font-medium text-destructive mt-2">
                                        {form.formState.errors.plan.message}
                                    </p>
                                )}
                            </FieldGroup>
                        </CardContent>
                    </Card>
                </div>

                {/* COLONNE DROITE : Récapitulatif et Réassurance (Sticky) */}
                <div className="lg:col-span-5 relative">
                    <div className="sticky top-8 space-y-6">

                        {/* Carte de résumé */}
                        <Card className="border-primary/20 bg-primary/5 shadow-md">
                            <CardHeader>
                                <CardTitle className="text-lg">Récapitulatif</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Forfait choisi</span>
                                    <span className="font-semibold">{selectedPlan?.name}</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">Limite mensuelle</span>
                                    <span className="font-semibold">{selectedPlan?.messages.toLocaleString('fr-FR')} msgs</span>
                                </div>
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground">À payer aujourd&apos;hui</span>
                                    <span className="font-bold text-lg text-foreground">0,00 €</span>
                                </div>

                                <div className="pt-4 border-t border-primary/10">
                                    <Button
                                        type="submit"
                                        className="w-full h-12 text-md font-semibold bg-primary hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25"
                                        disabled={isLoading}
                                    >
                                        {isLoading ? (
                                            <>
                                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                                Création de l&apos;instance...
                                            </>
                                        ) : (
                                            "Démarrer mes 10 jours d&apos;essai"
                                        )}
                                    </Button>
                                </div>
                                <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1 mt-2">
                                    <Lock className="h-3 w-3" /> Redirection sécurisée vers Stripe
                                </p>
                            </CardContent>
                        </Card>

                        {/* Badges de réassurance UX */}
                        <div className="space-y-3 px-2">
                            <div className="flex items-start gap-3 text-sm">
                                <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium text-foreground">10 jours d&apos;essai offerts</p>
                                    <p className="text-muted-foreground text-xs leading-relaxed">Testez votre IA gratuitement. Le premier prélèvement aura lieu dans 10 jours ou après 150 messages échangés.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3 text-sm">
                                <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-medium text-foreground">Sans engagement</p>
                                    <p className="text-muted-foreground text-xs leading-relaxed">Annulez votre abonnement à tout moment d&apos;un simple clic depuis votre tableau de bord.</p>
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            </form>
        </div>
    );
}