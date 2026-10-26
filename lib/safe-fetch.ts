import { lookup as dnsLookup } from "node:dns/promises";
import type { IncomingHttpHeaders } from "node:http";
import { request } from "node:https";
import { isIP, type LookupFunction } from "node:net";

/**
 * Outbound HTTP for user-supplied URLs (web imports, webhooks).
 * Every connection resolves through a guarded lookup, so a hostname that
 * points (or later re-points) to a private address is refused at connect time.
 */

export type SafeFetchErrorCode =
  | "INVALID_URL"
  | "BLOCKED_ADDRESS"
  | "TOO_LARGE"
  | "TIMEOUT"
  | "TOO_MANY_REDIRECTS"
  | "NETWORK";

export class SafeFetchError extends Error {
  constructor(readonly code: SafeFetchErrorCode) {
    super(code);
  }
}

const BLOCKED_V4: ReadonlyArray<readonly [string, number]> = [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.88.99.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
];

function ipv4ToInt(address: string): number {
  return address
    .split(".")
    .reduce((value, part) => value * 256 + Number(part), 0);
}

function blockedV4(address: string): boolean {
  if (isIP(address) !== 4) return true;
  const value = ipv4ToInt(address);
  return BLOCKED_V4.some(([base, bits]) => {
    const size = 2 ** (32 - bits);
    const start = ipv4ToInt(base);
    return value >= start && value < start + size;
  });
}

/** Expands an IPv6 address to eight 16-bit groups, or null when malformed. */
function ipv6Groups(address: string): number[] | null {
  let text = address;
  const dotted = text.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (dotted) {
    if (isIP(dotted[1]) !== 4) return null;
    const value = ipv4ToInt(dotted[1]);
    text =
      text.slice(0, -dotted[1].length) +
      `${(value >>> 16).toString(16)}:${(value & 0xffff).toString(16)}`;
  }
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const parts = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  const groups = parts.map((part) => (/^[0-9a-f]{1,4}$/.test(part) ? parseInt(part, 16) : NaN));
  return groups.some(Number.isNaN) ? null : groups;
}

export function isBlockedAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return blockedV4(address);
  if (version !== 6 || address.includes("%")) return true;
  const groups = ipv6Groups(address.toLowerCase());
  if (!groups) return true;
  const [first, second] = groups;
  const embeddedV4 = `${groups[6] >>> 8}.${groups[6] & 255}.${groups[7] >>> 8}.${groups[7] & 255}`;
  const prefixZero = (count: number) => groups.slice(0, count).every((group) => group === 0);
  if (prefixZero(8)) return true; // ::
  if (prefixZero(7) && groups[7] === 1) return true; // ::1
  if (prefixZero(5) && groups[5] === 0xffff) return blockedV4(embeddedV4); // IPv4-mapped
  if (prefixZero(6)) return blockedV4(embeddedV4); // IPv4-compatible
  if (first === 0x64 && second === 0xff9b) return blockedV4(embeddedV4); // NAT64
  if ((first & 0xfe00) === 0xfc00) return true; // unique local
  if ((first & 0xffc0) === 0xfe80) return true; // link-local
  if ((first & 0xff00) === 0xff00) return true; // multicast
  if (first === 0x2001 && second === 0x0db8) return true; // documentation
  return false;
}

const ALLOWED_PORTS = new Set(["", "443", "8443"]);
const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa", ".lan"];

/** HTTPS only, no credentials, standard ports, no private or local host. */
export function parsePublicUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new SafeFetchError("INVALID_URL");
  }
  if (url.protocol !== "https:" || url.username || url.password || !ALLOWED_PORTS.has(url.port)) {
    throw new SafeFetchError("INVALID_URL");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (
    !host ||
    host === "localhost" ||
    BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix)) ||
    (isIP(host) !== 0 && isBlockedAddress(host)) ||
    (isIP(host) === 0 && !host.includes("."))
  ) {
    throw new SafeFetchError("BLOCKED_ADDRESS");
  }
  return url;
}

export type Resolver = (
  hostname: string,
) => Promise<ReadonlyArray<{ address: string; family: number }>>;

const systemResolver: Resolver = (hostname) =>
  dnsLookup(hostname, { all: true, verbatim: true });

/** Refuses the whole hostname as soon as one of its records is private. */
export function createGuardedLookup(resolve: Resolver = systemResolver): LookupFunction {
  return (hostname, options, callback) => {
    resolve(hostname).then(
      (addresses) => {
        if (!addresses.length || addresses.some((entry) => isBlockedAddress(entry.address))) {
          callback(new SafeFetchError("BLOCKED_ADDRESS"), "", 0);
          return;
        }
        if (options.all) {
          callback(
            null,
            addresses.map(({ address, family }) => ({ address, family })),
          );
          return;
        }
        callback(null, addresses[0].address, addresses[0].family);
      },
      () => callback(new SafeFetchError("NETWORK"), "", 0),
    );
  };
}

export type SafeResponse = {
  status: number;
  headers: IncomingHttpHeaders;
  body: Buffer;
  url: string;
};

export type SafeRequestInit = {
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
};

const USER_AGENT = "ExtravertyAI/1.0 (+https://extravertyai.com)";
const REDIRECTS = new Set([301, 302, 303, 307, 308]);

function sendOnce(
  url: URL,
  init: SafeRequestInit,
  deadline: number,
  lookup: LookupFunction,
): Promise<SafeResponse> {
  return new Promise((resolve, reject) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      reject(new SafeFetchError("TIMEOUT"));
      return;
    }
    const maxBytes = init.maxBytes ?? 2 * 1024 * 1024;
    const req = request(
      url,
      {
        method: init.method ?? "GET",
        // A fresh socket per request keeps the guarded lookup on every connection.
        agent: false,
        lookup,
        headers: {
          "user-agent": USER_AGENT,
          ...init.headers,
          ...(init.body !== undefined
            ? { "content-length": String(Buffer.byteLength(init.body)) }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on("data", (chunk: Buffer) => {
          size += chunk.length;
          if (size > maxBytes) {
            req.destroy(new SafeFetchError("TOO_LARGE"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks),
            url: url.toString(),
          }),
        );
        res.on("error", () => undefined);
      },
    );
    const timer = setTimeout(() => req.destroy(new SafeFetchError("TIMEOUT")), remaining);
    req.on("close", () => clearTimeout(timer));
    req.on("error", (error) => {
      clearTimeout(timer);
      reject(error instanceof SafeFetchError ? error : new SafeFetchError("NETWORK"));
    });
    if (init.body !== undefined) req.write(init.body);
    req.end();
  });
}

/**
 * GET requests follow up to `maxRedirects` redirects, each target re-validated.
 * POST requests never follow redirects: the 3xx response is returned as is.
 */
export async function safeRequest(
  rawUrl: string,
  init: SafeRequestInit = {},
  lookup: LookupFunction = createGuardedLookup(),
): Promise<SafeResponse> {
  let url = parsePublicUrl(rawUrl);
  const deadline = Date.now() + (init.timeoutMs ?? 10000);
  const maxRedirects = init.maxRedirects ?? 3;
  for (let redirects = 0; ; redirects++) {
    const response = await sendOnce(url, init, deadline, lookup);
    const location = response.headers.location;
    if ((init.method ?? "GET") !== "GET" || !REDIRECTS.has(response.status) || !location) {
      return response;
    }
    if (redirects >= maxRedirects) throw new SafeFetchError("TOO_MANY_REDIRECTS");
    url = parsePublicUrl(new URL(location, url).toString());
  }
}
