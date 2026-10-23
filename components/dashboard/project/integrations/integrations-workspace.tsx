"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  CircleAlert,
  CircleCheck,
  Clock3,
  ExternalLink,
  KeyRound,
  ListChecks,
  Plus,
  RotateCw,
  Send,
  Sheet,
  Trash2,
  Webhook,
} from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deleteEndpointAction,
  redeliverAction,
  rotateWebhookSecretAction,
  sendTestEventAction,
  updateEndpointAction,
} from "@/app/actions/integrations";
import { useChatRealtime } from "@/hooks/use-chat-data";
import { INTEGRATION_EVENTS, type INTEGRATION_EVENT_IDS } from "@/lib/integration-events";
import { cn } from "@/lib/utils";
import { CreateWebhookDialog, EditEventsDialog, SecretDialog } from "./webhook-dialogs";

type EventId = (typeof INTEGRATION_EVENT_IDS)[number];

export type EndpointView = {
  id: string;
  kind: "WEBHOOK" | "GOOGLE_SHEETS";
  name: string;
  url: string | null;
  events: string[];
  enabled: boolean;
  consecutiveFailures: number;
  disabledReason: string | null;
  spreadsheetUrl: string | null;
  googleEmail: string | null;
  lastDeliveryAt: string | null;
};

export type DeliveryView = {
  id: string;
  endpointId: string;
  event: string;
  state: "QUEUED" | "DELIVERING" | "DELIVERED" | "FAILED";
  attempts: number;
  lastStatus: number | null;
  lastError: string | null;
  createdAt: string;
};

const EVENT_LABEL: Record<string, string> = {
  ...Object.fromEntries(INTEGRATION_EVENTS.map((event) => [event.id, event.label])),
  "test.ping": "Test",
};

const GOOGLE_OUTCOMES: Record<string, { type: "success" | "error"; text: string }> = {
  connected: { type: "success", text: "Google Sheets connecté : une feuille a été créée dans votre Drive." },
  cancelled: { type: "error", text: "Connexion Google annulée." },
  error: { type: "error", text: "La connexion Google a échoué. Réessayez." },
  unavailable: { type: "error", text: "Google Sheets n’est pas disponible pour ce projet." },
};

