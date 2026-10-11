"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { deleteProjectAction } from "@/app/actions/projects";
import { signOut } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
  FieldError,
} from "@/components/ui/field";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

export function DeleteProjectDialog({
  project,
  onClose,
}: {
  project: { id: string; name: string };
  onClose: () => void;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [reauthRequired, setReauthRequired] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const schema = z.object({
    confirmationName: z
      .string()
      .min(1, "Recopiez le nom du projet.")
      .max(100)
      .refine(
        (value) => value === project.name,
        "Le nom ne correspond pas au projet.",
      ),
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { confirmationName: "" },
  });
  const busy = form.formState.isSubmitting || reconnecting;

  async function reconnect() {
    setReconnecting(true);
    setError("");
    try {
      const result = await signOut();
      if (result.error) throw new Error("SIGN_OUT_FAILED");
      const callback =
        "/projects/" + encodeURIComponent(project.id) + "/settings";
      window.location.assign(
        "/sign-in?callbackUrl=" + encodeURIComponent(callback),
      );
    } catch {
      setError(
        "Impossible de vous déconnecter. Réessayez pour renouveler votre connexion.",
      );
      setReconnecting(false);
    }
  }

  const submit = form.handleSubmit(async (values) => {
    setError("");
    try {
      const result = await deleteProjectAction({
        projectId: project.id,
        ...values,
      });
      if (!result.success) {
        setError(result.error || "La suppression a échoué.");
        setReauthRequired(result.code === "REAUTH_REQUIRED");
        return;
      }
      toast.success("Projet supprimé.");
      router.push("/projects");
      router.refresh();
      onClose();
    } catch {
      setError(
        "La connexion a été interrompue. Actualisez pour vérifier le résultat.",
      );
    }
  });

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <AlertDialogContent className="max-h-dvh overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer {project.name} ?</AlertDialogTitle>
          <AlertDialogDescription>
            L’abonnement, l’instance WhatsApp et les données seront supprimés
            définitivement. Une connexion de moins de 10 minutes est requise.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form onSubmit={submit} className="space-y-5">
          <FieldGroup>
            <Controller
              control={form.control}
              name="confirmationName"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="delete-project-name">
                    Nom du projet
                  </FieldLabel>
                  <FieldDescription id="delete-project-help">
                    Recopiez « {project.name} » pour confirmer.
                  </FieldDescription>
                  <Input
                    {...field}
                    id="delete-project-name"
                    autoComplete="off"
                    spellCheck={false}
                    disabled={busy || reauthRequired}
                    aria-invalid={fieldState.invalid}
                    aria-describedby={
                      "delete-project-help" +
                      (fieldState.invalid ? " delete-project-error" : "")
                    }
                  />
                  {fieldState.invalid && (
                    <FieldError
                      id="delete-project-error"
                      errors={[fieldState.error]}
                    />
                  )}
                </Field>
              )}
            />
          </FieldGroup>
          {reauthRequired && (
            <p
              role="status"
              className="rounded-lg border border-border bg-muted p-4 text-sm"
            >
              Reconnectez-vous pour continuer. Vous reviendrez aux réglages du
              projet et devrez confirmer à nouveau sa suppression.
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={busy}>
              Annuler
            </AlertDialogCancel>
            {reauthRequired ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => void reconnect()}
              >
                {reconnecting && (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                )}
                Se reconnecter
              </Button>
            ) : (
              <Button type="submit" variant="destructive" disabled={busy}>
                {busy && (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                )}
                Supprimer définitivement
              </Button>
            )}
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
