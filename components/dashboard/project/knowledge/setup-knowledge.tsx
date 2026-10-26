"use client";

import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { LibraryBig } from "lucide-react";

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
 * Assistant IA, sans les onglets qui exigent un agent déjà actif.
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
    <section
      aria-labelledby="setup-knowledge-title"
      className="rounded-2xl border bg-card p-5 sm:p-6"
    >
      <div className="mb-6 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border bg-background sm:row-span-3 sm:self-start">
          <LibraryBig aria-hidden="true" className="size-5" />
        </span>
        <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          Facultatif
        </p>
        <h2
          id="setup-knowledge-title"
          className="col-span-2 mt-2 font-heading text-lg font-semibold tracking-tight sm:col-span-1 sm:col-start-2 sm:mt-0"
        >
          Ce que votre agent doit savoir
        </h2>
        <p className="col-span-2 text-sm text-muted-foreground sm:col-span-1 sm:col-start-2">
          Questions fréquentes, catalogue et documents : l’agent s’en sert pour
          donner les bons prix et les bonnes conditions. Vous pourrez compléter
          à tout moment dans Assistant IA.
        </p>
      </div>
      <Tabs defaultValue="entries" className="gap-4">
        <div className="-mx-5 overflow-x-auto overflow-y-hidden px-5 sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="entries">
              Questions et infos · {entries.length}
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
