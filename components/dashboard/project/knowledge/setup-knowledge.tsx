"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useChatRealtime } from "@/hooks/use-chat-data";
import { KnowledgeDocuments } from "./knowledge-documents";
import { KnowledgeEntries } from "./knowledge-entries";
import { KnowledgeProducts } from "./knowledge-products";
import type {
  KnowledgeEntryView,
  KnowledgeSourceView,
  KnowledgeUsage,
} from "./types";

/**
 * Étape facultative de la configuration : mêmes outils que la page
 * Assistant IA. Le titre et l’explication sont ceux de l’étape.
 */
export function SetupKnowledge({
  projectId,
  currency,
  usage,
  entries,
  products,
  sources,
}: {
  projectId: string;
  currency: string;
  usage: KnowledgeUsage;
  entries: KnowledgeEntryView[];
  products: KnowledgeEntryView[];
  sources: KnowledgeSourceView[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const refresh = useCallback(
    () => startTransition(() => router.refresh()),
    [router],
  );
  // Le statut des imports de documents arrive par le canal du projet.
  useChatRealtime(projectId, refresh);

  return (
    <section aria-label="Connaissances de l’agent">
      <Tabs defaultValue="entries" className="gap-4">
        <div className="-mx-4 overflow-x-auto overflow-y-hidden px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="entries">
              Informations · {entries.length}
            </TabsTrigger>
            <TabsTrigger value="products">
              Produits · {products.length}
            </TabsTrigger>
            <TabsTrigger value="documents">
              Documents · {sources.length}
            </TabsTrigger>
          </TabsList>
        </div>
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
      </Tabs>
    </section>
  );
}
