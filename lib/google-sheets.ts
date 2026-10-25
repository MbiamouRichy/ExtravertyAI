import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "../src/generated/prisma/client";
import { INTEGRATION_EVENTS, integrationEventsForPlan } from "./integration-events";
import { IntegrationError, MAX_ENDPOINTS, type DeliveryJob } from "./integrations";
import { requirePlanFeature } from "./plan-features";
import { requireProjectAdmin } from "./project-settings";
import { openSecret, sealSecret } from "./secret-box";

/**
 * Native Google Sheets: a dedicated OAuth consent (separate from sign-in) with
 * the non-sensitive `drive.file` scope. The app only touches the spreadsheet it
 * creates. Every Google host is fixed: no user-supplied URL is ever fetched.
 */

const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/drive.file"];
export const GOOGLE_NONCE_COOKIE = "eai_google_sheets_nonce";
const STATE_TTL_MS = 10 * 60_000;
export const SHEET_NAME = "Événements";
const HEADER = [
  "Date",
  "Événement",
  "Prospect",
  "Téléphone",
  "Première interaction",
  "Dernière interaction",
  "Instinct IA",
  "Sources des messages",
  "Détail",
];

function appOrigin() {
  const origin = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (!origin) throw new Error("APP_URL_MISSING");
  return new URL(origin).origin;
}

export function googleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.BETTER_AUTH_SECRET);
}

function oauthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new IntegrationError("Google n’est pas configuré sur ce serveur.");
  return { clientId, clientSecret, redirectUri: `${appOrigin()}/api/integrations/google/callback` };
}

function stateKey() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("STATE_SECRET_MISSING");
  return secret;
}

type StatePayload = { projectId: string; userId: string; nonce: string; expiresAt: number };

/** Signed, short-lived `state` bound to the user, the project and a cookie nonce. */
export function signState(payload: Omit<StatePayload, "expiresAt">, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ ...payload, expiresAt: now + STATE_TTL_MS })).toString("base64url");
  const mac = createHmac("sha256", stateKey()).update(`google-sheets.${body}`).digest("base64url");
  return `${body}.${mac}`;
}

export function verifyState(state: string, now = Date.now()): StatePayload | null {
  const [body, mac] = state.split(".");
  if (!body || !mac) return null;
  const expected = createHmac("sha256", stateKey()).update(`google-sheets.${body}`).digest();
  const received = Buffer.from(mac, "base64url");
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as StatePayload;
    return payload.expiresAt > now ? payload : null;
  } catch {
    return null;
  }
}

export function newNonce() {
  return randomBytes(16).toString("base64url");
}

export function authorizationUrl(state: string) {
  const { clientId, redirectUri } = oauthConfig();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    // Ensures a refresh token, even for a returning Google account.
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  }).toString();
  return url.toString();
}

async function googleJson(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, payload };
}

export async function exchangeCode(code: string) {
  const { clientId, clientSecret, redirectUri } = oauthConfig();
  const { status, payload } = await googleJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const refreshToken = typeof payload.refresh_token === "string" ? payload.refresh_token : null;
  const accessToken = typeof payload.access_token === "string" ? payload.access_token : null;
  const scope = typeof payload.scope === "string" ? payload.scope : "";
  if (status !== 200 || !refreshToken || !accessToken) {
    throw new IntegrationError("Google n’a pas autorisé l’accès. Réessayez.");
  }
  if (!scope.includes("https://www.googleapis.com/auth/drive.file")) {
    throw new IntegrationError("Autorisez l’accès aux fichiers créés par ExtravertyAI pour connecter Google Sheets.");
  }
  // The id_token comes straight from Google over TLS: its claims can be read as is.
  const idToken = typeof payload.id_token === "string" ? payload.id_token : "";
  let email: string | null = null;
  try {
    const claims = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8"));
    email = typeof claims.email === "string" ? claims.email.slice(0, 200) : null;
  } catch {
    email = null;
  }
  return { refreshToken, accessToken, email };
}

const accessTokens = new Map<string, { token: string; expiresAt: number }>();

