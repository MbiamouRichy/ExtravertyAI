import { signIn } from "@/lib/auth-client";
import { useHaptics } from "@/lib/webHaptics";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { GoogleIcon } from "./google-icon";
import { FacebookIcon } from "./contact";
type providerType = Parameters<typeof signIn.social>[0]["provider"];

export function SignInSocialButton() {
  const { playHaptic } = useHaptics();
  async function SignInSocial(provider: providerType) {
    await signIn.social(
      {
        provider: provider,
        callbackURL: "/dashboard",
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
              onClick: () => {
                SignInSocial("google");
              },
            },
          });
        },
      },
    );
  }
  return (
    <div className="grid grid-cols-2 gap-2 space-y-2">
      <Button
        onClick={() => SignInSocial("google")}
        variant="outline"
        type="button"
      >
        <GoogleIcon data-icon="inline-start"/>
        Google
      </Button>
      <Button
        onClick={() => SignInSocial("facebook")}
        variant="outline"
        type="button"
      >
        <FacebookIcon data-icon="inline-start" />
        Facebook
      </Button>
    </div>
  );
}
