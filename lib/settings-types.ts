import type { AgentConfig } from "./agent-config";
export type ProjectSettingsView = {
  id: string;
  name: string;
  numero: string;
  role: string;
  plan: string;
  status: string;
  instanceStatus: string;
  messageCount: number;
  allMessagesCount: number;
  periodEnd: string | null;
  config: AgentConfig;
  agentConfigVersion: number;
  setupComplete: boolean;
  automationPaused: boolean;
  settingsVersion: number;
  deletionPending: boolean;
  whatsapp: {
    alwaysOnline: boolean;
    readMessages: boolean;
    typing: boolean;
    pending: boolean;
    error: string | null;
  };
  stats: { week: number; month: number; year: number };
  audit: Array<{ id: string; action: string; createdAt: string }>;
};
