"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";


import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { LogoIcon } from "@/components/logo";
import { Button } from "@/components/ui/button";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
} from "@/components/ui/input-group";
import { AuthDivider } from "@/components/dashboard/auth-divider";
import { FloatingPaths } from "@/components/dashboard/floating-paths";
import { ChevronLeftIcon, AtSignIcon, Loader, Eye, EyeOff, UserIcon, KeySquareIcon } from "lucide-react";
import { SignInSocialButton } from "../auth/signInSocialButton";
import Link from "next/link";
import { signUp } from "@/lib/auth-client";
import { useState } from "react";
import { useHaptics } from "@/lib/webHaptics";
import { useRouter } from "next/navigation";

const formSchema = z
	.object({
		nom: z
			.string()
			.min(2, "Votre nom doit contenir au moins 02 caractères.")
			.max(32, "Votre nom doit contenir au maximum 32 caractères."),
		email: z.string().email("Entrez une adresse email valide."),
		password: z
			.string()
			.min(8, "La mot de passe doit contenir au moins 8 caractères.")
			.max(256, "La mot de passe doit contenir au maximum 256 caractères."),

	});


export function AuthPage() {
	const { playHaptic } = useHaptics();
	const [loading, setLoading] = useState<boolean>(false);
	const [showPassword, setShowPassword] = useState(false);
	const router = useRouter();
	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		mode: "onChange",
		defaultValues: {
			nom: "",
			email: "",
			password: "",
		},
	});

	async function onSubmit(data: z.infer<typeof formSchema>) {
		setLoading(true);
		try {
			await signUp.email(
				{
					name: data.nom as string,
					email: data.email as string,
					password: data.password as string,
					callbackURL: "/sign-in",
				},
				{
					onSuccess: () => {
						playHaptic("success");

						toast.success("Verifier votre adresse email pour verification", {
							position: "top-center",
						});
						router.push("/sign-in");
					},
					onError: (error) => {
						playHaptic("error");
						toast.error("Une erreur s'est produite.", {
							description:
								error.error.message === "User already exists. Use another email."
									? "Cet email est déjà utilisé. Veuillez en utiliser un autre."
									: "Quelque chose s'est mal passé. Veuillez réessayer.",
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
			)
		} catch {
			playHaptic("error");
			toast.error("Une erreur s'est produite.", {
				description:
					"Quelque chose s'est mal passé. Veuillez réessayer.",
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
			setLoading(false);
		}
	}
	return (
		<main className="relative md:min-h-screen h-full overflow-x-hidden lg:grid lg:grid-cols-2">
			<div className="relative hidden h-full flex-col border-r bg-secondary p-10 lg:flex dark:bg-secondary/20">
				<div className="absolute inset-0 bg-linear-to-b from-transparent via-transparent to-background" />
				<LogoIcon className="mr-auto w-10" />

				<div className="z-10 mt-auto">
					<blockquote className="space-y-2">
						<p className="text-xl">
							&ldquo;Cette plateforme m&apos;a aidé à gagner du temps et à servir mes clients plus rapidement qu&apos;aucune autre avant.&rdquo;
						</p>
						<footer className="font-mono font-semibold text-sm">
							~ Mbiamou Tchogna
						</footer>
					</blockquote>
				</div>
				<div className="absolute inset-0">
					<FloatingPaths position={1} />
					<FloatingPaths position={-1} />
				</div>
			</div>
			<div className="relative flex min-h-screen flex-col justify-center pt-8 lg:pt-0 px-4">
				{/* Top Shades */}
				<div
					aria-hidden
					className="absolute inset-0 isolate -z-10 opacity-60 contain-strict"
				>
					<div className="absolute top-0 right-0 h-320 w-140 -translate-y-87.5 rounded-full bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,--theme(--color-foreground/.06)_0,hsla(0,0%,55%,.02)_50%,--theme(--color-foreground/.01)_80%)]" />
					<div className="absolute top-0 right-0 h-320 w-60 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)] [translate:5%_-50%]" />
					<div className="absolute top-0 right-0 h-320 w-60 -translate-y-87.5 rounded-full bg-[radial-gradient(50%_50%_at_50%_50%,--theme(--color-foreground/.04)_0,--theme(--color-foreground/.01)_80%,transparent_100%)]" />
				</div>
				<Button asChild className="self-start mb-5 lg:mb-0" variant="ghost">
					<Link href="/">
						<ChevronLeftIcon data-icon="inline-start" />
						Accueil
					</Link>
				</Button>

				<div className="mx-auto space-y-4 sm:w-sm">
					<div className="flex flex-col space-y-1">
						<h1 className="font-bold text-2xl tracking-wide">
							S&apos;inscrire
						</h1>
						<p className="text-base text-muted-foreground">
							Creer un compte sur ExtravertyAI.
						</p>
					</div>

					<form id="form-inscription" onSubmit={form.handleSubmit(onSubmit)}>
						<FieldGroup className="gap-4">
							<Controller
								name="nom"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Entrez votre nom
										</FieldLabel>
										<InputGroup>
											<InputGroupInput
												placeholder="Jean Exemple"
												type="text"
												{...field}
												id={field.name}
												aria-invalid={fieldState.invalid}
											/>
											<InputGroupAddon align="inline-start">
												<UserIcon
												/>
											</InputGroupAddon>
										</InputGroup>

										{fieldState.invalid && (
											<FieldError errors={[fieldState.error]} />
										)}
									</Field>
								)}
							/>
							<Controller
								name="email"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>
											Entrez votre adresse e-mail
										</FieldLabel>
										<InputGroup>
											<InputGroupInput
												placeholder="votre.email@example.com"
												type="email"
												{...field}
												id={field.name}
												aria-invalid={fieldState.invalid}
											/>
											<InputGroupAddon align="inline-start">
												<AtSignIcon
												/>
											</InputGroupAddon>
										</InputGroup>

										{fieldState.invalid && (
											<FieldError errors={[fieldState.error]} />
										)}
									</Field>
								)}
							/>
							<Controller
								name="password"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>Mot de passe</FieldLabel>
										<InputGroup>
											<InputGroupInput
												{...field}
												id={field.name}
												aria-invalid={fieldState.invalid}
												placeholder="Entrez un mot de passe (8-15 caractères)"
												autoComplete="off"
												type={showPassword ? "text" : "password"}
											/>
											<InputGroupAddon align="inline-start">
												<KeySquareIcon />
											</InputGroupAddon>
											<InputGroupAddon align="inline-end">
												<InputGroupButton
													variant="ghost"
													size="icon-sm"
													onClick={() => setShowPassword(!showPassword)}
													type="button"
												>
													{showPassword ? (
														<Eye className="h-4 w-4" />
													) : (
														<EyeOff className="h-4 w-4" />
													)}
												</InputGroupButton>
											</InputGroupAddon>
										</InputGroup>
										{fieldState.invalid && (
											<FieldError errors={[fieldState.error]} />
										)}
									</Field>
								)}
							/>

							<Field>
								<Button disabled={loading} type="submit">
									{loading ? <Loader className="animate-spin" /> : null}
									Continuer avec l&apos;e-mail
								</Button>

								<FieldDescription className="text-muted-foreground text-sm">
									En cliquant sur continuer, vous acceptez nos{" "}
									<Link
										className="underline underline-offset-4 hover:text-primary"
										href="/donneeEtConfidentialite"
									>
										Politique de confidentialité
									</Link>
								</FieldDescription>
							</Field>
						</FieldGroup>
					</form>
					<AuthDivider>Ou</AuthDivider>
					<div className="space-y-2">
						<SignInSocialButton form="flex" variant="default" text="Continuer avec" />
					</div>

					<p className="mt-8 mx-auto text-center text-muted-foreground text-sm">
						Vous avez déjà un compte?{" "}
						<Link
							className="underline underline-offset-4 hover:text-primary"
							title="s'identifier"
							href="/sign-in"
						>
							Identifiez-vous
						</Link>
					</p>
				</div>
			</div>
		</main>
	);
}
