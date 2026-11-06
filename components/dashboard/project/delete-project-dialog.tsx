"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { AlertTriangle, Check, Circle, Download, Loader2 } from "lucide-react";
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

type DeletionStep = "billing" | "whatsapp" | "media";

const DELETION_STEPS: Array<{ id: DeletionStep | "data"; label: string }> = [
  { id: "billing", label: "Abonnement résilié" },
  { id: "whatsapp", label: "Connexion WhatsApp supprimée" },
  { id: "media", label: "Fichiers supprimés" },
  { id: "data", label: "Données du projet effacées" },
];

/** Suppression commencée puis interrompue : étape restante, si le serveur l'a dite. */
type Interrupted = { step: DeletionStep | null; message: string };

export function DeleteProjectDialog({
  project,
  recentLogin,
  onClose,
}: {
  project: { id: string; name: string; deletionPending?: boolean };
  /** Faux dès que la connexion dépasse 10 minutes, même dialogue ouvert. */
  recentLogin: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [exports, setExports] = useState<
    Partial<Record<"csv" | "xlsx", string>>
  >({});
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);
  const [error, setError] = useState("");
  const [interrupted, setInterrupted] = useState<Interrupted | null>(
    project.deletionPending
      ? {
          step: null,
          message:
            "La suppression de ce projet a commencé mais n’est pas terminée. Les envois sont bloqués. Terminez-la pour effacer ce qui reste.",
        }
      : null,
  );
  const [serverReauth, setServerReauth] = useState(false);
  // Le serveur reste juge : son refus compte même si l’horloge locale dit le contraire.
  const reauthRequired = serverReauth || !recentLogin;
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
  const busy =
    form.formState.isSubmitting || reconnecting || exporting !== null;

  async function download(format: "csv" | "xlsx") {
    if (busy) return;
    setExporting(format);
    setError("");
    try {
      const response = await fetch(
        "/api/projects/" +
          encodeURIComponent(project.id) +
          "/export?format=" +
          format +
          "&deletion=1",
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error();
      const receipt = response.headers.get("X-Export-Receipt");
      if (!receipt) throw new Error();
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "contacts-" + project.id + "." + format;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      setExports((previous) => ({ ...previous, [format]: receipt }));
      toast.success(`Téléchargement ${format === "csv" ? "CSV" : "Excel"} lancé. Vérifiez le fichier avant de supprimer.`);
    } catch {
      setError(
        "Export impossible. Vos données sont conservées. Réessayez avant de supprimer le projet.",
      );
    } finally {
      setExporting(null);
    }
  }

  async function reconnect() {
    setReconnecting(true);
    setError("");
    try {
      const result = await signOut();
      if (result.error) throw new Error("SIGN_OUT_FAILED");
      const callback =
        "/projects/" + encodeURIComponent(project.id) + "/settings";
      router.replace("/sign-in?callbackUrl=" + encodeURIComponent(callback));
      router.refresh();
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
      if (!exports.csv || !exports.xlsx) {
        setError("Téléchargez les deux sauvegardes avant de continuer.");
        return;
      }
      const result = await deleteProjectAction({
        csvReceipt: exports.csv,
        xlsxReceipt: exports.xlsx,
        projectId: project.id,
        ...values,
      });
      if (!result.success && result.code === "DELETION_PENDING") {
        setInterrupted({
          step: (result.step as DeletionStep | undefined) ?? null,
          message: result.error || "La suppression n’a pas pu être terminée.",
        });
        router.refresh();
        return;
      }
      if (!result.success) {
        setError(result.error || "La suppression a échoué.");
        setServerReauth(result.code === "REAUTH_REQUIRED");
        if (result.code === "EXPORT_REQUIRED") setExports({});
        return;
      }
      toast.success("Projet supprimé.");
      router.push("/projects");
      router.refresh();
      onClose();
    } catch {
      // La requête a pu aller au bout côté serveur : on propose de terminer,
      // ce qui est sans risque (chaque étape est idempotente).
      setInterrupted({
        step: null,
        message:
          "La connexion a été interrompue avant la fin. La suppression a peut-être commencé : terminez-la pour être sûr que tout est effacé.",
      });
      router.refresh();
    }
  });
  const failedIndex = interrupted?.step
    ? DELETION_STEPS.findIndex((step) => step.id === interrupted.step)
    : -1;

  return (
    <AlertDialog
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose();
      }}
    >
      <AlertDialogContent className="max-h-dvh overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {interrupted
              ? `Terminer la suppression de ${project.name}`
              : `Supprimer ${project.name} ?`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            L’abonnement, l’instance WhatsApp et les données seront supprimés
            définitivement.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {interrupted && (
          <section
            role="status"
            aria-label="État de la suppression"
            className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm"
          >
            <p className="font-medium">Suppression commencée, pas encore terminée</p>
            <p className="text-muted-foreground">{interrupted.message}</p>
            {interrupted.step && (
              <ul className="space-y-1.5">
                {DELETION_STEPS.map((step, index) => {
                  const state =
                    index < failedIndex ? "done" : index === failedIndex ? "failed" : "todo";
                  const Icon = state === "done" ? Check : state === "failed" ? AlertTriangle : Circle;
                  return (
                    <li
                      key={step.id}
                      className={
                        state === "todo"
                          ? "flex items-center gap-2 text-muted-foreground"
                          : state === "failed"
                            ? "flex items-center gap-2 text-destructive"
                            : "flex items-center gap-2"
                      }
                    >
                      <Icon aria-hidden className="size-4 shrink-0" />
                      {step.label}
                      <span className="sr-only">
                        {state === "done" ? " : fait" : state === "failed" ? " : à reprendre" : " : à faire"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
        <form onSubmit={submit} className="space-y-5">
          <section
            className="space-y-3 rounded-lg border bg-muted/40 p-4"
            aria-label="Sauvegarde des contacts"
          >
            <p className="text-sm font-medium">1. Sauvegardez vos contacts</p>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Téléchargez les deux formats et vérifiez que les fichiers sont
              bien enregistrés avant de confirmer. Ils contiennent tous les
              contacts, sans les conversations.
            </p>
            <div className="flex flex-wrap gap-2">
              {(["csv", "xlsx"] as const).map((format) => (
                <Button
                  key={format}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy || reauthRequired}
                  onClick={() => void download(format)}
                >
                  {exporting === format ? (
                    <Loader2 aria-hidden className="animate-spin" />
                  ) : exports[format] ? (
                    <Check aria-hidden />
                  ) : (
                    <Download aria-hidden />
                  )}
                  {format === "csv" ? "Télécharger CSV" : "Télécharger Excel"}
                </Button>
              ))}
            </div>
          </section>
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
              Votre connexion date maintenant de plus de 10 minutes.
              Reconnectez-vous : vous reviendrez aux réglages du projet pour
              recommencer la suppression.
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
              <Button
                type="submit"
                variant="destructive"
                disabled={busy || !exports.csv || !exports.xlsx}
              >
                {busy && (
                  <Loader2 aria-hidden className="size-4 animate-spin" />
                )}
                {interrupted ? "Terminer la suppression" : "Supprimer définitivement"}
              </Button>
            )}
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
