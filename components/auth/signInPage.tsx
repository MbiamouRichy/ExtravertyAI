"use client"
import { Button } from "@/components/ui/button";
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
import { AuthDivider } from "@/components/dashboard/auth-divider";
import { ArrowLeft, AtSignIcon, Eye, EyeOff, KeySquareIcon, Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useHaptics } from "@/lib/webHaptics";
import Link from "next/link";
import { useState } from "react";
import * as z from "zod"
import { toast } from "sonner";
import { signIn } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { Checkbox } from "../ui/checkbox";
import { SignInSocialButton } from "./signInSocialButton";
import { LogoIcon } from "../logo";
import { AuthShowcase } from "./auth-showcase";
import { signUpHref } from "@/lib/auth-redirects";

const formSchema = z.object({
	email: z.string().email("Entrer une adresse email valide."),
	password: z
		.string()
		.min(8, "Le mot de passe doit contenir au moins 8 caractères.")
		.max(256, "Le mot de passe doit contenir au maximum 256 caractères."),
});


export function AuthPage({ callbackUrl }: { callbackUrl: string }) {
	const router = useRouter();
	const { playHaptic } = useHaptics();
	const [loading, setLoading] = useState<boolean>(false);
	const [showPassword, setShowPassword] = useState(false);
	const [checked, setChecked] = useState(false);

	const form = useForm<z.infer<typeof formSchema>>({
		resolver: zodResolver(formSchema),
		mode: "onChange",
		defaultValues: {
			email: "",
			password: "",
		},
	});

	async function onSubmit(data: z.infer<typeof formSchema>) {
		setLoading(true);
		try {
			await signIn.email(
				{
					email: data.email,
					password: data.password,
					rememberMe: checked,
				},
				{
					onSuccess: () => {
						playHaptic("success");
						toast.success("Connexion réussie.", {
							position: "top-center",
						});
						router.push(callbackUrl);
						form.reset()
					},
					onError: () => {
						// Message unifié : ne révèle pas si le compte existe.
						playHaptic("error");
						toast.error("Échec de l'authentification", {
							description: (
								<p className="text-muted-foreground text-sm">
									Email ou mot de passe incorrect. Veuillez réessayer.
								</p>
							),
							position: "top-center",
						});
					},
				}
			);
		} catch {
			// Une panne réseau ne doit pas bloquer l'interface.
			playHaptic("error");
			toast.error("Erreur inattendue", {
				description: "Veuillez vérifier votre connexion internet et réessayer.",
				position: "top-center",
			});
		} finally {
			setLoading(false);
		}
	}
	return (
		<main className="grid min-h-dvh lg:grid-cols-2">
			<div className="flex flex-col px-4 py-6 sm:px-10">
				<div className="flex items-center justify-between">
					<Link
						href="/"
						className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						<LogoIcon LogoClassName="w-6" className="gap-1.5" />
						<span className="sr-only">Retour à l’accueil</span>
					</Link>
					<Button asChild variant="ghost" size="sm">
						<Link href="/">
							<ArrowLeft data-icon="inline-start" />
							Accueil
						</Link>
					</Button>
				</div>

				<div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
					<h1 className="text-3xl md:text-4xl">Bon retour</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						Connectez-vous pour retrouver vos conversations.
					</p>

					<div className="mt-8">
						<SignInSocialButton callbackUrl={callbackUrl} text="Continuer avec" form="flex" />
					</div>

					<div className="my-6">
						<AuthDivider>ou avec votre e-mail</AuthDivider>
					</div>

					<form noValidate aria-busy={loading} onSubmit={form.handleSubmit(onSubmit)}>
						<FieldGroup className="gap-5">
							<Controller
								name="email"
								control={form.control}
								render={({ field, fieldState }) => (
									<Field data-invalid={fieldState.invalid}>
										<FieldLabel htmlFor={field.name}>Email</FieldLabel>
										<InputGroup>
											<InputGroupInput
												type="email"
												inputMode="email"
												autoComplete="email"
												{...field}
												id={field.name}
												aria-invalid={fieldState.invalid}
												disabled={loading}
												placeholder="vous@entreprise.com"
											/>
											<InputGroupAddon align="inline-start">
												<AtSignIcon />
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
										<div className="flex w-full items-center justify-between">
											<FieldLabel htmlFor={field.name}>Mot de passe</FieldLabel>
											<Link
												href="/forget-password"
												className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
											>
												Mot de passe oublié ?
											</Link>
										</div>
										<InputGroup>
											<InputGroupInput
												{...field}
												id={field.name}
												aria-invalid={fieldState.invalid}
												disabled={loading}
												placeholder="••••••••"
												autoComplete="current-password"
												type={showPassword ? "text" : "password"}
											/>
											<InputGroupAddon align="inline-start">
												<KeySquareIcon />
											</InputGroupAddon>
											<InputGroupAddon align="inline-end">
												<InputGroupButton
													variant="ghost"
													size="icon-xs"
													aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
													aria-pressed={showPassword}
													onClick={() => setShowPassword(!showPassword)}
													type="button"
												>
													{showPassword ? <EyeOff /> : <Eye />}
												</InputGroupButton>
											</InputGroupAddon>
										</InputGroup>
										{fieldState.invalid && (
											<FieldError errors={[fieldState.error]} />
										)}
									</Field>
								)}
							/>

							<Field orientation="horizontal">
								<Checkbox
									id="remember-me"
									checked={checked}
									disabled={loading}
									onCheckedChange={(value) => setChecked(value === true)}
								/>
								<FieldLabel htmlFor="remember-me" className="font-normal">
									Rester connecté sur cet appareil
								</FieldLabel>
							</Field>

							<Button disabled={loading} type="submit" size="lg" className="w-full">
								{loading && <Loader className="animate-spin" aria-hidden="true" />}
								{loading ? "Connexion…" : "Se connecter"}
							</Button>
						</FieldGroup>
					</form>

					<p className="mt-8 text-center text-sm text-muted-foreground">
						Pas encore de compte ?{" "}
						<Link
							className="font-medium text-foreground underline underline-offset-4"
							href={signUpHref(callbackUrl)}
						>
							Démarrer l’essai gratuit
						</Link>
					</p>
				</div>

				<p className="text-center text-xs text-muted-foreground">
					En continuant, vous acceptez notre{" "}
					<Link href="/donneesEtConfidentialite" className="underline underline-offset-4">
						politique de confidentialité
					</Link>
					.
				</p>
			</div>

			<AuthShowcase />
		</main>
	);
}
