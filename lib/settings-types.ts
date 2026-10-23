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
    rejectCalls: boolean;
    pending: boolean;
    error: string | null;
  };
  stats: { week: number; month: number; year: number };
  /** Adresse de l’icône de l’entreprise, ou null pour l’initiale. */
  logoUrl: string | null;
  /** Fichiers déposés (médias, PDF) et quota de l’offre, en octets. */
  storage: { used: number; limit: number };
  csat: { enabled: boolean; message: string; available: boolean };
  showWaitingTime: boolean;
  aiQuietEnabled: boolean;
  audit: Array<{ id: string; action: string; createdAt: string }>;
};
