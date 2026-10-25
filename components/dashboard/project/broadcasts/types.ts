import type { BroadcastStats } from "@/lib/broadcasts";

export type BroadcastStatus = "SCHEDULED" | "SENDING" | "PAUSED" | "COMPLETED" | "CANCELLED";

/** A broadcast as sent to the browser: dates as ISO strings, no internal fields. */
export type BroadcastView = {
  id: string;
  name: string;
  status: BroadcastStatus;
  pauseReason: string | null;
  scheduledAt: string;
  nextSendAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  recipientCount: number;
  author: string | null;
  hasImage: boolean;
  stats: BroadcastStats | null;
};

export type BroadcastUsageView = {
  monthly: { used: number; reserved: number; limit: number };
  daily: { used: number; limit: number };
  recipientsLimit: number;
  quota: { used: number; limit: number } | null;
};

export const ACTIVE_STATUSES: BroadcastStatus[] = ["SCHEDULED", "SENDING", "PAUSED"];
