"use client";
import { LocalDate } from "@/components/local-date";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot,
  Pause,
  Play,
  Settings2,
  Smartphone,
  Download,
  ShieldCheck,
  ArrowUpRight,
  Loader2,
  AlertTriangle,
  Trash2,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WhatsAppPreferences } from "./whatsapp-preferences";
import { AgentEditor } from "./agent-editor";
import { ProjectNameForm } from "./project-name-form";
import type { ProjectSettingsView } from "@/lib/settings-types";
import {
  setProjectPaused,
  openProjectBillingPortal,
} from "@/app/actions/project-settings";
import { DeleteProjectDialog } from "./delete-project-dialog";

const tabs = [
  { id: "agent", label: "Agent IA", hint: "Ton, objectifs, qualification", icon: Bot },
  { id: "general", label: "Projet & utilisation", hint: "Nom, quota, abonnement", icon: Settings2 },
  { id: "whatsapp", label: "WhatsApp", hint: "Connexion et présence", icon: Smartphone },
  { id: "data", label: "Données & accès", hint: "Exports, pause, suppression", icon: ShieldCheck },
] as const;
export default function ProjectSettingsPage({
  project: p,
}: {
  project: ProjectSettingsView;
}) {
  const router = useRouter();
  const deleteButton = useRef<HTMLButtonElement>(null);
  const [tab, setTab] = useState<string>("agent");
  const [agentSaving, setAgentSaving] = useState(false);
  const [nameSaving, setNameSaving] = useState(false);
  const [paused, setPaused] = useState(p.automationPaused);
  const [settingsVersion, setSettingsVersion] = useState(p.settingsVersion);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const owner = p.role === "OWNER";
  const canPause = owner || p.role === "ADMIN";
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
    <main className="mx-auto w-full max-w-7xl space-y-8 p-4 sm:p-6 xl:p-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Paramètres
          </p>
          <h1 className="mt-1 truncate text-3xl md:text-4xl">{p.name}</h1>
          <ul className="mt-3 flex flex-wrap gap-2 text-xs">
            <li className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
              <Smartphone aria-hidden="true" className="size-3.5" />
              {p.instanceStatus === "connected" ? "WhatsApp connecté" : "WhatsApp à connecter"}
            </li>
            <li className="rounded-full border px-2.5 py-1 capitalize">Offre {p.plan}</li>
            <li className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1">
              {paused ? <Pause aria-hidden="true" className="size-3.5" /> : <Bot aria-hidden="true" className="size-3.5" />}
              {paused ? "Automatisation en pause" : "Automatisation active"}
            </li>
          </ul>
        </div>
        <Button asChild variant="outline">
          <Link href={`/projects/${p.id}/chat`}>
            <MessageSquare data-icon="inline-start" />
            Ouvrir la messagerie
          </Link>
        </Button>
      </header>
      {paused && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border bg-muted/50 p-4 text-sm"
        >
          <Pause aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>
            Projet en pause : l’IA ne répond à aucun contact. Vous pouvez le
            réactiver dans « Données & accès ».
          </p>
        </div>
      )}
      {p.deletionPending && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          La suppression a commencé. Les envois sont bloqués. Terminez la
          suppression dans « Données & accès » pour confirmer le nettoyage.
        </div>
      )}
      <div className="grid gap-7 lg:grid-cols-[240px_minmax(0,1fr)]">
        <nav
          aria-label="Sections des paramètres"
          className="-mx-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] lg:sticky lg:top-20 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0"
        >
          {tabs.map((item) => (
            <Button
              key={item.id}
              type="button"
              disabled={agentSaving || nameSaving}
              onClick={() => {
                setTab(item.id);
                setError("");
              }}
              aria-current={tab === item.id ? "page" : undefined}
              variant={tab === item.id ? "secondary" : "ghost"}
              className="h-auto shrink-0 justify-start gap-3 px-3 py-2 text-left"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background">
                <item.icon aria-hidden="true" className="size-4" />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-medium">{item.label}</span>
                <span className="hidden text-xs font-normal text-muted-foreground lg:block">
                  {item.hint}
                </span>
              </span>
            </Button>
          ))}
        </nav>
        <div className="min-w-0 space-y-6">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            >
              {error}
              <Button
                type="button"
                onClick={() => window.location.reload()}
                variant="link"
                className="ml-3"
              >
                Recharger les réglages
              </Button>
            </div>
          )}
          <div hidden={tab !== "agent"}>
            <AgentEditor
              key={p.id}
              projectId={p.id}
              projectName={p.name}
              initial={p.config}
              version={p.agentConfigVersion}
              onSavingChange={setAgentSaving}
            />
          </div>
          <div hidden={tab !== "general"} className="space-y-6">
            <ProjectNameForm
              key={p.id}
              projectId={p.id}
              name={p.name}
              version={Math.max(settingsVersion, p.settingsVersion)}
              disabled={!!pending || p.deletionPending}
              onVersionChange={setSettingsVersion}
              onSavingChange={setNameSaving}
            />
            <section className="rounded-2xl border bg-card p-5 sm:p-6">
              <div className="mb-6 flex flex-wrap justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Votre utilisation</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Offre <span className="capitalize">{p.plan}</span> ·{" "}
                    {p.periodEnd ? (
                      <>
                        Fin de période le{" "}
                        <LocalDate
                          value={p.periodEnd}
                          options={{
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          }}
                        />
                      </>
                    ) : (
                      "Période en attente de confirmation"
                    )}
                  </p>
                </div>
                {owner && (
                  <Button
                    disabled={!!pending}
                    onClick={() => void billing()}
                    variant="outline"
                    size="lg"
                  >
                    {pending === "billing" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <ArrowUpRight className="size-4" />
                    )}{" "}
                    Gérer mon abonnement
                  </Button>
                )}
              </div>
              <div className="mb-3 flex justify-between gap-4 text-sm">
                <span>Messages sortants réservés</span>
                <strong>
                  {p.messageCount.toLocaleString("fr-FR")} /{" "}
                  {p.allMessagesCount.toLocaleString("fr-FR")}
                </strong>
              </div>
              <div
                role="progressbar"
                aria-label="Quota de messages consommé"
                aria-valuemin={0}
                aria-valuemax={Math.max(p.allMessagesCount, 1)}
                aria-valuenow={Math.min(p.messageCount, Math.max(p.allMessagesCount, 1))}
                className="h-2.5 overflow-hidden rounded-full bg-muted"
              >
                <div
                  className={
                    p.messageCount / Math.max(p.allMessagesCount, 1) >= 0.9
                      ? "h-full rounded-full bg-destructive"
                      : "h-full rounded-full bg-foreground"
                  }
                  style={{
                    width: `${Math.min(100, (p.messageCount / Math.max(p.allMessagesCount, 1)) * 100)}%`,
                  }}
                />
              </div>
              <div className="mt-7 grid grid-cols-3 gap-4 border-t pt-6">
                {[
                  ["7 jours", p.stats.week],
                  ["30 jours", p.stats.month],
                  ["365 jours", p.stats.year],
                ].map(([label, count]) => (
                  <div key={label}>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className="mt-1 font-heading text-2xl font-bold tabular-nums">
                      {Number(count).toLocaleString("fr-FR")}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      messages envoyés
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
          {tab === "whatsapp" && (
            <section className="space-y-6 rounded-2xl border bg-card p-5 sm:p-6">
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
                <Button asChild variant="outline" size="lg">
                  <Link href={`/projects/${p.id}/chat`}>
                    <Smartphone className="size-4" />{" "}
                    {p.instanceStatus === "connected"
                      ? "Voir les conversations"
                      : "Reconnecter"}
                  </Link>
                </Button>
              </div>
              <WhatsAppPreferences
                key={p.id}
                projectId={p.id}
                initial={p.whatsapp}
                version={Math.max(settingsVersion, p.settingsVersion)}
                disabled={!!pending || p.deletionPending}
                onVersionChange={setSettingsVersion}
              />
            </section>
          )}
          {tab === "data" && (
            <>
              <section className="rounded-2xl border bg-card p-5 sm:p-6">
                <h2 className="text-lg font-semibold">
                  Vos données restent accessibles
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Exportez les contacts de ce projet. Les téléchargements sont
                  réservés aux propriétaires et administrateurs, dans la limite
                  de 10 000 contacts par export.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button
                    disabled={!!pending}
                    onClick={() => void download("csv")}
                    variant="outline"
                    size="lg"
                  >
                    {pending === "csv" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}{" "}
                    Export CSV
                  </Button>
                  <Button
                    disabled={!!pending}
                    onClick={() => void download("xlsx")}
                    variant="outline"
                    size="lg"
                  >
                    {pending === "xlsx" ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Download className="size-4" />
                    )}{" "}
                    Export Excel
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href={`/projects/${p.id}/team`}>
                      Gérer les accès de l’équipe{" "}
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </Button>
                </div>
              </section>
              <section className="rounded-2xl border bg-card p-5 sm:p-6">
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
                              : item.action === "project.paused"
                                ? "Projet mis en pause"
                                : item.action === "project.resumed"
                                  ? "Projet réactivé"
                                  : "Paramètres du projet"}
                        </span>
                        <time className="text-xs text-muted-foreground">
                          <LocalDate value={item.createdAt} />
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
              {(canPause || owner) && (
                <h2 className="pt-2 font-mono text-xs font-normal uppercase tracking-wider text-muted-foreground">
                  Zone sensible
                </h2>
              )}
              {canPause && (
                <section
                  aria-labelledby="project-pause-title"
                  className="flex flex-col justify-between gap-5 rounded-2xl border bg-card p-5 sm:flex-row sm:items-center sm:p-7"
                >
                  <div>
                    <h2
                      id="project-pause-title"
                      className="flex items-center gap-2 font-semibold"
                    >
                      <Pause aria-hidden="true" className="size-4" />
                      {paused ? "Projet en pause" : "Mettre le projet en pause"}
                    </h2>
                    <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
                      {paused
                        ? "L’IA ne répond plus à aucun contact de ce projet."
                        : "Désactivez les réponses de l’IA pour tous les contacts de ce projet. Son statut passera à « En pause »."}{" "}
                      Les réglages IA de chaque contact sont conservés :
                      réactiver le projet ne réactive pas les contacts
                      désactivés individuellement.
                    </p>
                    <p className="mt-2 max-w-lg text-xs leading-relaxed text-muted-foreground">
                      Les messages entrants restent accessibles. Les réponses
                      manuelles restent possibles si votre abonnement le permet.
                      La pause ne suspend pas la facturation.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant={paused ? "default" : "outline"}
                    size="lg"
                    disabled={!!pending || p.deletionPending}
                    onClick={() =>
                      void run(
                        "pause",
                        async () => {
                          const result = await setProjectPaused({
                            projectId: p.id,
                            expectedVersion: Math.max(
                              settingsVersion,
                              p.settingsVersion,
                            ),
                            paused: !paused,
                          });
                          if (result.success)
                            setPaused(result.automationPaused);
                          return result;
                        },
                        paused
                          ? "Projet réactivé. Les contacts désactivés restent désactivés."
                          : "Projet en pause. Les réponses de l’IA sont désactivées pour tous les contacts.",
                      )
                    }
                  >
                    {pending === "pause" ? (
                      <Loader2
                        aria-hidden="true"
                        className="size-4 animate-spin"
                      />
                    ) : paused ? (
                      <Play aria-hidden="true" className="size-4" />
                    ) : (
                      <Pause aria-hidden="true" className="size-4" />
                    )}
                    {paused ? "Réactiver le projet" : "Mettre en pause"}
                  </Button>
                </section>
              )}
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
                  <Button
                    ref={deleteButton}
                    onClick={() => setDeleting(true)}
                    type="button"
                    variant="destructive"
                    size="lg"
                  >
                    <Trash2 className="size-4" />{" "}
                    {p.deletionPending
                      ? "Terminer la suppression"
                      : "Supprimer"}
                  </Button>
                </section>
              )}
            </>
          )}
        </div>
      </div>
      {deleting && (
        <DeleteProjectDialog
          project={p}
          onClose={() => {
            setDeleting(false);
            requestAnimationFrame(() => deleteButton.current?.focus());
          }}
        />
      )}
    </main>
  );
}
