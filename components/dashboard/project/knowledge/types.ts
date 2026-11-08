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
  /** Volume de la base en mots : la limite affichée de l’offre. */
  words: number;
  wordLimit: number;
  entries: number;
  entryLimit: number;
  documents: number;
  documentLimit: number;
  /** Taille maximale d’un PDF selon l’offre. */
  pdfMaxMb: number;
};
