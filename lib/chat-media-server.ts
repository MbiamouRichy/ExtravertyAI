import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  MAX_MEDIA_BYTES,
  MEDIA_TYPES,
  mediaKind,
  safeMediaFilename,
  type MediaMime,
} from "./chat-media";
const Ticket = z.object({
  projectId: z.string().cuid(),
  userId: z.string().min(1),
  requestId: z.string().uuid(),
  key: z.string().max(500),
  mime: z.enum(Object.keys(MEDIA_TYPES) as [MediaMime, ...MediaMime[]]),
  expires: z.number(),
});
function signature(body: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("MEDIA_CONFIG_MISSING");
  return createHmac("sha256", secret)
    .update(`chat-media:${body}`)
    .digest("base64url");
}
export function signMediaTicket(data: z.infer<typeof Ticket>) {
  const body = Buffer.from(JSON.stringify(Ticket.parse(data))).toString(
    "base64url",
  );
  return `${body}.${signature(body)}`;
}
export function verifyMediaTicket(
  token: string,
  projectId: string,
  userId: string,
  requestId: string,
  allowExpired = false,
) {
  const [body, mac, extra] = token.split(".");
  if (!body || !mac || extra) throw new Error("MEDIA_INVALID");
  const expected = signature(body);
  const actual = Buffer.from(mac);
  if (
    actual.length !== Buffer.byteLength(expected) ||
    !timingSafeEqual(actual, Buffer.from(expected))
  )
    throw new Error("MEDIA_INVALID");
  const ticket = Ticket.parse(
    JSON.parse(Buffer.from(body, "base64url").toString()),
  );
  if (
    ticket.projectId !== projectId ||
    ticket.userId !== userId ||
    ticket.requestId !== requestId ||
    (!allowExpired && ticket.expires < Date.now()) ||
    !ticket.key.startsWith(`chat-media/${projectId}/`)
  )
    throw new Error("MEDIA_INVALID");
  return ticket;
}
export function validateMediaBytes(
  bytes: Uint8Array,
  mime: string,
): asserts mime is MediaMime {
  const b = Buffer.from(bytes);
  const ascii = (start: number, end: number) => b.toString("ascii", start, end);
  const valid =
    mime === "image/jpeg"
      ? b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
      : mime === "image/png"
        ? b
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : mime === "image/webp"
          ? ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP"
          : mime === "audio/ogg"
            ? ascii(0, 4) === "OggS"
            : mime === "audio/mpeg"
              ? ascii(0, 3) === "ID3" ||
                (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)
              : mime === "audio/mp4" || mime === "video/mp4"
                ? ascii(4, 8) === "ftyp"
                : mime === "audio/wav"
                  ? ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE"
                  : mime === "audio/webm" || mime === "video/webm"
                    ? b
                        .subarray(0, 4)
                        .equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
                    : mime === "application/pdf"
                      ? ascii(0, 5) === "%PDF-"
                      : [
                            "application/msword",
                            "application/vnd.ms-excel",
                            "application/vnd.ms-powerpoint",
                          ].includes(mime)
                        ? b
                            .subarray(0, 8)
                            .equals(
                              Buffer.from([
                                0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1,
                              ]),
                            )
                        : mime === "application/zip" ||
                            mime.startsWith(
                              "application/vnd.openxmlformats-officedocument.",
                            )
                          ? b[0] === 0x50 &&
                            b[1] === 0x4b &&
                            b[2] === 3 &&
                            b[3] === 4
                          : ["text/plain", "text/csv"].includes(mime)
                            ? !b.includes(0) &&
                              (() => {
                                try {
                                  new TextDecoder("utf-8", {
                                    fatal: true,
                                  }).decode(b);
                                  return true;
                                } catch {
                                  return false;
                                }
                              })()
                            : false;
  if (
    !Object.hasOwn(MEDIA_TYPES, mime) ||
    !valid ||
    !b.length ||
    b.length > MAX_MEDIA_BYTES
  )
    throw new Error("MEDIA_INVALID");
}
export async function readLimitedBody(
  stream: ReadableStream<Uint8Array> | null,
  limit: number,
) {
  if (!stream) throw new Error("EMPTY_BODY");
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new Error("MEDIA_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function readStoredMedia(key: string, projectId: string) {
  if (!key.startsWith(`chat-media/${projectId}/`) || key.includes(".."))
    throw new Error("MEDIA_INVALID");
  const { s3Client } = await import("./storage");
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const result = await s3Client.send(
    new GetObjectCommand({ Bucket: process.env.MINIO_BUCKET, Key: key }),
    { abortSignal: AbortSignal.timeout(15_000) },
  );
  if (!result.Body) throw new Error("MEDIA_MISSING");
  const bytes = await readLimitedBody(
    result.Body.transformToWebStream(),
    MAX_MEDIA_BYTES,
  );
  const mime = result.ContentType?.split(";")[0].trim() || "";
  validateMediaBytes(bytes, mime);
  return {
    bytes,
    mime,
    filename: safeMediaFilename(
      decodeURIComponent(result.Metadata?.filename || ""),
      mime,
    ),
  };
}
export async function readProviderMedia(message: {
  evolutionId: string;
  fromMe: boolean;
  remoteJid: string;
  instanceName: string;
  type: string;
}) {
  const base = process.env.EVOLUTION_API_URL?.replace(/\/+$/, "");
  const key = process.env.EVOLUTION_API_KEY;
  if (!base || !key) throw new Error("MEDIA_CONFIG_MISSING");
  const response = await fetch(
    `${base}/chat/getBase64FromMediaMessage/${encodeURIComponent(message.instanceName)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key },
      body: JSON.stringify({
        message: {
          key: {
            id: message.evolutionId,
            fromMe: message.fromMe,
            remoteJid: message.remoteJid,
          },
        },
        convertToMp4: false,
      }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
      redirect: "error",
    },
  );
  if (!response.ok) throw new Error("MEDIA_PROVIDER_UNAVAILABLE");
  const raw = await readLimitedBody(
    response.body,
    Math.ceil((MAX_MEDIA_BYTES * 4) / 3) + 65536,
  );
  const payload = z
    .object({ base64: z.string(), mimetype: z.string() })
    .parse(JSON.parse(raw.toString()));
  const encoded = payload.base64.replace(/^data:[^,]+;base64,/, "");
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) throw new Error("MEDIA_INVALID");
  const bytes = Buffer.from(encoded, "base64");
  const mime = payload.mimetype.split(";")[0].trim().toLowerCase();
  validateMediaBytes(bytes, mime);
  if (mediaKind(mime) !== message.type) throw new Error("MEDIA_INVALID");
  return { bytes, mime, filename: safeMediaFilename("", mime) };
}

// Browser audio players (notably Safari) request byte ranges when seeking.
export function mediaResponse(
  bytes: Uint8Array,
  mime: string,
  range: string | null,
  filename?: string,
) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
    "Content-Type": mime,
    "Content-Disposition":
      mediaKind(mime) === "DOCUMENT"
        ? "attachment; filename*=UTF-8''" +
          encodeURIComponent(safeMediaFilename(filename || "", mime)).replace(
            /['()*]/g,
            (char) => "%" + char.charCodeAt(0).toString(16),
          )
        : "inline",
    "Accept-Ranges": "bytes",
  };
  if (!range)
    return new Response(new Uint8Array(bytes), {
      headers: { ...headers, "Content-Length": String(bytes.length) },
    });
  const match = /^bytes=(\d*)-(\d*)$/.exec(range);
  const start = match?.[1]
    ? Number(match[1])
    : Math.max(0, bytes.length - Number(match?.[2]));
  const end =
    match?.[1] && match[2]
      ? Math.min(Number(match[2]), bytes.length - 1)
      : bytes.length - 1;
  if (
    !match ||
    (!match[1] && !match[2]) ||
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start > end ||
    start >= bytes.length
  ) {
    return new Response(null, {
      status: 416,
      headers: { ...headers, "Content-Range": `bytes */${bytes.length}` },
    });
  }
  const body = new Uint8Array(bytes.slice(start, end + 1));
  return new Response(body, {
    status: 206,
    headers: {
      ...headers,
      "Content-Length": String(body.length),
      "Content-Range": `bytes ${start}-${end}/${bytes.length}`,
    },
  });
}
