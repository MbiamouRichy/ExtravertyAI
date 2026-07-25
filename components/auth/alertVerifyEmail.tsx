"use client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { authClient } from "@/lib/auth-client";
import { toast } from "sonner";
import { Loader } from "lucide-react";
import { useEffect, useState } from "react";


export default function AlertVerifyEmail({ email }: { email: string }) {
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0); // ⏱️ temps restant
  const [time, setTime] = useState(30); // ⏱️ temps d'attente initial en secondes

  // ⏱️ Décompte
  useEffect(() => {
    if (timer <= 0) return;

    const interval = setInterval(() => {
      setTimer((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [timer]);

  const resendVerificationEmail = async () => {
    if (timer > 0) return;
    setLoading(true);
    await authClient.sendVerificationEmail(
      {
        email: email,
        callbackURL: "/app",
      },
      {
        onSuccess: () => {
          toast.success("Email de vérification renvoyé.", {
            description: (
              <p className="text-muted-foreground text-sm">
                Un nouvel e-mail de vérification a été envoyé.
              </p>
            ),
            position: "top-center",
          });
          setTimer(time);
        },
        onError: () => {
          toast.error("L'envoi de l'e-mail de vérification a échoué.", {
            description: (
              <p className="text-muted-foreground text-sm">
                Une erreur s{`'`}est produite lors de l{`'`}envoi de l{`'`}
                e-mail de vérification. Veuillez réessayer.
              </p>
            ),
            position: "top-center",
            action: {
              label: "Réessayer",
              onClick: () => resendVerificationEmail(),
            },
          });
        },
      },
    );
    setLoading(false);
    // triple le temps d'attente pour la prochaine tentative
    setTime((prev) => prev * 3);
  };
  return (
    <AlertDialog open={true}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Veuillez vérifier votre adresse e-mail.
          </AlertDialogTitle>
          {email ? (
            <AlertDialogDescription>
              Un e-mail de vérification a été envoyé à{" "}
              <a
                className="text-primary hover:underline"
                href={`mailto:${email}`}
              >
                {email}
              </a>
              . Rendez vous dans votre boîte de réception d{`'`}e-mail et
              cliquer sur le lien de vérification contenu dans cet e-mail.
            </AlertDialogDescription>
          ) : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            disabled={loading || timer > 0}
            onClick={() => resendVerificationEmail()}
          >
            {loading ? <Loader className="animate-spin" /> : null}
            Renvoyer le lien
            {timer > 0 ? (
              <span className="ml-2 text-sm text-muted-foreground">
                {Math.floor(timer / 60)}:
                {(timer % 60).toString().padStart(2, "0")}
              </span>
            ) : null}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
