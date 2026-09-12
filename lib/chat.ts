export type ChatMessageStatus =
  | "pending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "unknown";

export type ChatClient = {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  lastActivityAt: string;
  aiActive: boolean;
};

export type ChatPage<T> = {
  items: T[];
  nextCursor: string | null;
};

export type ChatMessage = {
  id: string;
  senderType: "client" | "bot" | "agent" | "system";
  content: string;
  timestamp: string;
  status: ChatMessageStatus;
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
