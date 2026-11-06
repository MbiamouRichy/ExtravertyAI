"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import * as z from "zod";
import { AtSignIcon, ChevronLeftIcon, Loader, UserIcon } from "lucide-react";

import { addSignUpPasswordAction } from "@/app/actions/set-password";
import { AuthDivider } from "@/components/dashboard/auth-divider";
import { LogoIcon } from "@/components/logo";
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
import { emailOtp } from "@/lib/auth-client";
import { checkoutCallback, signInAfterSignUpHref } from "@/lib/auth-redirects";
import {
	accountNameSchema,
	SIGN_UP_INTENT,
	SIGN_UP_INTENT_HEADER,
} from "@/lib/sign-up";
import { useHaptics } from "@/lib/webHaptics";
import { AuthShowcase } from "./auth-showcase";
import { EmailOtpStep } from "./email-otp-step";
import { SignInSocialButton } from "./signInSocialButton";

const formSchema = z.object({
	name: accountNameSchema,
	email: z.string().trim().email("Entrez une adresse e-mail valide."),
});

type FormValues = z.infer<typeof formSchema>;

// Name and address only: the emailed code creates the account and opens the
// session; a password can be added on the code step, never required.
export function AuthPage({ callbackUrl }: { callbackUrl?: string }) {
	const signInHref = signInAfterSignUpHref(callbackUrl);
	// Every way in ends on the checkout or the projects, never on sign-in.
	const destination = checkoutCallback(callbackUrl) ?? "/projects";
	const router = useRouter();
	const { playHaptic } = useHaptics();
	const [loading, setLoading] = useState(false);
	// Same step for new and existing addresses: an existing one gets a sign-in
	// code instead, and the same screen signs it in.
	const [pending, setPending] = useState<FormValues | null>(null);

	const form = useForm<FormValues>({
		resolver: zodResolver(formSchema),
		defaultValues: { name: "", email: "" },
	});

	async function onSubmit(data: FormValues) {
		setLoading(true);
		try {
			const email = data.email.trim().toLowerCase();
			const { error } = await emailOtp.sendVerificationOtp(
				{ email, type: "sign-in" },
				{ headers: { [SIGN_UP_INTENT_HEADER]: SIGN_UP_INTENT } },
			);
			if (error) {
				playHaptic("error");
				toast.error("Le code n’a pas pu être envoyé.", {
					description:
						error.code === "TOO_MANY_CODES"
							? "Trop de codes demandés pour cette adresse. Réessayez dans une heure."
							: error.status === 429
								? "Trop de demandes. Patientez une minute avant de réessayer."
								: "Réessayez dans un instant.",
					position: "top-center",
				});
				return;
			}
			playHaptic("success");
			setPending({ name: data.name.trim(), email });
		} catch {
			playHaptic("error");
			toast.error("Erreur de connexion", {
				description: "Vérifiez votre connexion internet et réessayez.",
				position: "top-center",
			});
		} finally {
			setLoading(false);
		}
	}

	async function finish({ password }: { password?: string }) {
		if (password) {
			const result = await addSignUpPasswordAction({ newPassword: password });
			if (!result.success)
				toast(result.alreadySet ? "Mot de passe inchangé" : "Mot de passe non enregistré", {
					description: result.error,
					position: "top-center",
				});
		}
		router.replace(destination);
		router.refresh();
	}

	return (
		<main className="relative md:min-h-screen h-full overflow-x-hidden lg:grid lg:grid-cols-2">
			<AuthShowcase eyebrow="Essai gratuit · 10 jours" title="Votre assistant WhatsApp, prêt en quelques minutes." />
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
				<div className="mx-auto mb-8 flex w-full max-w-sm items-center justify-between">
					<Link
						href="/"
						className="rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
					>
						<LogoIcon LogoClassName="w-6" className="gap-1.5" />
						<span className="sr-only">Retour à l’accueil</span>
					</Link>
					<Button asChild variant="ghost" size="sm">
						<Link href="/">
							<ChevronLeftIcon data-icon="inline-start" />
							Accueil
						</Link>
					</Button>
				</div>

				{pending ? (
					<div className="mx-auto w-full max-w-sm">
						<EmailOtpStep
							purpose="sign-up"
							email={pending.email}
							name={pending.name}
							allowPassword
							onVerified={finish}
							onChangeEmail={() => {
								// Back to the form, with what was typed.
								form.reset(pending);
								setPending(null);
							}}
						/>
					</div>
				) : (
					<div className="mx-auto w-full max-w-sm space-y-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
						<header className="space-y-2">
							<h1 className="text-3xl md:text-4xl">Créer votre compte</h1>
							<p className="text-sm text-muted-foreground">
								Votre nom et votre e-mail suffisent. Nous vous envoyons un
								code pour confirmer l’adresse.
							</p>
						</header>

						<form
							id="form-inscription"
							noValidate
							aria-busy={loading}
							onSubmit={form.handleSubmit(onSubmit)}
						>
							<FieldGroup className="gap-5">
								<Controller
									name="name"
									control={form.control}
									render={({ field, fieldState }) => (
										<Field data-invalid={fieldState.invalid}>
											<FieldLabel htmlFor="sign-up-name">Nom</FieldLabel>
											<InputGroup>
												<InputGroupInput
													{...field}
													id="sign-up-name"
													type="text"
													autoComplete="name"
													autoFocus
													placeholder="Jean Dupont"
													disabled={loading}
													aria-invalid={fieldState.invalid}
												/>
												<InputGroupAddon align="inline-start">
													<UserIcon />
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
											<FieldLabel htmlFor="sign-up-email">E-mail</FieldLabel>
											<InputGroup>
												<InputGroupInput
													{...field}
													id="sign-up-email"
													type="email"
													inputMode="email"
													autoComplete="email"
													placeholder="vous@entreprise.com"
													disabled={loading}
													aria-invalid={fieldState.invalid}
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

								<Field>
									<Button disabled={loading} type="submit" size="lg" className="w-full">
										{loading && <Loader className="animate-spin" aria-hidden="true" />}
										{loading ? "Envoi du code…" : "Continuer"}
									</Button>
									<FieldDescription className="text-xs">
										En continuant, vous acceptez nos{" "}
										<Link className="underline underline-offset-4 hover:text-foreground" href="/conditions">
											conditions d’utilisation
										</Link>{" "}
										et notre{" "}
										<Link
											className="underline underline-offset-4 hover:text-foreground"
											href="/donneesEtConfidentialite"
										>
											politique de confidentialité
										</Link>
										.
									</FieldDescription>
								</Field>
							</FieldGroup>
						</form>

						<AuthDivider>ou</AuthDivider>
						<SignInSocialButton
							form="flex"
							variant="outline"
							text="Continuer avec"
							callbackUrl={destination}
						/>

						<p className="text-center text-sm text-muted-foreground">
							Déjà un compte ?{" "}
							<Link
								className="font-medium text-foreground underline underline-offset-4 hover:no-underline"
								href={signInHref}
							>
								Se connecter
							</Link>
						</p>
					</div>
				)}
			</div>
		</main>
	);
}
