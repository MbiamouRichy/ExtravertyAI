"use client";
import { cn } from "@/lib/utils";
import { useState, useTransition, useRef, useEffect } from "react";

import { useRouter } from "next/navigation";
import { Bot, Users, UserRound, Download, Loader2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { ContactsTable } from "./contacts-table";
import { type ContactTableType as Contact } from "./contacts-column";
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
export function ContactsWorkspace(p: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(p.query);
  const queryRef = useRef(p.query);
  const navigationRef = useRef({
    filter: p.filter as string,
    sort: p.sort as string,
    page: p.page,
  });
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const syncFromHistory = () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      const params = new URLSearchParams(window.location.search);
      queryRef.current = params.get("q") || "";
      navigationRef.current = {
        filter: params.get("filter") || "all",
        sort: params.get("sort") || "activity",
        page: Number(params.get("page")) || 1,
      };
      setQuery(queryRef.current);
    };
    window.addEventListener("popstate", syncFromHistory);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
      window.removeEventListener("popstate", syncFromHistory);
    };
  }, []);
  function search(value: string) {
    setQuery(value);
    queryRef.current = value;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(
      () => navigate({ q: value.trim(), page: 1 }),
      300,
    );
  }
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
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const values = {
      q: queryRef.current.trim(),
      ...navigationRef.current,
      ...changes,
    };
    navigationRef.current = {
      filter: values.filter,
      sort: values.sort,
      page: values.page,
    };
    const params = new URLSearchParams();
    if (values.q) params.set("q", values.q);
    if (values.filter !== "all") params.set("filter", values.filter);
    if (values.sort !== "activity") params.set("sort", values.sort);
    if (values.page > 1) params.set("page", String(values.page));
    startNavigation(() =>
      router.replace(`/projects/${p.projectId}/contacts?${params}`, {
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
  const status = (contact: Contact) => (
    <Button
      disabled={!!busy || navigationPending}
      onClick={() => void handling(contact)}
      title={
        contact.aiActive
          ? "Passer à une prise en charge humaine"
          : "Activer l’assistant"
      }
      aria-label={`${contact.displayName} : ${contact.aiActive ? "passer à un conseiller" : "activer l’IA"}`}
      variant={contact.aiActive ? "secondary" : "outline"}
      size="sm"
      className="rounded-full text-xs"
    >
      {busy === contact.id ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : contact.aiActive ? (
        <Bot className="size-3.5" />
      ) : (
        <UserRound className="size-3.5" />
      )}
      {contact.aiActive ? "Assistant IA" : "Équipe humaine"}
    </Button>
  );
  return (
    <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 xl:p-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            Contacts · {p.projectName}
          </p>
          <h1 className="mt-1 text-3xl md:text-4xl">Chaque contact compte</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Retrouvez vos prospects et choisissez qui les accompagne : l’IA ou l’équipe.
          </p>
        </div>
        <Button
          disabled={!!busy || p.total === 0}
          onClick={() => void exportContacts()}
          variant="outline"
        >
          {busy === "export" ? (
            <Loader2 className="animate-spin" aria-hidden="true" />
          ) : (
            <Download aria-hidden="true" />
          )}
          Exporter en CSV
        </Button>
      </header>
      <section
        aria-label="Répartition des contacts"
        className="grid grid-cols-3 divide-x rounded-2xl border bg-card"
      >
        {[
          { title: "Contacts", count: p.total, icon: Users },
          { title: "Gérés par l’IA", count: p.aiCount, icon: Bot },
          { title: "Suivis par l’équipe", count: p.total - p.aiCount, icon: UserRound },
        ].map((card) => (
          <div key={card.title} className="flex items-center gap-3 px-4 py-4 sm:px-6">
            <span className="hidden size-9 shrink-0 items-center justify-center rounded-lg border bg-background sm:flex">
              <card.icon aria-hidden="true" className="size-4" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">{card.title}</p>
              <p className="font-heading text-xl font-bold tabular-nums sm:text-2xl">
                {card.count.toLocaleString("fr-FR")}
              </p>
            </div>
          </div>
        ))}
      </section>
      <section
        aria-label="Liste des contacts"
        className="overflow-hidden rounded-2xl border bg-card"
      >
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div role="group" aria-label="Filtrer les contacts" className="flex flex-wrap items-center gap-1">
            {[
              { value: "all", label: "Tous" },
              { value: "ai", label: "Assistant IA" },
              { value: "human", label: "Équipe" },
            ].map((item) => (
              <Button
                key={item.value}
                size="sm"
                variant={p.filter === item.value ? "secondary" : "ghost"}
                onClick={() => navigate({ filter: item.value, page: 1 })}
                aria-pressed={p.filter === item.value}
                className={cn("rounded-full px-3", p.filter !== item.value && "text-muted-foreground")}
              >
                {item.label}
              </Button>
            ))}
            <span role="status" className="ml-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              {navigationPending && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
              {p.filtered.toLocaleString("fr-FR")} résultat{p.filtered !== 1 && "s"}
            </span>
          </div>
          <Select value={p.sort} onValueChange={(sort) => navigate({ sort, page: 1 })}>
            <SelectTrigger aria-label="Trier les contacts" className="w-full sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="activity">Dernière activité</SelectItem>
              <SelectItem value="newest">Ajoutés récemment</SelectItem>
              <SelectItem value="name">Nom personnalisé</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="p-4 sm:p-5" aria-busy={navigationPending}>
          <ContactsTable
            data={p.contacts}
            projectId={p.projectId}
            query={query}
            onQueryChange={search}
            page={p.page}
            pageCount={p.pageCount}
            total={p.filtered}
            pending={navigationPending}
            busy={!!busy}
            renderStatus={status}
            onToggleAi={(contact) => {
              if (!busy && !navigationPending) void handling(contact);
            }}
            onPageChange={(page) => navigate({ page })}
            onRename={(contact) => {
              setName(contact.name || "");
              setError("");
              setDialog({ type: "rename", contact });
            }}
            onDelete={(contact) => {
              setError("");
              setDialog({ type: "delete", contact });
            }}
          />
        </div>
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
              <Label htmlFor="contact-alias" className="text-sm font-medium">
                Nom personnalisé
              </Label>
              <Input
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
            <Button
              disabled={!!busy}
              onClick={() => void submitDialog()}
              variant={dialog?.type === "delete" ? "destructive" : "default"}
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              {dialog?.type === "delete"
                ? "Supprimer le contact"
                : "Enregistrer"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
