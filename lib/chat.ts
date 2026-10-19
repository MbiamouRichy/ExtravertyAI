import type { ProspectClassification } from "./instinct-classification";
import type { ChatContactDetails } from "./contact-details";
import type { PipelineStageId } from "./pipeline-shared";

export type ChatMessageStatus =
  "pending" | "sent" | "delivered" | "read" | "failed" | "unknown";

export type OutboundState =
  "QUEUED" | "DISPATCHING" | "ACCEPTED" | "UNCERTAIN" | "CANCELLED";

export type ChatClient = {
  id: string;
  name: string;
  lastMessage: string;
  lastActivityAt: string;
  aiActive: boolean;
  interestingProspect?: boolean;
  prospectClassification?: ProspectClassification | null;
  unreadCount?: number;
  agents?: ChatAgent[];
  resolvedAt?: string | null;
  tags?: ChatTag[];
  assignee?: ChatAgent | null;
  // Conversation reprise par l’équipe dont le dernier message vient du client.
  waitingSince?: string | null;
  pipelineStage?: PipelineStageId;
  dealValue?: number | null;
};

export type ChatTag = { id: string; name: string };

export type ChatFilter =
  | "all"
  | "ai"
  | "manual"
  | "resolved"
  | "mine"
  | "unassigned";

export type ChatFilterCounts = Record<ChatFilter, number>;

export type ChatPage<T> = {
  unreadConversations?: number;
  /** Nombre de conversations par filtre (première page uniquement). */
  filterCounts?: ChatFilterCounts;
  projectTags?: Array<ChatTag & { count: number }>;
  items: T[];
  nextCursor: string | null;
};

export type ChatGeneration = {
  id: string;
  state: "queued" | "thinking" | "delayed";
};

export type ChatMessagesPage = ChatPage<ChatMessage> & {
  agents?: ChatAgent[];
  contact?: ChatContactDetails;
  hasClientMessage: boolean;
  generation: ChatGeneration | null;
};

export type ChatAgent = {
  id: string;
  name: string | null;
  image: string | null;
};

export type ChatFeedback = { rating: "UP" | "DOWN"; correction: string | null };

export type ChatMessage = {
  id: string;
  // "note" : note interne de l'équipe, jamais envoyée au contact.
  senderType: "client" | "bot" | "agent" | "system" | "note";
  agent?: ChatAgent | null;
  content: string;
  type?: string;
  mediaUrl?: string | null;
  extractedText?: string | null;
  extractionStatus?: string | null;
  timestamp: string;
  status: ChatMessageStatus;
  outboundState?: OutboundState | null;
  clientRequestId?: string | null;
  /** Avis du membre connecté sur une réponse de l’IA. */
  feedback?: ChatFeedback | null;
};

export type WorkspaceDataResponse =
  | {
      success: true;
      clients: ChatClient[];
      messages: Record<string, ChatMessage[]>;
      contactsLimited: boolean;
    }
  | {
      success: false;
      error: string;
    };

export function normalizeChatStatus(value: unknown): ChatMessageStatus {
  if (typeof value !== "string") return "unknown";

  switch (value.toLowerCase()) {
    case "pending":
      return "pending";
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "read":
      return "read";
    case "failed":
      return "failed";
    default:
      return "unknown";
  }
}
