import prisma from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import {
  PageViewSchema,
  classifyUserAgent,
  countryFromHeader,
  isBot,
  normalizePath,
  recordPageView,
  referrerHost,
  visitorHash,
} from "@/lib/site-analytics";

const MAX_BODY = 2048;
const done = () => new Response(null, { status: 204 });

/**
 * Pages vues, envoyées par le navigateur (sendBeacon). Toujours 204 : rien
 * n'indique à un robot ou à un autre site si la vue a été comptée.
 */
export async function POST(request: Request) {
  const headers = request.headers;
  const host = headers.get("host");
  // Seules les pages du site lui-même peuvent déclarer une vue.
  const origin = headers.get("origin");
  if (headers.get("sec-fetch-site") === "cross-site") return done();
  if (origin) {
    try {
      if (new URL(origin).host !== host) return done();
    } catch {
      return done();
    }
  }
  // Signal de refus du suivi : respecté côté serveur aussi.
  if (headers.get("sec-gpc") === "1" || headers.get("dnt") === "1") return done();
  const userAgent = (headers.get("user-agent") ?? "").slice(0, 400);
  if (isBot(userAgent)) return done();
  const ip =
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  if (!allowRequest(`pv:${ip}`, 60, 60_000)) return done();
  const secret = process.env.ANALYTICS_SALT || process.env.BETTER_AUTH_SECRET;
  if (!secret) return done();

  try {
    const text = await request.text();
    if (text.length > MAX_BODY) return done();
    const parsed = PageViewSchema.safeParse(JSON.parse(text));
    if (!parsed.success) return done();
    const path = normalizePath(parsed.data.path);
    if (!path) return done();
    await recordPageView(prisma, {
      visitorHash: visitorHash(secret, ip, userAgent),
      path,
      country: countryFromHeader(headers.get("x-vercel-ip-country")),
      ...classifyUserAgent(userAgent),
      referrerHost: referrerHost(parsed.data.referrer, host),
    });
  } catch {
    // Une mesure perdue ne doit jamais gêner la navigation.
  }
  return done();
}
