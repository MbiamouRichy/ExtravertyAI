"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChatRealtime } from "@/hooks/use-chat-data";
import type { AgentConfig } from "@/lib/agent-config";
import { AgentEditor } from "../agent-editor";
import { AiQuietSettings } from "../ai-quiet-settings";
import { AgentSandbox } from "./agent-sandbox";
import { Improvements, type ImprovementData } from "./improvements";
import { KnowledgeDocuments } from "./knowledge-documents";
import { KnowledgeEntries } from "./knowledge-entries";
import { KnowledgeProducts } from "./knowledge-products";
import type {
  KnowledgeEntryView,
  KnowledgeSourceView,
  KnowledgeUsage,
} from "./types";

export type AgentSettingsView = {
  projectName: string;
  config: AgentConfig;
  version: number;
  aiQuietEnabled: boolean;
};

/** Onglets qui consomment le quota : l’utilisation n’apparaît que pour eux. */
const DATA_TABS = new Set(["entries", "products", "documents"]);

export function KnowledgeWorkspace({
  projectId,
  agent,
  currency,
  usage,
  entries,
  products,
  sources,
  sandboxRemaining,
  improvements,
}: {
  projectId: string;
  agent: AgentSettingsView;
  currency: string;
  usage: KnowledgeUsage;
  entries: KnowledgeEntryView[];
  products: KnowledgeEntryView[];
  sources: KnowledgeSourceView[];
  sandboxRemaining: number;
  improvements: ImprovementData;
}) {
  const [tab, setTab] = useState("agent");
  const pendingImprovements =
    improvements.gaps.length + improvements.corrections.length;
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = useCallback(
    () => startTransition(() => router.refresh()),
    [router],
  );
  // Import status changes are pushed by the worker on the project channel.
  useChatRealtime(projectId, refresh);

  return (
    <Tabs value={tab} onValueChange={setTab} className="gap-6">
      <div className="-mx-4 overflow-x-auto overflow-y-hidden border-b px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
        <TabsList variant="line" className="h-10!">
          <TabsTrigger value="agent">Consignes</TabsTrigger>
          <TabsTrigger value="entries">Questions</TabsTrigger>
          <TabsTrigger value="products">Produits</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="test">Tester</TabsTrigger>
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
      {DATA_TABS.has(tab) && (
        <p className="text-xs text-muted-foreground tabular-nums">
          {usage.entries.toLocaleString("fr-FR")} /{" "}
          {usage.entryLimit.toLocaleString("fr-FR")} entrées ·{" "}
          {usage.documents.toLocaleString("fr-FR")} /{" "}
          {usage.documentLimit.toLocaleString("fr-FR")} documents
        </p>
      )}
      {/* Toujours monté : un enregistrement auto en attente survit au changement d’onglet. */}
      <TabsContent
        value="agent"
        forceMount
        className="space-y-6 data-[state=inactive]:hidden"
      >
        <AgentEditor
          projectId={projectId}
          projectName={agent.projectName}
          initial={agent.config}
          version={agent.version}
        />
        <AiQuietSettings projectId={projectId} initial={agent.aiQuietEnabled} />
      </TabsContent>
      <TabsContent value="entries">
        <KnowledgeEntries
          projectId={projectId}
          currency={currency}
          entries={entries}
          onChanged={refresh}
        />
      </TabsContent>
      <TabsContent value="products">
        <KnowledgeProducts
          projectId={projectId}
          currency={currency}
          products={products}
          onChanged={refresh}
        />
      </TabsContent>
      <TabsContent value="documents">
        <KnowledgeDocuments
          projectId={projectId}
          usage={usage}
          sources={sources}
          onChanged={refresh}
        />
      </TabsContent>
      <TabsContent value="test">
        <AgentSandbox
          projectId={projectId}
          initialRemaining={sandboxRemaining}
        />
      </TabsContent>
      <TabsContent value="improve">
        <Improvements
          projectId={projectId}
          data={improvements}
          onChanged={refresh}
        />
      </TabsContent>
    </Tabs>
  );
}
