"use client"
import { Button } from "@/components/ui/button";
import { AuthDivider } from "@/components/dashboard/auth-divider";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import posthog from "posthog-js";
import { InAppBrowserNotice } from "./in-app-browser-notice";
import { SignInSocialButton } from "./signInSocialButton";
import { EmailOtpStep, type CodePurpose } from "./email-otp-step";
import { CodeSignInForm, PasswordSignInForm } from "./sign-in-forms";
import { LogoIcon } from "../logo";
import { AuthShowcase } from "./auth-showcase";
import { signUpHref } from "@/lib/auth-redirects";
import { enterSignedInApp } from "@/lib/auth-navigation";
import type { InAppBrowser } from "@/lib/in-app-browser";
import {
	clearPendingCode,
	deviceStorage,
	readPendingCode,
	rememberPendingCode,
} from "@/lib/pending-code";

export function AuthPage({
	callbackUrl,
	inAppBrowser = null,
}: {
	callbackUrl: string;
	/** Navigateur intégré (Facebook, Instagram…) : pas de bouton Google. */
	inAppBrowser?: InAppBrowser | null;
}) {
	// Passwordless by default, like most modern products; the password stays one click away.
	const [method, setMethod] = useState<"code" | "password">("code");
	// Typed address, carried from one method to the other.
	const [email, setEmail] = useState("");
	// Focus follows an explicit switch, never the first page load (it would
	// open the mobile keyboard over the page).
	const [switched, setSwitched] = useState(false);
	const [pending, setPending] = useState<{
		email: string;
		purpose: CodePurpose;
		sentAt: number;
	} | null>(null);

	// Retour depuis l’application mail après un rechargement : l’étape du code
	// reprend, sans nouvel envoi. Lu après l’hydratation.
	useEffect(() => {
		const draft = readPendingCode(deviceStorage(), "sign-in");
		if (!draft || draft.purpose === "sign-up") return;
		// eslint-disable-next-line react-hooks/set-state-in-effect -- brouillon lu une fois, après l’hydratation
		setPending({ email: draft.email, purpose: draft.purpose, sentAt: draft.sentAt });
		posthog.capture("auth_code_step_restored", { page: "sign-in" });
	}, []);

	function startCode(email: string, purpose: Exclude<CodePurpose, "sign-up">) {
		const { sentAt } = rememberPendingCode(deviceStorage(), { flow: "sign-in", email, purpose });
		setPending({ email, purpose, sentAt });
	}

	function switchTo(next: "code" | "password", typed: string) {
		setEmail(typed.trim());
		setSwitched(true);
		setMethod(next);
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

				<div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-8 sm:py-12 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
					{pending ? (
						<EmailOtpStep
							email={pending.email}
							purpose={pending.purpose}
							sentAt={pending.sentAt}
							onResent={() => {
								const { sentAt } = rememberPendingCode(deviceStorage(), {
									flow: "sign-in",
									email: pending.email,
									purpose: pending.purpose,
								});
								setPending({ ...pending, sentAt });
							}}
							onVerified={() => {
								clearPendingCode(deviceStorage());
								return enterSignedInApp(callbackUrl);
							}}
							onChangeEmail={() => {
								clearPendingCode(deviceStorage());
								setEmail(pending.email);
								setSwitched(true);
								setPending(null);
							}}
							changeEmailLabel={
								pending.purpose === "sign-in" ? "Modifier l’adresse" : "Retour à la connexion"
							}
						/>
					) : (
					<>
					<h1 className="text-3xl md:text-4xl">Bon retour</h1>
					<p className="mt-2 text-sm text-muted-foreground">
						Connectez-vous pour retrouver vos conversations.
					</p>

					{/* Google refuse la connexion dans un navigateur intégré :
					    l’e-mail passe en premier, Google par le vrai navigateur. */}
					{!inAppBrowser && (
						<>
							<div className="mt-6 sm:mt-8">
								<SignInSocialButton callbackUrl={callbackUrl} text="Continuer avec" />
							</div>

							<div className="my-5 sm:my-6">
								<AuthDivider>ou avec votre e-mail</AuthDivider>
							</div>
						</>
					)}

					<div className={inAppBrowser ? "mt-6 sm:mt-8" : undefined}>
					{method === "code" ? (
						<CodeSignInForm
							defaultEmail={email}
							autoFocus={switched}
							onCodeSent={(address) => startCode(address, "sign-in")}
							onUsePassword={(typed) => switchTo("password", typed)}
						/>
					) : (
						<PasswordSignInForm
							defaultEmail={email}
							callbackUrl={callbackUrl}
							onUnverified={(address) => startCode(address, "email-verification")}
							onUseCode={(typed) => switchTo("code", typed)}
						/>
					)}
					</div>

					{inAppBrowser && (
						<>
							<div className="my-5 sm:my-6">
								<AuthDivider>ou</AuthDivider>
							</div>
							<InAppBrowserNotice browser={inAppBrowser} page="sign-in" />
						</>
					)}

					<p className="mt-6 text-center text-sm text-muted-foreground sm:mt-8">
						Pas encore de compte ?{" "}
						<Link
							className="font-medium text-foreground underline underline-offset-4"
							href={signUpHref(callbackUrl)}
						>
							Démarrer l’essai gratuit
						</Link>
					</p>
					</>
					)}
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