async function accessTokenFor(endpointId: string, refreshTokenCiphertext: string) {
  const cached = accessTokens.get(endpointId);
  if (cached && cached.expiresAt > Date.now() + 60_000) return { token: cached.token, status: 200 };
  const { clientId, clientSecret } = oauthConfig();
  const { status, payload } = await googleJson("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: openSecret(refreshTokenCiphertext, endpointId),
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (status !== 200 || typeof payload.access_token !== "string") {
    // invalid_grant: access revoked by the user, treated as permanent.
    return { token: null, status: status === 400 ? 401 : status };
  }
  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 3600;
  accessTokens.set(endpointId, { token: payload.access_token, expiresAt: Date.now() + expiresIn * 1000 });
  return { token: payload.access_token, status: 200 };
}

function range(sheetName: string) {
  return encodeURIComponent(`'${sheetName.replace(/'/g, "''")}'!A1`);
}

async function appendValues(accessToken: string, spreadsheetId: string, sheetName: string, values: string[][]) {
  // RAW: cells are stored as typed, a value starting with « = » never becomes a formula.
  const { status } = await googleJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${range(sheetName)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ values }),
    },
  );
  return status;
}

const EVENT_LABELS: Record<string, string> = Object.fromEntries([
  ...INTEGRATION_EVENTS.map((event) => [event.id, event.label] as const),
  ["test.ping", "Test"],
]);

const INSTINCT_LABELS: Record<string, string> = {
  interesting: "Prospect intéressant",
  follow_up: "À suivre",
  none: "Aucun signal",
};

// Same wording as the message sources chart (lib/message-sources).
const SOURCE_LABELS: Record<string, string> = {
  android: "Android",
  ios: "iOS",
  ai: "Assistant IA",
  whatsapp: "WhatsApp",
  web_dashboard: "Tableau de bord",
  broadcast: "Diffusion",
};

const localFormats = new Map<string, Intl.DateTimeFormat>();