function EndpointRow({
  projectId,
  endpoint,
  onChanged,
  onEditEvents,
  onSecret,
}: {
  projectId: string;
  endpoint: EndpointView;
  onChanged: () => void;
  onEditEvents: () => void;
  onSecret: (secret: string) => void;
}) {
  const switchId = useId();
  const [pending, startTransition] = useTransition();
  const Icon = endpoint.kind === "WEBHOOK" ? Webhook : Sheet;
  const act = (run: () => Promise<{ success: boolean; error?: string }>, success?: string) =>
    startTransition(async () => {
      const result = await run();
      if (!result.success) toast.error(result.error ?? "Action impossible.");
      else {
        if (success) toast.success(success);
        onChanged();
      }
    });

  return (
    <li className="flex flex-col gap-4 p-4 lg:flex-row lg:items-start">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {endpoint.name}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
              endpoint.enabled ? "bg-primary text-primary-foreground" : "border text-muted-foreground",
            )}
          >
            {endpoint.enabled ? "Actif" : "Désactivé"}
          </span>
        </p>
        {endpoint.url && <p className="truncate font-mono text-[11px] text-muted-foreground">{endpoint.url}</p>}
        {endpoint.kind === "GOOGLE_SHEETS" && (
          <p className="text-xs text-muted-foreground">
            Compte {endpoint.googleEmail ?? "Google"} ·{" "}
            {endpoint.spreadsheetUrl && (
              <a
                href={endpoint.spreadsheetUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-foreground underline-offset-4 hover:underline"
              >
                Ouvrir la feuille
                <ExternalLink aria-hidden="true" className="size-3" />
                <span className="sr-only">(nouvel onglet)</span>
              </a>
            )}
          </p>
        )}
        {endpoint.disabledReason && (
          <p className="flex items-start gap-1.5 text-xs text-destructive">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
            {endpoint.disabledReason}
          </p>
        )}
        <ul aria-label="Événements envoyés" className="flex flex-wrap gap-1.5 pt-1">
          {endpoint.events.map((event) => (
            <li key={event} className="rounded-md border px-1.5 py-0.5 text-[11px]">
              {EVENT_LABEL[event] ?? event}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        <Label htmlFor={switchId} className="sr-only">
          Activer « {endpoint.name} »
        </Label>
        <Switch
          id={switchId}
          checked={endpoint.enabled}
          disabled={pending}
          onCheckedChange={(enabled) =>
            act(() => updateEndpointAction({ projectId, endpointId: endpoint.id, enabled }))
          }
          className="mr-2"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending || !endpoint.enabled}
          onClick={() =>
            act(() => sendTestEventAction({ projectId, endpointId: endpoint.id }), "Événement de test mis en file")
          }
        >
          <Send data-icon="inline-start" />
          Tester
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={`Choisir les événements de « ${endpoint.name} »`} onClick={onEditEvents}>
          <ListChecks aria-hidden="true" />
        </Button>
        {endpoint.kind === "WEBHOOK" && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label={`Régénérer le secret de « ${endpoint.name} »`}
            onClick={() =>
              startTransition(async () => {
                const result = await rotateWebhookSecretAction({ projectId, endpointId: endpoint.id });
                if (!result.success) toast.error(result.error);
                else onSecret(result.secret);
              })
            }
          >
            <KeyRound aria-hidden="true" />
          </Button>
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={`Supprimer « ${endpoint.name} »`}>
              <Trash2 aria-hidden="true" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer « {endpoint.name} » ?</AlertDialogTitle>
              <AlertDialogDescription>
                {endpoint.kind === "GOOGLE_SHEETS"
                  ? "L’accès à votre compte Google est révoqué. La feuille reste dans votre Drive."
                  : "Plus aucun événement ne sera envoyé à cette adresse."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                onClick={() =>
                  act(() => deleteEndpointAction({ projectId, endpointId: endpoint.id }), "Intégration supprimée")
                }
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </li>
  );
}

export function IntegrationsWorkspace({
  projectId,
  endpoints,
  deliveries,
  googleAvailable,
  webhooksAvailable,
  googleOutcome,
}: {
  projectId: string;
  endpoints: EndpointView[];
  deliveries: DeliveryView[];
  googleAvailable: boolean;
  /** Webhooks : offres Pro et Business (vérifié aussi côté serveur). */
  webhooksAvailable: boolean;
  googleOutcome: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());
  const [creating, setCreating] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [editing, setEditing] = useState<EndpointView | null>(null);
  const [pending, startAction] = useTransition();
  useChatRealtime(projectId, refresh);

  useEffect(() => {
    const outcome = googleOutcome ? GOOGLE_OUTCOMES[googleOutcome] : null;
    if (!outcome) return;
    if (outcome.type === "success") toast.success(outcome.text);
    else toast.error(outcome.text);
    // Drop the query parameter so a reload does not repeat the message.
    router.replace(`/projects/${projectId}/integrations`, { scroll: false });
  }, [googleOutcome, projectId, router]);

  const sheets = endpoints.find((endpoint) => endpoint.kind === "GOOGLE_SHEETS");
  const names = new Map(endpoints.map((endpoint) => [endpoint.id, endpoint.name]));
  const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="space-y-8">
      <section aria-labelledby="google-sheets" className="rounded-2xl border bg-card p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-muted/50">
              <Sheet aria-hidden="true" className="size-5" />
            </span>
            <div>
              <h2 id="google-sheets" className="font-heading text-lg font-semibold tracking-tight">
                Google Sheets
              </h2>
              <p className="mt-1 max-w-xl text-sm text-muted-foreground">
                Une ligne par événement dans une feuille créée pour vous. ExtravertyAI
                n’accède qu’à cette feuille, jamais au reste de votre Drive.
              </p>
            </div>
          </div>
          {!sheets &&
            (googleAvailable ? (
              <Button asChild className="shrink-0">
                <a href={`/api/integrations/google/start?projectId=${encodeURIComponent(projectId)}`}>
                  Connecter Google Sheets
                </a>
              </Button>
            ) : (
              <Button type="button" disabled className="shrink-0">
                Indisponible sur ce serveur
              </Button>
            ))}
        </div>
        {sheets && (
          <ul className="mt-4 divide-y rounded-xl border">
            <EndpointRow
              projectId={projectId}
              endpoint={sheets}
              onChanged={refresh}
              onEditEvents={() => setEditing(sheets)}
              onSecret={setSecret}
            />
          </ul>
        )}
      </section>

      <section aria-labelledby="webhooks">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="webhooks" className="font-heading text-lg font-semibold tracking-tight">
              Webhooks · Make, Zapier, votre CRM
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Un POST JSON signé (HMAC-SHA256) à chaque événement, relancé
              automatiquement pendant environ 24 h en cas d’échec.
            </p>
          </div>
          {webhooksAvailable ? (
            <Button type="button" onClick={() => setCreating(true)}>
              <Plus data-icon="inline-start" />
              Webhook
            </Button>
          ) : (
            <Button asChild variant="outline">
              <Link href={`/projects/${projectId}/billing`}>Passer à l’offre Pro</Link>
            </Button>
          )}
        </div>
        {endpoints.some((endpoint) => endpoint.kind === "WEBHOOK") ? (
          <ul className="divide-y rounded-2xl border bg-card">
            {endpoints
              .filter((endpoint) => endpoint.kind === "WEBHOOK")
              .map((endpoint) => (
                <EndpointRow
                  key={endpoint.id}
                  projectId={projectId}
                  endpoint={endpoint}
                  onChanged={refresh}
                  onEditEvents={() => setEditing(endpoint)}
                  onSecret={setSecret}
                />
              ))}
          </ul>
        ) : (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {webhooksAvailable ? null : (
              <span className="mb-1 block font-medium text-foreground">
                Les webhooks sont inclus dans les offres Pro et Business.
              </span>
            )}
            Aucun webhook. Créez-en un avec l’adresse fournie par Make (module
            « Webhooks · Custom webhook ») ou Zapier (« Webhooks by Zapier · Catch Hook »).
          </p>
        )}
      </section>

      <section aria-labelledby="guide" className="rounded-2xl border bg-muted/30 p-4 text-sm sm:p-6">
        <h2 id="guide" className="font-heading text-base font-semibold tracking-tight">
          Connecter Make ou Zapier en 3 étapes
        </h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>Dans Make ou Zapier, créez un déclencheur « webhook personnalisé » et copiez son adresse.</li>
          <li>Ici, cliquez sur « Webhook », collez l’adresse et choisissez les événements.</li>
          <li>Cliquez sur « Tester » : Make ou Zapier reconnaît alors la structure des données.</li>
        </ol>
        <details className="mt-4">
          <summary className="cursor-pointer font-medium text-foreground">Vérifier la signature (développeurs)</summary>
          <p className="mt-2 text-muted-foreground">
            L’en-tête <code className="font-mono text-xs">X-Extraverty-Signature</code> vaut{" "}
            <code className="font-mono text-xs">t=horodatage,v1=signature</code>. Calculez
            HMAC-SHA256(secret, «&nbsp;horodatage.corps&nbsp;») en hexadécimal, comparez-le à{" "}
            <code className="font-mono text-xs">v1</code> et refusez un horodatage de plus de 5 minutes.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-xl border bg-background p-3 font-mono text-xs leading-relaxed">{`{
  "id": "…",
  "event": "pipeline.stage_changed",
  "occurredAt": "2026-10-19T14:05:00.000Z",
  "projectId": "…",
  "data": {
    "contact": { "id": "…", "name": "Kevin M.", "phone": "24101000001" },
    "from": "QUOTE_SENT", "to": "WON",
    "dealValue": 45000, "currency": "XAF"
  }
}`}</pre>
        </details>
      </section>

      <section aria-labelledby="deliveries">
        <h2 id="deliveries" className="mb-3 font-heading text-lg font-semibold tracking-tight">
          Derniers envois
        </h2>
        {deliveries.length ? (
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Événement</TableHead>
                  <TableHead>État</TableHead>
                  <TableHead className="w-24">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs tabular-nums">
                      {date.format(new Date(delivery.createdAt))}
                    </TableCell>
                    <TableCell className="max-w-48 truncate text-xs">{names.get(delivery.endpointId) ?? "—"}</TableCell>
                    <TableCell className="text-xs">{EVENT_LABEL[delivery.event] ?? delivery.event}</TableCell>
                    <TableCell className="text-xs">
                      {delivery.state === "DELIVERED" ? (
                        <span className="inline-flex items-center gap-1">
                          <CircleCheck aria-hidden="true" className="size-3.5" />
                          Livré{delivery.lastStatus ? ` · ${delivery.lastStatus}` : ""}
                        </span>
                      ) : delivery.state === "FAILED" ? (
                        <span className="inline-flex items-center gap-1 text-destructive" title={delivery.lastError ?? undefined}>
                          <CircleAlert aria-hidden="true" className="size-3.5" />
                          Échec · {delivery.lastError ?? "erreur"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Clock3 aria-hidden="true" className="size-3.5" />
                          {delivery.attempts ? `Nouvelle tentative (${delivery.attempts})` : "En attente"}
                          {delivery.lastError ? ` · ${delivery.lastError}` : ""}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {delivery.state === "FAILED" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          onClick={() =>
                            startAction(async () => {
                              const result = await redeliverAction({ projectId, deliveryId: delivery.id });
                              if (!result.success) toast.error(result.error);
                              else refresh();
                            })
                          }
                        >
                          <RotateCw data-icon="inline-start" />
                          Relancer
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aucun envoi pour l’instant.
          </p>
        )}
      </section>

      <CreateWebhookDialog projectId={projectId} open={creating} onOpenChange={setCreating} onCreated={(value) => { setSecret(value); refresh(); }} />
      {secret && <SecretDialog secret={secret} onClose={() => setSecret(null)} />}
      {editing && (
        <EditEventsDialog
          key={editing.id}
          projectId={projectId}
          endpointId={editing.id}
          name={editing.name}
          events={editing.events as EventId[]}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
    </div>
  );
}
