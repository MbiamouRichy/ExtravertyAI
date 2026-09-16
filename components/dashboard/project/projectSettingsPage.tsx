"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot,
  Settings2,
  Smartphone,
  Download,
  ShieldCheck,
  ArrowUpRight,
  Loader2,
  Check,
  RefreshCw,
  AlertTriangle,
  Trash2,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { AgentEditor } from "./agent-editor";
import type { ProjectSettingsView } from "@/lib/settings-types";
import {
  saveProjectPreferences,
  saveWhatsAppPreferences,
  openProjectBillingPortal,
} from "@/app/actions/project-settings";
import { deleteProjectAction } from "@/app/actions/projects";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

const field =
  "w-full rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:border-border focus:ring-2 focus:ring-ring/20";
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50";
const tabs = [
  { id: "agent", label: "Agent IA", icon: Bot },
  { id: "general", label: "Projet & utilisation", icon: Settings2 },
  { id: "whatsapp", label: "WhatsApp", icon: Smartphone },
  { id: "data", label: "Données & accès", icon: ShieldCheck },
] as const;
export default function ProjectSettingsPage({
  project: p,
}: {
  project: ProjectSettingsView;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<string>("agent");
  const [name, setName] = useState(p.name);
  const [paused, setPaused] = useState(p.automationPaused);
  const [whatsapp, setWhatsapp] = useState(p.whatsapp);
  const [settingsVersion, setSettingsVersion] = useState(p.settingsVersion);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [confirmationName, setConfirmationName] = useState("");
  const owner = p.role === "OWNER";
  useEffect(() => {
    if (!p.whatsapp.pending) return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [p.whatsapp.pending, router]);
  async function run(
    key: string,
    operation: () => Promise<{
      success: boolean;
      error?: string;
      version?: number;
    }>,
    message: string,
  ) {
    setPending(key);
    setError("");
    try {
      const result = await operation();
      if (!result.success) {
        setError(result.error || "L’opération a échoué.");
        return;
      }
      if (result.version !== undefined) setSettingsVersion(result.version);
      toast.success(message);
      router.refresh();
    } catch {
      setError(
        "La connexion a été interrompue. Actualisez pour vérifier le résultat.",
      );
    } finally {
      setPending("");
    }
  }
  async function billing() {
    setPending("billing");
    setError("");
    try {
      const result = await openProjectBillingPortal(p.id);
      if (result.success) window.location.assign(result.url);
      else setError(result.error);
    } catch {
      setError("Le portail de facturation est indisponible.");
    } finally {
      setPending("");
    }
  }
  async function download(format: "csv" | "xlsx") {
    setPending(format);
    setError("");
    try {
      const response = await fetch(
        `/api/projects/${p.id}/export?format=${format}`,
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Export indisponible.");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `contacts-${p.id}.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Votre export est prêt.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export indisponible.");
    } finally {
      setPending("");
    }
  }
  return (
    <main className="mx-auto w-full max-w-7xl space-y-8 px-4 py-7 sm:px-8 lg:py-10">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Espace de configuration
          </p>
          <h1 className="text-3xl! font-semibold tracking-tight">
            Les réglages de {p.name}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Votre agent, votre équipe, votre façon de travailler.
          </p>
        </div>
        <Link href={`/projects/${p.id}/chat`} className={button}>
          <MessageSquare className="size-4" /> Ouvrir le chat{" "}
          <ArrowUpRight className="size-4" />
        </Link>
      </header>
      {p.deletionPending && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          La suppression a commencé. Les envois sont bloqués. Terminez la
          suppression dans « Données & accès » pour confirmer le nettoyage.
        </div>
      )}
      <div className="grid gap-7 lg:grid-cols-[210px_minmax(0,1fr)]">
        <nav
          aria-label="Sections des paramètres"
          className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible"
        >
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setTab(item.id);
                setError("");
              }}
              aria-current={tab === item.id ? "page" : undefined}
              className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-medium ${tab === item.id ? "bg-muted text-foreground dark:bg-muted/50 dark:text-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <item.icon className="size-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 space-y-6">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            >
              {error}
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="ml-3 underline underline-offset-4"
              >
                Recharger les réglages
              </button>
            </div>
          )}
          {tab === "agent" && (
            <AgentEditor
              key={p.agentConfigVersion}
              projectId={p.id}
              projectName={p.name}
              initial={p.config}
              version={p.agentConfigVersion}
            />
          )}
          {tab === "general" && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(
                    "general",
                    () =>
                      saveProjectPreferences({
                        projectId: p.id,
                        expectedVersion: settingsVersion,
                        name,
                        automationPaused: paused,
                      }),
                    "Les paramètres du projet sont enregistrés.",
                  );
                }}
                className="space-y-6 rounded-2xl border bg-card p-5 sm:p-7"
              >
                <div>
                  <h2 className="text-lg font-semibold">Votre projet</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Les informations partagées dans votre espace de travail.
                  </p>
                </div>
                <div>
                  <label
                    htmlFor="project-name"
                    className="mb-2 block text-sm font-medium"
                  >
                    Nom du projet
                  </label>
                  <input
                    id="project-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    minLength={2}
                    maxLength={100}
                    required
                    className={field}
                  />
                </div>
                <label className="flex items-start justify-between gap-5 border-y py-5">
                  <div>
                    <span className="text-sm font-medium">
                      Mettre l’automatisation en pause
                    </span>
                    <span className="mt-1 block max-w-lg text-xs leading-relaxed text-muted-foreground">
                      L’IA cesse de répondre. Les messages entrants et les
                      réponses manuelles restent disponibles. Votre abonnement
                      ne change pas.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={paused}
                    onChange={(e) => setPaused(e.target.checked)}
                    className="mt-1 size-5 shrink-0 accent-primary"
                  />
                </label>
                <button
                  disabled={!!pending || p.deletionPending}
                  className={`${button} bg-primary text-primary-foreground hover:bg-primary/90`}
                >
                  {pending === "general" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}{" "}
                  Enregistrer
                </button>
              </form>
              <section className="rounded-2xl border bg-card p-5 sm:p-7">
                <div className="mb-6 flex flex-wrap justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">Votre utilisation</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Offre <span className="capitalize">{p.plan}</span> ·{" "}
                      {p.periodEnd
                        ? `Fin de période le ${new Date(p.periodEnd).toLocaleDateString("fr-FR")}`
                        : "Période en attente de confirmation"}
                    </p>
                  </div>
                  {owner && (
                    <button
                      disabled={!!pending}
                      onClick={() => void billing()}
                      className={button}
                    >
                      {pending === "billing" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <ArrowUpRight className="size-4" />
                      )}{" "}
                      Gérer mon abonnement
                    </button>
                  )}
                </div>
                <div className="mb-3 flex justify-between gap-4 text-sm">
                  <span>Messages sortants réservés</span>
                  <strong>
                    {p.messageCount.toLocaleString("fr-FR")} /{" "}
                    {p.allMessagesCount.toLocaleString("fr-FR")}
                  </strong>
                </div>
                <progress
                  aria-label="Quota de messages consommé"
                  max={Math.max(p.allMessagesCount, 1)}
                  value={Math.min(
                    p.messageCount,
                    Math.max(p.allMessagesCount, 1),
                  )}
                  className="h-2 w-full overflow-hidden rounded-full accent-primary"
                />
                <div className="mt-7 grid grid-cols-3 gap-4 border-t pt-6">
                  {[
                    ["7 jours", p.stats.week],
                    ["30 jours", p.stats.month],
                    ["365 jours", p.stats.year],
                  ].map(([label, count]) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-2 text-2xl font-semibold">
                        {Number(count).toLocaleString("fr-FR")}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        messages envoyés
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
          {tab === "whatsapp" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(
                  "whatsapp",
                  () =>
                    saveWhatsAppPreferences({
                      projectId: p.id,
                      expectedVersion: settingsVersion,
                      alwaysOnline: whatsapp.alwaysOnline,
                      readMessages: whatsapp.readMessages,
                      typing: whatsapp.typing,
                    }),
                  "Réglages enregistrés. Synchronisation WhatsApp programmée.",
                );
              }}
              className="space-y-6 rounded-2xl border bg-card p-5 sm:p-7"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-semibold">
                    Votre connexion WhatsApp
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {p.numero} ·{" "}
                    {p.instanceStatus === "connected"
                      ? "Connectée"
                      : "À connecter"}
                  </p>
                </div>
                <Link href={`/projects/${p.id}/chat`} className={button}>
                  <Smartphone className="size-4" />{" "}
                  {p.instanceStatus === "connected"
                    ? "Voir les conversations"
                    : "Reconnecter"}
                </Link>
              </div>
              <div className="divide-y">
                {[
                  {
                    key: "alwaysOnline" as const,
                    title: "Afficher le statut en ligne",
                    text: "Garder votre compte visible comme étant en ligne sur WhatsApp.",
                  },
                  {
                    key: "readMessages" as const,
                    title: "Marquer les messages comme lus",
                    text: "Envoyer un accusé de lecture à la réception des messages.",
                  },
                  {
                    key: "typing" as const,
                    title: "Afficher l’indicateur de frappe",
                    text: "Afficher une courte présence de saisie avant les envois de l’application.",
                  },
                ].map((item) => (
                  <label
                    key={item.key}
                    className="flex items-start justify-between gap-5 py-5"
                  >
                    <div>
                      <span className="text-sm font-medium">{item.title}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                        {item.text}
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={whatsapp[item.key]}
                      onChange={(e) =>
                        setWhatsapp((current) => ({
                          ...current,
                          [item.key]: e.target.checked,
                        }))
                      }
                      className="mt-1 size-5 shrink-0 accent-primary"
                    />
                  </label>
                ))}
              </div>
              {p.whatsapp.pending && (
                <p
                  role="status"
                  className="rounded-xl bg-muted p-4 text-sm text-foreground dark:bg-muted/30 dark:text-foreground"
                >
                  {p.whatsapp.error
                    ? "La synchronisation n’a pas abouti. Le worker réessaiera automatiquement ; vérifiez la connexion WhatsApp si cela persiste."
                    : "Synchronisation en attente. Les workers appliqueront vos réglages."}
                </p>
              )}
              <div className="flex flex-wrap gap-3">
                <button
                  disabled={!!pending || p.deletionPending}
                  className={`${button} bg-primary text-primary-foreground hover:bg-primary/90`}
                >
                  {pending === "whatsapp" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Check className="size-4" />
                  )}{" "}
                  Enregistrer les réglages
                </button>
                <button
                  type="button"
                  onClick={() => router.refresh()}
                  className={button}
                >
                  <RefreshCw className="size-4" /> Actualiser l’état
                </button>
              </div>
            </form>
          )}
          {tab === "data" && (
            <>
              <section className="rounded-2xl border bg-card p-5 sm:p-7">
                <h2 className="text-lg font-semibold">
                  Vos données restent accessibles
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Exportez les contacts de ce projet. Les téléchargements sont
                  réservés aux propriétaires et administrateurs, dans la limite
                  de 10 000 contacts par export.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    disabled={!!pending}
                    onClick={() => void download("csv")}
                    className={button}
                  >
                    {pending === "csv" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}{" "}
                    Export CSV
                  </button>
                  <button
                    disabled={!!pending}
                    onClick={() => void download("xlsx")}
                    className={button}
                  >
                    {pending === "xlsx" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}{" "}
                    Export Excel
                  </button>
                  <Link href={`/projects/${p.id}/team`} className={button}>
                    Gérer les accès de l’équipe{" "}
                    <ArrowUpRight className="size-4" />
                  </Link>
                </div>
              </section>
              <section className="rounded-2xl border bg-card p-5 sm:p-7">
                <h2 className="text-lg font-semibold">
                  Dernières modifications
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Les changements de réglages sont enregistrés, sans copier les
                  instructions confidentielles dans le journal.
                </p>
                {p.audit.length ? (
                  <ul className="mt-5 divide-y">
                    {p.audit.map((item) => (
                      <li
                        key={item.id}
                        className="flex flex-wrap justify-between gap-2 py-3 text-sm"
                      >
                        <span>
                          {item.action === "agent.updated"
                            ? "Configuration de l’agent"
                            : item.action === "whatsapp.updated"
                              ? "Réglages WhatsApp"
                              : "Paramètres du projet"}
                        </span>
                        <time className="text-xs text-muted-foreground">
                          {new Date(item.createdAt).toLocaleString("fr-FR")}
                        </time>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-5 text-sm text-muted-foreground">
                    Aucune modification enregistrée pour le moment.
                  </p>
                )}
              </section>
              {owner && (
                <section className="flex flex-col justify-between gap-5 rounded-2xl border border-destructive/25 p-5 sm:flex-row sm:items-center sm:p-7">
                  <div>
                    <h2 className="flex items-center gap-2 font-semibold">
                      <AlertTriangle className="size-4 text-destructive" />{" "}
                      Supprimer ce projet
                    </h2>
                    <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                      Annule l’abonnement, supprime l’instance et les données du
                      projet. Cette action est définitive.
                    </p>
                  </div>
                  <button
                    onClick={() => setDeleting(true)}
                    className={`${button} shrink-0 border-destructive/30 text-destructive hover:bg-destructive/5`}
                  >
                    <Trash2 className="size-4" />{" "}
                    {p.deletionPending
                      ? "Terminer la suppression"
                      : "Supprimer"}
                  </button>
                </section>
              )}
            </>
          )}
        </div>
      </div>
      <AlertDialog
        open={deleting}
        onOpenChange={(value) => {
          if (!pending) setDeleting(value);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer {p.name} ?</AlertDialogTitle>
            <AlertDialogDescription>
              L’abonnement et l’instance WhatsApp seront supprimés avant les
              données. Recopiez le nom du projet pour confirmer cette action
              définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label htmlFor="delete-project-name" className="text-sm font-medium">
            Nom du projet : {p.name}
          </label>
          <input
            id="delete-project-name"
            value={confirmationName}
            onChange={(e) => setConfirmationName(e.target.value)}
            autoComplete="off"
            className={field}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!pending}>Annuler</AlertDialogCancel>
            <button
              disabled={!!pending || confirmationName !== p.name}
              onClick={() =>
                void run(
                  "delete",
                  async () => {
                    const result = await deleteProjectAction({
                      projectId: p.id,
                      confirmationName,
                    });
                    if (result.success) router.push("/projects");
                    return result;
                  },
                  "Projet supprimé.",
                )
              }
              className={`${button} border-destructive bg-destructive text-white hover:bg-destructive/90`}
            >
              {pending === "delete" && (
                <Loader2 className="size-4 animate-spin" />
              )}{" "}
              Supprimer définitivement
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
