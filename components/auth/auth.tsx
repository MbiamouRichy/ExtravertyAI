"use client"
import { cn } from "@/lib/utils";
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
import { AuthDivider } from "@/components/dashboard/auth-divider";
import { DecorIcon } from "@/components/decor-icon";
import { AtSignIcon, Eye, EyeOff, KeySquareIcon, Loader } from "lucide-react";
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

const formSchema = z.object({
	email: z.string().email("Entrer une adresse email valide."),
	password: z
		.string()
		.min(8, "Le mot de passe doit contenir au moins 8 caractères.")
		.max(15, "Le mot de passe doit contenir au maximum 15 caractères."),
});


export function AuthPage() {
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
		await signIn.email(
			{
				email: data.email as string,
				password: data.password as string,
				rememberMe: checked,
			},
			{
				onSuccess: () => {
					playHaptic("success");

					toast.success("Connexion réussie.", {
						position: "top-center",
					});
					router.push("/dashboard");
				},
				onError: (error) => {
					let errorMessage = "";
					if (error.error.message === "User not found") {
						errorMessage =
							"Utilisateur non trouvé. Veuillez vérifier votre adresse e-mail.";
					} else if (error.error.message === "Invalid email or password") {
						errorMessage =
							"Nom d'utilisateur ou mot de passe incorrect. Veuillez réessayer.";
					} else {
						errorMessage = "Quelque chose s'est mal passé. Veuillez réessayer.";
					}

					playHaptic("error");
					toast.error("Une erreur s'est produite.", {
						description: (
							<p className="text-muted-foreground text-sm">{errorMessage}</p>
						),
						position: "top-center",
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
	}
	return (
		<div className="relative flex h-screen w-full items-center justify-center overflow-hidden px-6 md:px-8">
			<div
				className={cn(
					"relative flex w-full max-w-sm flex-col justify-between p-6 md:p-8",
					"dark:bg-[radial-gradient(50%_80%_at_20%_0%,--theme(--color-foreground/.1),transparent)]"
				)}
			>
				<div className="absolute -inset-y-6 -left-px w-px bg-border" />
				<div className="absolute -inset-y-6 -right-px w-px bg-border" />
				<div className="absolute -inset-x-6 -top-px h-px bg-border" />
				<div className="absolute -inset-x-6 -bottom-px h-px bg-border" />
				<DecorIcon position="top-left" />
				<DecorIcon position="bottom-right" />

				<div className="w-full max-w-sm animate-in space-y-8">
					<div className="flex flex-col space-y-1">
						<h1 className="font-bold text-2xl tracking-wide">Rejoignez-nous!</h1>
						<p className="text-base text-muted-foreground">
							Connectez-vous à votre compte ExtravertyAI.
						</p>
					</div>
					<div className="space-y-4">
						<form id="signIn-Form" onSubmit={form.handleSubmit(onSubmit)}>
							<FieldGroup className="gap-4">
								<Controller
									name="email"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field data-invalid={fieldState.invalid}>
											<FieldLabel htmlFor={field.name}>Email</FieldLabel>
											<InputGroup>
												<InputGroupInput
													type="email"
													{...field}
													id={field.name}
													aria-invalid={fieldState.invalid}
													placeholder="votre.email@example.com"
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
											<div className="flex flex-row w-full items-center justify-between">
												<FieldLabel htmlFor={field.name}>Mot de passe</FieldLabel>
												<Link
													href="/forget-password"
													className="text-sm text-muted-foreground underline focus-visible:underline"
												>
													Mot de passe oublié?
												</Link>
											</div>
											<InputGroup>
												<InputGroupInput
													{...field}
													id={field.name}
													aria-invalid={fieldState.invalid}
													placeholder="Entrer le mot de passe."
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
															<Eye />
														) : (
															<EyeOff />
														)}</InputGroupButton>
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
										id="terms-checkbox-desc"
										name="terms-checkbox-desc"
										checked={checked}
										onCheckedChange={(value) => setChecked(value === true)}
									/>
									<FieldLabel htmlFor="terms-checkbox-desc">
										Se souvenir de moi
									</FieldLabel>
								</Field>

								<FieldGroup>
									<Field>
										<Button disabled={loading} type="submit" id="signIn-Form">
											{loading ? <Loader className="animate-spin" /> : null}
											Se connecter
										</Button>

										{/* Se connecter avec Google */}

										<FieldDescription className="px-6 text-center">
											Vous n{`'`}avez pas de compte?{" "}
											<Link
												className="underline underline-offset-4 hover:text-primary"
												title="s'inscrire" href="/sign-up">
												Inscrivez-vous
											</Link>
										</FieldDescription>
									</Field>
								</FieldGroup>
							</FieldGroup>
						</form>
						<AuthDivider>Ou</AuthDivider>
						<SignInSocialButton />
					</div>
					<p className="text-muted-foreground text-sm">
						En continuant, vous acceptez notre{" "}
						<Link
							className="underline underline-offset-4 hover:text-primary"
							href="/donneesEtConfidentialite"
						>
							politique de confidentialité
						</Link>
						.
					</p>
				</div>
			</div>
		</div >
	);
}
