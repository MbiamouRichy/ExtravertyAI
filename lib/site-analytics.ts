import { createHmac } from "node:crypto";
import { UAParser } from "ua-parser-js";
import { z } from "zod";
import type { PrismaClient } from "../src/generated/prisma/client";

/** Audience gardée 25 mois : de quoi comparer deux années, pas davantage. */
export const PAGE_VIEW_RETENTION_DAYS = 25 * 31;

export const PageViewSchema = z.object({
  path: z.string().max(500),
  referrer: z.string().max(1000).optional(),
});

const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse|monitor|curl|wget|python|axios|node-fetch|go-http/i;
export function isBot(userAgent: string) {
  return !userAgent || BOT.test(userAgent);
}

// Identifiants (cuid, uuid, longs nombres) remplacés : une page = une ligne,
// et aucun identifiant de projet ou de contact dans les statistiques.
const ID_SEGMENT = /^(c[a-z0-9]{20,}|[0-9a-f]{8}-[0-9a-f-]{27,}|\d{5,}|[A-Za-z0-9_-]{32,})$/;
export function normalizePath(raw: string): string | null {
  const path = raw.split(/[?#]/)[0] ?? "";
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  const segments = path
    .split("/")
    .filter(Boolean)
    .map((segment) => (ID_SEGMENT.test(segment) ? ":id" : segment.toLowerCase()));
  const normalized = `/${segments.join("/")}`.slice(0, 200);
  // Le back-office et l'API ne comptent pas comme audience.
  if (/^\/(admin|api)(\/|$)/.test(normalized)) return null;
  if (!/^\/[\w\-/:.]*$/.test(normalized)) return null;
  return normalized;
}

/** Site d'origine seul (jamais l'URL complète), hors navigation interne. */
export function referrerHost(referrer: string | undefined, ownHost: string | null) {
  if (!referrer) return null;
  try {
    const url = new URL(referrer);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    const own = ownHost?.toLowerCase().split(":")[0].replace(/^www\./, "");
    if (!host || host === own) return null;
    return host.slice(0, 100);
  } catch {
    return null;
  }
}

const BROWSERS = ["Chrome", "Safari", "Edge", "Firefox", "Opera", "Samsung Internet"];
export function classifyUserAgent(userAgent: string) {
  const result = new UAParser(userAgent).getResult();
  const name = result.browser.name ?? "";
  const browser =
    BROWSERS.find((family) => name.includes(family)) ??
    (/safari/i.test(name) ? "Safari" : /chrom/i.test(name) ? "Chrome" : "Autre");
  const type = result.device.type;
  const device = type === "mobile" ? "mobile" : type === "tablet" ? "tablet" : "desktop";
  return { browser, device };
}

export function countryFromHeader(value: string | null) {
  return value && /^[A-Z]{2}$/.test(value) && value !== "XX" ? value : null;
}

/** Même personne, même jour : même empreinte. Le lendemain, elle change. */
export function visitorHash(secret: string, ip: string, userAgent: string, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  return createHmac("sha256", secret)
    .update(`${day}|${ip}|${userAgent}`)
    .digest("base64url")
    .slice(0, 22);
}

export async function recordPageView(
  db: PrismaClient,
  view: {
    visitorHash: string;
    path: string;
    country: string | null;
    browser: string;
    device: string;
    referrerHost: string | null;
  },
  now = new Date(),
) {
  await db.pageView.create({ data: { ...view, createdAt: now } });
  // Purge opportuniste : environ une écriture sur 500.
  if (Math.random() < 0.002)
    await db.pageView.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - PAGE_VIEW_RETENTION_DAYS * 86_400_000) } },
    });
}
