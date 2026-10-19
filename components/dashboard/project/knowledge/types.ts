import type { KnowledgeKindId } from "@/lib/knowledge-shared";

export type KnowledgeEntryView = {
  id: string;
  kind: KnowledgeKindId;
  title: string;
  content: string;
  price: number | null;
  stock: number | null;
  enabled: boolean;
  updatedAt: string;
};

export type KnowledgeSourceView = {
  id: string;
  type: "PDF" | "URL" | "CSV";
  name: string;
  url: string | null;
  status: "QUEUED" | "PROCESSING" | "READY" | "FAILED";
  errorCode: string | null;
  entryCount: number;
  truncated: boolean;
  processedAt: string | null;
  createdAt: string;
};

export type KnowledgeUsage = {
  entries: number;
  entryLimit: number;
  documents: number;
  documentLimit: number;
};
