import posthog from "posthog-js";

import { googleSignUpReturn, visitCampaign } from "@/lib/auth-analytics";
import { signIn } from "@/lib/auth-client";
import { useHaptics } from "@/lib/webHaptics";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { GoogleIcon } from "../social-icon";
import { safeAuthCallback } from "@/lib/auth-redirects";

/** Connexion Google, seul fournisseur social de l'application. */
export function SignInSocialButton({
  variant = "outline",
  text,
  callbackUrl = "/projects",
}: {
  variant?: "outline" | "default";
  text?: string;
  callbackUrl?: string;
}) {
  const { playHaptic } = useHaptics();
  async function signInWithGoogle() {
    const callbackURL = safeAuthCallback(callbackUrl);
    // Campagne d'arrivée (pub Meta) : PostHog l'oublie pendant l'aller-retour
    // chez Google, elle repart donc dans l'adresse de retour d'un nouveau compte.
    const campaign = visitCampaign(window.location.search);
    // Envoyé tout de suite : la page part chez Google juste après.
    posthog.capture(
      "google_auth_started",
      { page: window.location.pathname, ...campaign },
      { send_instantly: true },
    );
    await signIn.social(
      {
        provider: "google",
        callbackURL,
        // Nouveau compte seulement : compté au retour par SiteAnalyticsBeacon.
        newUserCallbackURL: googleSignUpReturn(callbackURL, campaign),
      },
      {
        onError: (error) => {
          playHaptic("error");
          toast.error("Une erreur s'est produite.", {
            description:
              error.error.message ||
              "Quelque chose s'est mal passé. Veuillez réessayer.",
            position: "top-center",
            className: "text-muted-foreground text-sm bg-card",
            action: {
              label: "Réessayer",
              onClick: () => void signInWithGoogle(),
            },
          });
        },
      },
    );
  }
  return (
    <Button
      onClick={() => void signInWithGoogle()}
      variant={variant}
      type="button"
      className="w-full"
    >
      <GoogleIcon data-icon="inline-start" />
      {text} Google
    </Button>
  );
}