/** « 2026-10-19 15:05 » in the spreadsheet's time zone: sortable, never UTC. */
function localDateTime(iso: unknown, timeZone: string): string {
  if (typeof iso !== "string" || !iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  let format = localFormats.get(timeZone);
  if (!format) {
    try {
      format = new Intl.DateTimeFormat("sv-SE", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return localDateTime(iso, "UTC");
    }
    localFormats.set(timeZone, format);
  }
  return format.format(date);
}

/** One spreadsheet row per event, readable without any formula. */
export function sheetRow(job: Pick<DeliveryJob, "event" | "payload">, timeZone = "UTC"): string[] {
  const payload = (job.payload ?? {}) as { occurredAt?: string; data?: Record<string, unknown> };
  const data = payload.data ?? {};
  const contact = (data.contact ?? {}) as {
    name?: string;
    phone?: string;
    firstInteractionAt?: string | null;
    lastInteractionAt?: string | null;
    instinct?: string | null;
    sources?: string[];
  };
  const detail =
    job.event === "pipeline.stage_changed"
      ? `${data.fromLabel ?? ""} → ${data.toLabel ?? ""}${data.dealValue != null ? ` · ${data.dealValueLabel ?? data.dealValue}` : ""}`
      : job.event === "csat.received"
        ? `Note ${data.score}/5`
        : job.event === "conversation.assigned"
          ? `Assignée à ${(data.assignee as { name?: string } | null)?.name ?? "personne"}`
          : job.event === "conversation.resolved"
            ? `Résolue par ${data.resolvedBy ?? "un membre"}`
            : job.event === "test.ping"
              ? String(data.message ?? "")
              : "";
  return [
    localDateTime(payload.occurredAt ?? new Date().toISOString(), timeZone),
    EVENT_LABELS[job.event] ?? job.event,
    contact.name ?? "",
    contact.phone ?? "",
    localDateTime(contact.firstInteractionAt, timeZone),
    localDateTime(contact.lastInteractionAt, timeZone),
    contact.instinct ? (INSTINCT_LABELS[contact.instinct] ?? contact.instinct) : "",
    Array.isArray(contact.sources)
      ? contact.sources.map((source) => SOURCE_LABELS[source] ?? source).join(", ")
      : "",
    detail,
  ];
}

const sheetSettings = new Map<string, { timeZone: string; checkedAt: number }>();
const SETTINGS_TTL_MS = 60 * 60_000;

/**
 * Reads the spreadsheet's time zone (File › Settings, initially the Google
 * account's) and brings an older header row up to date. Cached for an hour.
 */
async function sheetTimeZone(
  endpointId: string,
  accessToken: string,
  spreadsheetId: string,
  sheetName: string,
) {
  const cached = sheetSettings.get(endpointId);
  if (cached && Date.now() - cached.checkedAt < SETTINGS_TTL_MS) return cached.timeZone;
  const id = encodeURIComponent(spreadsheetId);
  const [{ payload: meta }, { payload: header }] = await Promise.all([
    googleJson(`https://sheets.googleapis.com/v4/spreadsheets/${id}?fields=properties.timeZone`, {
      headers: { authorization: `Bearer ${accessToken}` },
    }),
    googleJson(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${range(sheetName)}`, {
      headers: { authorization: `Bearer ${accessToken}` },
    }),
  ]);
  const properties = meta.properties as { timeZone?: unknown } | undefined;
  const timeZone = typeof properties?.timeZone === "string" ? properties.timeZone : "UTC";
  const firstRow = (header.values as unknown[][] | undefined)?.[0];
  if (Array.isArray(firstRow) && firstRow[0] === "Date (UTC)") {
    await googleJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${id}/values/${range(sheetName)}?valueInputOption=RAW`,
      {
        method: "PUT",
        headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
        body: JSON.stringify({ values: [HEADER] }),
      },
    );
  }
  sheetSettings.set(endpointId, { timeZone, checkedAt: Date.now() });
  return timeZone;
}

export async function appendEventRow(
  endpoint: { id: string; spreadsheetId: string; sheetName: string; refreshTokenCiphertext: string },
  job: DeliveryJob,
) {
  const access = await accessTokenFor(endpoint.id, endpoint.refreshTokenCiphertext);
  if (!access.token) return { status: access.status };
  const timeZone = await sheetTimeZone(endpoint.id, access.token, endpoint.spreadsheetId, endpoint.sheetName);
  const status = await appendValues(access.token, endpoint.spreadsheetId, endpoint.sheetName, [
    sheetRow(job, timeZone),
  ]);
  if (status === 401) accessTokens.delete(endpoint.id);
  return { status };
}

export async function revokeGoogleToken(token: string) {
  await fetch("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
    signal: AbortSignal.timeout(10_000),
  });
}

/** Called by the OAuth callback once `state` and the nonce cookie are verified. */
export async function connectGoogleSheets(
  db: PrismaClient,
  input: { projectId: string; userId: string; code: string },
  google = { exchangeCode, createSpreadsheet },
) {
  // Rights and plan are checked before any call to Google.
  const project = await db.$transaction(async (tx) => {
    const { project } = await requireProjectAdmin(tx, input.projectId, input.userId);
    requirePlanFeature(project.plan, "integrations");
    return project;
  });
  const tokens = await google.exchangeCode(input.code);
  const sheet = await google.createSpreadsheet(tokens.accessToken, `ExtravertyAI · ${project.name}`);
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM project WHERE id = ${input.projectId} FOR UPDATE`;
    const { project: locked } = await requireProjectAdmin(tx, input.projectId, input.userId);
    const count = await tx.integrationEndpoint.count({ where: { projectId: input.projectId } });
    if (count >= MAX_ENDPOINTS) {
      throw new IntegrationError(`${MAX_ENDPOINTS} intégrations au maximum par projet.`);
    }
    const id = randomUUID();
    await tx.integrationEndpoint.create({
      data: {
        id,
        projectId: input.projectId,
        kind: "GOOGLE_SHEETS",
        name: "Google Sheets",
        refreshTokenCiphertext: sealSecret(tokens.refreshToken, id),
        events: integrationEventsForPlan(locked.plan).map((event) => event.id),
        spreadsheetId: sheet.spreadsheetId,
        spreadsheetUrl: sheet.spreadsheetUrl,
        sheetName: sheet.sheetName,
        googleEmail: tokens.email,
        createdById: input.userId,
      },
    });
    return { id, spreadsheetUrl: sheet.spreadsheetUrl };
  });
}

export async function createSpreadsheet(accessToken: string, title: string) {
  const { status, payload } = await googleJson("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json" },
    body: JSON.stringify({
      properties: { title: title.slice(0, 100) },
      sheets: [{ properties: { title: SHEET_NAME } }],
    }),
  });
  const spreadsheetId = typeof payload.spreadsheetId === "string" ? payload.spreadsheetId : null;
  const spreadsheetUrl = typeof payload.spreadsheetUrl === "string" ? payload.spreadsheetUrl : null;
  if (status !== 200 || !spreadsheetId || !spreadsheetUrl?.startsWith("https://docs.google.com/")) {
    throw new IntegrationError("Impossible de créer la feuille Google. Réessayez.");
  }
  await appendValues(accessToken, spreadsheetId, SHEET_NAME, [HEADER]);
  return { spreadsheetId, spreadsheetUrl, sheetName: SHEET_NAME };
}
