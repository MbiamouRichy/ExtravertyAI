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
import { AuthDivider } from "@/components/auth-divider";
import { DecorIcon } from "@/components/decor-icon";
import { Eye, EyeOff, Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useHaptics } from "@/lib/webHaptics";
import Link from "next/link";
import { useState } from "react";
import * as z from "zod"
import { toast } from "sonner";
import { signIn } from "@/lib/auth-client";
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { SignInSocialButton } from "./signInSocialButton";

const formSchema = z.object({
	email: z.string().email("Entrer une addresse email."),
	password: z
		.string()
		.min(8, "La mot de passe doit contenir au moins 8 caractères.")
		.max(10, "La mot de passe doit contenir au maximum 10 caractères."),
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
							Connectez-vous a votre compte ExtravertyAI.
						</p>
					</div>
					<div className="space-y-4">
						<form id="form-rhf-demo" onSubmit={form.handleSubmit(onSubmit)}>
							<FieldGroup className="gap-2">
								<Controller
									name="email"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field data-invalid={fieldState.invalid}>
											<FieldLabel htmlFor={field.name}>Email</FieldLabel>
											<Input
												{...field}
												id={field.name}
												aria-invalid={fieldState.invalid}
												placeholder="votre.email@example.com"
											/>

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
											<div className="relative w-full">
												<Input
													{...field}
													id={field.name}
													aria-invalid={fieldState.invalid}
													placeholder="Entrer le mot de passe."
													autoComplete="off"
													type={showPassword ? "text" : "password"}
												/>
												<Button
													variant="ghost"
													size="icon"
													onClick={() => setShowPassword(!showPassword)}
													className="absolute right-2 top-0 rounded-md p-0 data-[state=open]:bg-transparent"
													type="button"
												>
													{showPassword ? (
														<Eye className="h-4 w-4" />
													) : (
														<EyeOff className="h-4 w-4" />
													)}
												</Button>
											</div>

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
										<Button disabled={loading} type="submit" id="form-rhf-demo">
											{loading ? <Loader className="animate-spin" /> : null}
											Se connecter
										</Button>

										{/* Se connecter avec Google */}

										<FieldDescription className="px-6 text-center">
											Je n{`'`}ai pas de compte?{" "}
											<Link title="s'identifier" href="/inscription">
												S{`'`}incrire
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
		</div>
	);
}
