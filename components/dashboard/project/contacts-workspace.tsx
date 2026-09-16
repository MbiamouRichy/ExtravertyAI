"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bot,
  Users,
  UserRound,
  Search,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Download,
  MessageSquare,
  Pencil,
  Trash2,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { setContactAiState } from "@/app/actions/setContactAiState";
import { deleteContact, renameContact } from "@/app/actions/contacts.action";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
type Contact = {
  id: string;
  name: string | null;
  displayName: string;
  phone: string;
  aiActive: boolean;
  aiVersion: number;
  createdAt: string;
  lastMessageAt: string | null;
  messageCount: number;
  preview: string;
};
type Props = {
  projectId: string;
  projectName: string;
  total: number;
  aiCount: number;
  filtered: number;
  page: number;
  pageCount: number;
  query: string;
  filter: "all" | "ai" | "human";
  sort: "activity" | "newest" | "name";
  contacts: Contact[];
};
const button =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-medium hover:bg-muted disabled:opacity-40";
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}
export function ContactsWorkspace(p: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(p.query);
  const [navigationPending, startNavigation] = useTransition();
  const [busy, setBusy] = useState("");
  const [dialog, setDialog] = useState<{
    type: "rename" | "delete";
    contact: Contact;
  } | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  function navigate(
    changes: Partial<{ q: string; filter: string; page: number; sort: string }>,
  ) {
    const values = {
      q: p.query,
      filter: p.filter,
      page: p.page,
      sort: p.sort,
      ...changes,
    };
    const params = new URLSearchParams();
    if (values.q) params.set("q", values.q);
    if (values.filter !== "all") params.set("filter", values.filter);
    if (values.sort !== "activity") params.set("sort", values.sort);
    if (values.page > 1) params.set("page", String(values.page));
    startNavigation(() =>
      router.push(`/projects/${p.projectId}/contacts?${params}`, {
        scroll: false,
      }),
    );
  }
  async function handling(contact: Contact) {
    setBusy(contact.id);
    setError("");
    try {
      const result = await setContactAiState({
        projectId: p.projectId,
        contactId: contact.id,
        enabled: !contact.aiActive,
        expectedVersion: contact.aiVersion,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(
        contact.aiActive
          ? "Votre équipe reprend la conversation."
          : "L’assistant est activé pour ce contact.",
      );
      router.refresh();
    } catch {
      toast.error("Le changement n’a pas été confirmé.");
    } finally {
      setBusy("");
    }
  }
  async function submitDialog() {
    if (!dialog) return;
    setBusy(dialog.contact.id);
    setError("");
    try {
      const result =
        dialog.type === "delete"
          ? await deleteContact(p.projectId, dialog.contact.id)
          : await renameContact(p.projectId, dialog.contact.id, name);
      if (!result.success) {
        setError(result.error || "Impossible d’enregistrer.");
        return;
      }
      toast.success(
        dialog.type === "delete"
          ? "Contact supprimé."
          : "Nom du contact enregistré.",
      );
      setDialog(null);
      router.refresh();
    } catch {
      setError(
        "L’opération n’a pas été confirmée. Réessayez après actualisation.",
      );
    } finally {
      setBusy("");
    }
  }
  async function exportContacts() {
    setBusy("export");
    try {
      const response = await fetch(
        `/api/projects/${p.projectId}/export?format=csv`,
      );
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error);
      }
      const url = URL.createObjectURL(await response.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = "contacts.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export indisponible.");
    } finally {
      setBusy("");
    }
  }
  const actions = (contact: Contact) => (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/projects/${p.projectId}/chat?contactId=${contact.id}`}
        aria-label={`Ouvrir la conversation avec ${contact.displayName}`}
        title="Ouvrir le chat"
        className="flex size-11 items-center justify-center rounded-lg text-foreground hover:bg-muted dark:text-foreground dark:hover:bg-muted"
      >
        <MessageSquare className="size-4" />
      </Link>
      <button
        disabled={!!busy}
        onClick={() => {
          setName(contact.name || "");
          setError("");
          setDialog({ type: "rename", contact });
        }}
        aria-label={`Renommer ${contact.displayName}`}
        title="Renommer"
        className="flex size-11 items-center justify-center rounded-lg hover:bg-muted disabled:opacity-40"
      >
        <Pencil className="size-4" />
      </button>
      <button
        disabled={!!busy}
        onClick={() => {
          setError("");
          setDialog({ type: "delete", contact });
        }}
        aria-label={`Supprimer ${contact.displayName}`}
        title="Supprimer"
        className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-40"
      >
        <Trash2 className="size-4" />
      </button>
    </div>
  );
  const status = (contact: Contact) => (
    <button
      disabled={!!busy}
      onClick={() => void handling(contact)}
      title={
        contact.aiActive
          ? "Passer à une prise en charge humaine"
          : "Activer l’assistant"
      }
      aria-label={`${contact.displayName} : ${contact.aiActive ? "passer à un conseiller" : "activer l’IA"}`}
      className={`inline-flex min-h-9 items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${contact.aiActive ? "bg-muted text-foreground dark:bg-muted/40 dark:text-foreground" : "bg-muted text-foreground dark:bg-muted/40 dark:text-foreground"}`}
    >
      {busy === contact.id ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : contact.aiActive ? (
        <Bot className="size-3.5" />
      ) : (
        <UserRound className="size-3.5" />
      )}
      {contact.aiActive ? "Assistant IA" : "Équipe humaine"}
    </button>
  );
  return (
    <main className="mx-auto max-w-7xl space-y-7 px-4 py-7 sm:px-8 lg:py-10">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            La relation client · {p.projectName}
          </p>
          <h1 className="text-3xl! font-semibold">Chaque contact compte.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Retrouvez vos prospects et choisissez comment les accompagner.
          </p>
        </div>
        <button
          disabled={!!busy || p.total === 0}
          onClick={() => void exportContacts()}
          className={button}
        >
          {busy === "export" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Download className="size-4" />
          )}{" "}
          Exporter les contacts
        </button>
      </header>
      <section
        aria-label="Répartition des contacts"
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        {[
          {
            title: "Tous vos contacts",
            count: p.total,
            icon: Users,
            hint: "Une vue complète de vos relations",
            color: "text-foreground dark:text-foreground",
          },
          {
            title: "Assistant activé",
            count: p.aiCount,
            icon: Bot,
            hint: "Prêts pour une prise en charge IA",
            color: "text-foreground dark:text-foreground",
          },
          {
            title: "Suivis par l’équipe",
            count: p.total - p.aiCount,
            icon: UserRound,
            hint: "L’humain garde la main",
            color: "text-foreground dark:text-foreground",
          },
        ].map((card) => (
          <div key={card.title} className="rounded-2xl border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{card.title}</p>
              <card.icon className={`size-5 ${card.color}`} />
            </div>
            <p className="text-3xl font-semibold tracking-tight">
              {card.count.toLocaleString("fr-FR")}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">{card.hint}</p>
          </div>
        ))}
      </section>
      <section
        aria-label="Liste des contacts"
        className="overflow-hidden rounded-2xl border bg-card"
      >
        <div className="space-y-4 border-b p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                navigate({ q: query.trim(), page: 1 });
              }}
              className="flex w-full gap-2 sm:max-w-lg"
            >
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3.5 top-3.5 size-4 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-label="Rechercher un contact par nom ou numéro"
                  placeholder="Rechercher un nom ou un numéro…"
                  maxLength={100}
                  className="h-11 w-full rounded-xl border bg-background pl-10 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring/30"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      navigate({ q: "", page: 1 });
                    }}
                    aria-label="Effacer la recherche"
                    className="absolute right-1 top-1 flex size-9 items-center justify-center"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <button disabled={navigationPending} className={button}>
                Rechercher
              </button>
            </form>
            <select
              aria-label="Trier les contacts"
              value={p.sort}
              onChange={(e) => navigate({ sort: e.target.value, page: 1 })}
              className="h-11 rounded-xl border bg-background px-3 text-sm"
            >
              <option value="activity">Dernière activité</option>
              <option value="newest">Ajoutés récemment</option>
              <option value="name">Nom personnalisé</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {[
                { value: "all", label: "Tous" },
                { value: "ai", label: "Assistant IA" },
                { value: "human", label: "Équipe humaine" },
              ].map((item) => (
                <button
                  key={item.value}
                  onClick={() => navigate({ filter: item.value, page: 1 })}
                  aria-pressed={p.filter === item.value}
                  className={`min-h-10 rounded-full px-4 text-xs font-medium ${p.filter === item.value ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-muted"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <span
              role="status"
              className="inline-flex items-center gap-2 text-xs text-muted-foreground"
            >
              {navigationPending && (
                <Loader2 className="size-3.5 animate-spin" />
              )}
              {p.filtered.toLocaleString("fr-FR")} résultat
              {p.filtered !== 1 && "s"}
            </span>
          </div>
        </div>
        {p.contacts.length === 0 ? (
          <div className="flex min-h-72 flex-col items-center justify-center px-6 py-14 text-center">
            <span className="mb-5 rounded-2xl bg-muted p-4">
              <Users className="size-7 text-muted-foreground" />
            </span>
            <h2 className="text-lg font-semibold">
              {p.total === 0
                ? "Vos prochaines conversations commencent ici"
                : "Aucun contact ne correspond"}
            </h2>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {p.total === 0
                ? "Les personnes qui écrivent à votre numéro WhatsApp apparaîtront automatiquement dans cette liste."
                : "Essayez un autre nom, un numéro ou un filtre différent."}
            </p>
            {p.total === 0 ? (
              <Link
                href={`/projects/${p.projectId}/chat`}
                className={`${button} mt-6`}
              >
                Ouvrir WhatsApp <ArrowUpRight className="size-4" />
              </Link>
            ) : (
              <button
                onClick={() => {
                  setQuery("");
                  navigate({ q: "", filter: "all", page: 1 });
                }}
                className={`${button} mt-6`}
              >
                Réinitialiser les filtres
              </button>
            )}
          </div>
        ) : (
          <>
            <div
              className={`hidden overflow-x-auto md:block ${navigationPending ? "opacity-60" : ""}`}
            >
              <table className="w-full text-left text-sm">
                <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-5 py-4 font-medium">Contact</th>
                    <th className="px-5 py-4 font-medium">Dernier échange</th>
                    <th className="px-5 py-4 font-medium">Prise en charge</th>
                    <th className="px-5 py-4 font-medium">Activité</th>
                    <th className="px-5 py-4 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {p.contacts.map((contact) => (
                    <tr
                      key={contact.id}
                      className="transition-colors hover:bg-muted/25"
                    >
                      <td className="px-5 py-5">
                        <Link
                          href={`/projects/${p.projectId}/chat?contactId=${contact.id}`}
                          className="flex items-center gap-3"
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold">
                            {initials(contact.displayName)}
                          </span>
                          <span className="min-w-0">
                            <span className="block max-w-44 truncate font-medium">
                              {contact.displayName}
                            </span>
                            <span className="mt-1 block font-mono text-xs text-muted-foreground">
                              {contact.phone}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-5 py-5">
                        <p className="max-w-52 truncate text-xs text-muted-foreground">
                          {contact.preview}
                        </p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {contact.messageCount} message
                          {contact.messageCount !== 1 && "s"}
                        </p>
                      </td>
                      <td className="px-5 py-5">{status(contact)}</td>
                      <td className="whitespace-nowrap px-5 py-5 text-xs text-muted-foreground">
                        {new Date(
                          contact.lastMessageAt || contact.createdAt,
                        ).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-3 py-3">{actions(contact)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div
              className={`divide-y md:hidden ${navigationPending ? "opacity-60" : ""}`}
            >
              {p.contacts.map((contact) => (
                <article key={contact.id} className="p-5">
                  <div className="flex items-start gap-3">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full border bg-muted text-xs font-semibold">
                      {initials(contact.displayName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/projects/${p.projectId}/chat?contactId=${contact.id}`}
                        className="block truncate font-medium"
                      >
                        {contact.displayName}
                      </Link>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {contact.phone}
                      </p>
                    </div>
                  </div>
                  <p className="my-4 truncate text-sm text-muted-foreground">
                    {contact.preview}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    {status(contact)}
                    {actions(contact)}
                  </div>
                </article>
              ))}
            </div>
          </>
        )}
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
          <p className="text-xs text-muted-foreground">
            {p.filtered
              ? `${(p.page - 1) * 20 + 1}–${Math.min(p.page * 20, p.filtered)} sur ${p.filtered.toLocaleString("fr-FR")}`
              : "0 contact"}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              Page {p.page} / {p.pageCount}
            </span>
            <button
              disabled={p.page <= 1 || navigationPending}
              onClick={() => navigate({ page: p.page - 1 })}
              aria-label="Page précédente"
              className="flex size-11 items-center justify-center rounded-xl border disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              disabled={p.page >= p.pageCount || navigationPending}
              onClick={() => navigate({ page: p.page + 1 })}
              aria-label="Page suivante"
              className="flex size-11 items-center justify-center rounded-xl border disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </footer>
      </section>
      <AlertDialog
        open={!!dialog}
        onOpenChange={(open) => {
          if (!open && !busy) setDialog(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog?.type === "delete"
                ? `Supprimer ${dialog.contact.displayName} ?`
                : "Personnaliser le nom du contact"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog?.type === "delete"
                ? "Le contact et son historique seront supprimés de ce projet. Un nouveau message entrant pourra recréer sa fiche."
                : "Ce nom sera visible uniquement dans votre espace de travail. Laissez le champ vide pour retrouver son nom WhatsApp."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {dialog?.type === "rename" && (
            <>
              <label htmlFor="contact-alias" className="text-sm font-medium">
                Nom personnalisé
              </label>
              <input
                id="contact-alias"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={120}
                className="h-12 rounded-xl border bg-background px-4 outline-none focus:ring-2 focus:ring-ring/30"
              />
            </>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busy}>Annuler</AlertDialogCancel>
            <button
              disabled={!!busy}
              onClick={() => void submitDialog()}
              className={`${button} ${dialog?.type === "delete" ? "border-destructive bg-destructive text-white hover:bg-destructive/90" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {dialog?.type === "delete"
                ? "Supprimer le contact"
                : "Enregistrer"}
            </button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
