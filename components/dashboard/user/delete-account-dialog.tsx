"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { ArrowRight, Crown, Download, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { authClient } from "@/lib/auth-client";
import { isRecentSession } from "@/lib/recent-session";
import { useHaptics } from "@/lib/webHaptics";
import type { AccountDeletionPlan } from "@/lib/account-deletion";

export function DeleteAccountDialog({
  email,
  plan,
  sessionCreatedAt,
}: {
  email: string;
  plan: AccountDeletionPlan;
  sessionCreatedAt: string;
}) {
  const router = useRouter();
  const { playHaptic } = useHaptics();
  const [open, setOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [reauthRequired, setReauthRequired] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const busy = isDeleting || reconnecting;
  const blocked = plan.blockers.length > 0;

  const expected = email.trim().toLowerCase();
  const schema = z.object({
    confirmation: z
      .string()
      .trim()
      .min(1, "Saisissez votre adresse e-mail pour confirmer.")
      .refine((value) => value.toLowerCase() === expected, {
        message: "L’adresse ne correspond pas à celle de votre compte.",
      }),
  });
  type FormValues = z.infer<typeof schema>;
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { confirmation: "" },
  });

  const handleOpenChange = (next: boolean) => {
    if (busy) return;
    if (next) {
      setReauthRequired(!isRecentSession(sessionCreatedAt));
      form.reset({ confirmation: "" });
    }
    setOpen(next);
  };

  async function reconnect() {
    setReconnecting(true);
    try {
      const result = await authClient.signOut();
      if (result.error) throw new Error();
      router.replace(
        "/sign-in?callbackUrl=" + encodeURIComponent("/projects/user"),
      );
      router.refresh();
    } catch {
      toast.error("Impossible de vous déconnecter. Réessayez.");
      setReconnecting(false);
    }
  }

  const onSubmit = async () => {
    if (isDeleting) return;
    if (!isRecentSession(sessionCreatedAt)) {
      setReauthRequired(true);
      return;
    }
    setIsDeleting(true);
    try {
      const result = await authClient.deleteUser({ callbackURL: "/goodbye" });
      if (result.error) {
        const code = result.error.code || "";
        playHaptic("error");
        if (["REAUTH_REQUIRED", "SESSION_EXPIRED"].includes(code)) {
          setReauthRequired(true);
          toast.error("Reconnectez-vous avant de supprimer votre compte.");
        } else if (code === "OWNERSHIP_TRANSFER_REQUIRED") {
          toast.error(
            "Un projet partagé doit d’abord être transféré. La liste a été mise à jour.",
          );
          router.refresh();
        } else {
          toast.error(
            "Impossible de supprimer le compte. Vos données sont conservées ; réessayez.",
          );
        }
        return;
      }
      playHaptic("success");
      router.replace("/goodbye");
    } catch {
      toast.error(
        "Suppression non confirmée. Actualisez pour vérifier le résultat.",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" className="whitespace-nowrap shrink-0">
          <Trash2 aria-hidden />
          Supprimer mon compte
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
        {blocked ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Crown className="size-5" aria-hidden />
                Transférez d’abord vos projets partagés
              </AlertDialogTitle>
              <AlertDialogDescription>
                Vous êtes l’unique propriétaire de projets utilisés par
                d’autres membres. Pour ne pas supprimer le travail de votre
                équipe, nommez un nouveau propriétaire avant de supprimer votre
                compte.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <ul className="divide-y rounded-lg border">
              {plan.blockers.map((project) => (
                <li
                  key={project.id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {project.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {project.members} autre{project.members > 1 ? "s" : ""}{" "}
                      membre{project.members > 1 ? "s" : ""}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/projects/${project.id}/team`}>
                      Transférer
                      <ArrowRight data-icon="inline-end" aria-hidden />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Dans l’équipe du projet, ouvrez le menu d’un membre puis
              «&nbsp;Transférer la propriété&nbsp;».
            </p>
            <AlertDialogFooter>
              <AlertDialogCancel>Fermer</AlertDialogCancel>
            </AlertDialogFooter>
          </>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer définitivement votre compte&nbsp;?</AlertDialogTitle>
              <AlertDialogDescription>
                Cette action est <strong>irréversible</strong>. Voici ce qui
                sera supprimé.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <ul className="my-4 space-y-2 rounded-lg border bg-muted/40 p-4 text-sm">
              <li>
                <span className="font-medium">
                  {plan.deleted.length
                    ? `${plan.deleted.length} projet${plan.deleted.length > 1 ? "s" : ""} supprimé${plan.deleted.length > 1 ? "s" : ""}`
                    : "Aucun projet supprimé"}
                </span>
                {plan.deleted.length > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    — {plan.deleted.map((p) => p.name).join(", ")}&nbsp;:
                    conversations, contacts, médias, agent et abonnement.
                  </span>
                )}
              </li>
              {plan.left > 0 && (
                <li>
                  <span className="font-medium">
                    Accès retiré de {plan.left} projet{plan.left > 1 ? "s" : ""}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    d’autres équipes, qui restent intacts.
                  </span>
                </li>
              )}
              <li className="text-muted-foreground">
                Votre profil, vos connexions et toutes vos sessions.
              </li>
            </ul>

            {plan.deleted.length > 0 && (
              <section
                aria-labelledby="delete-account-export"
                className="mb-4 rounded-lg border p-4"
              >
                <h3
                  id="delete-account-export"
                  className="flex items-center gap-2 text-sm! font-medium! tracking-normal!"
                >
                  <Download aria-hidden className="size-4" />
                  Exportez vos contacts avant de partir
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ils ne pourront plus être récupérés après la suppression.
                </p>
                <ul className="mt-3 space-y-2">
                  {plan.deleted.map((project) => (
                    <li
                      key={project.id}
                      className="flex items-center justify-between gap-3"
                    >
                      <span className="min-w-0 truncate text-sm">
                        {project.name}
                      </span>
                      <span className="flex shrink-0 gap-2">
                        {(["csv", "xlsx"] as const).map((format) => (
                          <Button
                            key={format}
                            asChild
                            size="sm"
                            variant="outline"
                          >
                            <a
                              href={`/api/projects/${encodeURIComponent(project.id)}/export?format=${format}`}
                              download
                              aria-label={`Exporter les contacts de ${project.name} en ${format === "csv" ? "CSV" : "Excel"}`}
                            >
                              {format === "csv" ? "CSV" : "Excel"}
                            </a>
                          </Button>
                        ))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {reauthRequired ? (
              <p
                role="status"
                className="rounded-lg border bg-muted p-4 text-sm leading-relaxed"
              >
                Votre connexion date de plus de 10 minutes. Reconnectez-vous,
                puis confirmez à nouveau la suppression.
              </p>
            ) : (
              <FieldGroup>
                <Controller
                  name="confirmation"
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor="delete-account-confirmation">
                        Confirmez avec votre adresse e-mail
                      </FieldLabel>
                      <Input
                        {...field}
                        id="delete-account-confirmation"
                        type="email"
                        inputMode="email"
                        autoComplete="off"
                        spellCheck={false}
                        placeholder={email}
                        aria-invalid={fieldState.invalid}
                        disabled={busy}
                      />
                      <FieldDescription>
                        Tapez{" "}
                        <span className="font-medium text-foreground">{email}</span>
                        . Un e-mail de confirmation vous sera envoyé une fois la
                        suppression terminée.
                      </FieldDescription>
                      {fieldState.invalid && (
                        <FieldError errors={[fieldState.error]} />
                      )}
                    </Field>
                  )}
                />
              </FieldGroup>
            )}

            <AlertDialogFooter className="mt-6">
              <AlertDialogCancel type="button" disabled={busy}>
                Annuler
              </AlertDialogCancel>
              {reauthRequired ? (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={reconnect}
                >
                  {reconnecting && <Loader2 className="animate-spin" aria-hidden />}
                  {reconnecting ? "Reconnexion…" : "Se reconnecter"}
                </Button>
              ) : (
                <Button type="submit" variant="destructive" disabled={busy}>
                  {isDeleting && <Loader2 className="animate-spin" aria-hidden />}
                  {isDeleting ? "Suppression en cours…" : "Supprimer mon compte"}
                </Button>
              )}
            </AlertDialogFooter>
          </form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
