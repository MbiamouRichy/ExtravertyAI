import { z } from "zod";

// Pure helpers shared by the server and the client bundle.

export const PIPELINE_STAGES = [
  { id: "NEW", label: "Nouveau", hint: "Premier contact, intérêt pas encore qualifié." },
  { id: "INTERESTED", label: "Intéressé", hint: "Intention d’achat repérée par Instinct IA ou l’équipe." },
  { id: "QUOTE_SENT", label: "Devis envoyé", hint: "Prix ou offre transmis, en attente de réponse." },
  { id: "WON", label: "Gagné", hint: "Vente conclue." },
  { id: "LOST", label: "Perdu", hint: "Le prospect n’a pas donné suite." },
] as const;

export type PipelineStageId = (typeof PIPELINE_STAGES)[number]["id"];

export const PipelineStageSchema = z.enum(["NEW", "INTERESTED", "QUOTE_SENT", "WON", "LOST"]);

export function stageLabel(stage: PipelineStageId): string {
  return PIPELINE_STAGES.find((item) => item.id === stage)?.label ?? stage;
}

export const CURRENCIES = [
  "XAF",
  "XOF",
  "EUR",
  "USD",
  "CDF",
  "GNF",
  "MAD",
  "NGN",
  "GHS",
  "KES",
  "ZAR",
] as const;
export const CurrencySchema = z.enum(CURRENCIES);

export const MAX_DEAL_VALUE = 2_000_000_000;

/** Decimal places of a currency (ISO 4217): XAF and XOF have none. */
export function currencyDigits(currency: string): number {
  return (
    new Intl.NumberFormat("fr-FR", { style: "currency", currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

export function formatDealValue(minor: number, currency: string): string {
  const digits = currencyDigits(currency);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(minor / 10 ** digits);
}

/** « 150 000 », « 1 250,50 » or « 1250.5 » to minor units; null when empty. */
export function parseDealValue(input: string, currency: string): number | null {
  const compact = input.replace(/[\s  ]/g, "");
  if (!compact) return null;
  const digits = currencyDigits(currency);
  const pattern = digits > 0 ? /^\d+(?:[.,]\d{1,2})?$/ : /^\d+$/;
  if (!pattern.test(compact)) throw new PipelineError("Montant invalide.");
  const value = Math.round(Number(compact.replace(",", ".")) * 10 ** digits);
  if (!Number.isSafeInteger(value) || value > MAX_DEAL_VALUE) {
    throw new PipelineError("Ce montant est trop élevé.");
  }
  return value;
}

// Safe to show as is to the user.
export class PipelineError extends Error {}

export type PipelineCard = {
  id: string;
  name: string;
  dealValue: number | null;
  stageChangedAt: string | null;
  lastActivityAt: string;
  assignee: { id: string; name: string | null; image: string | null } | null;
  interesting: boolean;
};

export type PipelineColumn = {
  id: PipelineStageId;
  label: string;
  hint: string;
  count: number;
  total: number;
  cards: PipelineCard[];
};
