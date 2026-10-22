"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChatRealtime } from "@/hooks/use-chat-data";
import { AgentSandbox } from "./agent-sandbox";
import { Improvements, type ImprovementData } from "./improvements";
import { KnowledgeDocuments } from "./knowledge-documents";
import { KnowledgeEntries } from "./knowledge-entries";
import { KnowledgeProducts } from "./knowledge-products";
import type { KnowledgeEntryView, KnowledgeSourceView, KnowledgeUsage } from "./types";

function UsageMeter({
  label,
  short,
  hint,
  used,
  limit,
}: {
  label: string;
  /** Libellé court affiché sur mobile. */
  short: string;
  hint?: string;
  used: number;
  limit: number;
}) {
  const ratio = Math.min(1, limit ? used / limit : 0);
  const full = limit > 0 && used >= limit;
  return (
    <div className="min-w-0 px-4 py-3.5 sm:px-5">
      <p className="flex min-w-0 items-baseline gap-1.5 text-xs text-muted-foreground">
        <span className="truncate">
          <span className="sm:hidden" aria-hidden="true">
            {short}
          </span>
          <span className="max-sm:sr-only">{label}</span>
        </span>
        {hint && (
          <span className="hidden shrink-0 text-[11px] text-muted-foreground/70 md:inline">
            · {hint}
          </span>
        )}
      </p>
      <p className="mt-1 flex items-baseline gap-1 tabular-nums">
        <span className="font-heading text-xl font-semibold tracking-tight sm:text-2xl">
          {used.toLocaleString("fr-FR")}
        </span>
        <span className="text-xs text-muted-foreground">
          / {limit.toLocaleString("fr-FR")}
        </span>
        {full && (
          <span className="ml-auto rounded-full border border-destructive/30 px-1.5 text-[10px] font-medium text-destructive">
            Limite
          </span>
        )}
      </p>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        className="mt-2 h-1 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={`h-full rounded-full transition-[width] motion-reduce:transition-none ${full ? "bg-destructive" : "bg-foreground"}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

export function KnowledgeWorkspace({
  projectId,
  currency,
  usage,
  entries,
  products,
  sources,
  sandboxRemaining,
  improvements,
}: {
  projectId: string;
  currency: string;
  usage: KnowledgeUsage;
  entries: KnowledgeEntryView[];
  products: KnowledgeEntryView[];
  sources: KnowledgeSourceView[];
  sandboxRemaining: number;
  improvements: ImprovementData;
}) {
  const pendingImprovements = improvements.gaps.length + improvements.corrections.length;
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = useCallback(() => startTransition(() => router.refresh()), [router]);
  // Import status changes are pushed by the worker on the project channel.
  useChatRealtime(projectId, refresh);

  return (
    <div className="space-y-6">
      <section
        aria-label="Utilisation de la base de connaissances"
        className="grid grid-cols-2 divide-x rounded-2xl border bg-card"
      >
        <UsageMeter
          label="Entrées utilisées"
          short="Entrées"
          used={usage.entries}
          limit={usage.entryLimit}
        />
        <UsageMeter
          label="Documents importés"
          short="Documents"
          hint="PDF et pages web"
          used={usage.documents}
          limit={usage.documentLimit}
        />
      </section>
      <Tabs defaultValue="entries">
        <div className="-mx-4 overflow-x-auto overflow-y-hidden px-4 sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="entries">Questions et infos</TabsTrigger>
            <TabsTrigger value="products">Produits · {products.length}</TabsTrigger>
            <TabsTrigger value="documents">Documents · {sources.length}</TabsTrigger>
            <TabsTrigger value="test">Tester l’agent</TabsTrigger>
            <TabsTrigger value="improve">
              À améliorer
              {pendingImprovements > 0 && (
                <span className="rounded-full bg-primary px-1.5 font-mono text-[10px] text-primary-foreground tabular-nums">
                  <span className="sr-only">, </span>
                  {pendingImprovements}
                  <span className="sr-only"> en attente</span>
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="entries" className="mt-4">
          <KnowledgeEntries projectId={projectId} currency={currency} entries={entries} onChanged={refresh} />
        </TabsContent>
        <TabsContent value="products" className="mt-4">
          <KnowledgeProducts projectId={projectId} currency={currency} products={products} onChanged={refresh} />
        </TabsContent>
        <TabsContent value="documents" className="mt-4">
          <KnowledgeDocuments projectId={projectId} usage={usage} sources={sources} onChanged={refresh} />
        </TabsContent>
        <TabsContent value="test" className="mt-4">
          <AgentSandbox projectId={projectId} initialRemaining={sandboxRemaining} />
        </TabsContent>
        <TabsContent value="improve" className="mt-4">
          <Improvements projectId={projectId} data={improvements} onChanged={refresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
