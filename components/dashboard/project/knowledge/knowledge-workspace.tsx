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

function UsageMeter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const ratio = Math.min(1, limit ? used / limit : 0);
  return (
    <div className="min-w-40 flex-1">
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono tabular-nums">
          {used.toLocaleString("fr-FR")} / {limit.toLocaleString("fr-FR")}
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-foreground transition-[width]" style={{ width: `${ratio * 100}%` }} />
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
      <div className="flex flex-wrap gap-6 rounded-2xl border bg-card p-4">
        <UsageMeter label="Entrées utilisées" used={usage.entries} limit={usage.entryLimit} />
        <UsageMeter label="Documents (PDF et pages web)" used={usage.documents} limit={usage.documentLimit} />
      </div>
      <Tabs defaultValue="entries">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
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
