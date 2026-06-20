import { signIn } from "@/lib/auth-client";
import { useHaptics } from "@/lib/webHaptics";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { GoogleIcon, TiktokIcon } from "./social-icon";
type providerType = Parameters<typeof signIn.social>[0]["provider"];

export function SignInSocialButton({variant: variant = "outline", form: form= "grid", text}: {variant?: "outline" | "default", form?: "grid" | "flex", text?: string}) {
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
                SignInSocial(provider);
              },
            },
          });
        },
      },
    );
  }
  return (
    <div className={`gap-2 space-y-2 ${form === "flex" ? "flex flex-col" : "grid grid-cols-2"}`}>
      <Button
        onClick={() => SignInSocial("google")}
        variant={variant}
        type="button"
      >
        <GoogleIcon data-icon="inline-start"/>
        {text} Google
      </Button>
      <Button
        onClick={() => SignInSocial("tiktok")}
        variant={variant}
        type="button"
      >
        <TiktokIcon data-icon="inline-start" />
        {text} Tiktok
      </Button>
    </div>
  );
}

