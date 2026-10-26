import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MAX_MEDIA_BYTES,
  mediaFileError,
  chatMediaFields,
} from "../lib/chat-media";
import {
  mediaResponse,
  readLimitedBody,
  readProviderMedia,
  signMediaTicket,
  verifyMediaTicket,
  validateMediaBytes,
} from "../lib/chat-media-server";
import { SendChatMessageSchema } from "../lib/message-schema";
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const projectId = "cm123456789012345678901234";
const requestId = "c6b42335-d184-4894-9244-0b8509c92eca";

test("media rejects unsupported types, spoofed signatures and oversized bodies", async () => {
  assert.equal(mediaFileError({ type: "image/png", size: 100 }), null);
  assert.ok(mediaFileError({ type: "image/svg+xml", size: 100 }));
  assert.ok(mediaFileError({ type: "image/png", size: MAX_MEDIA_BYTES + 1 }));
  assert.throws(() => validateMediaBytes(Buffer.from("<script>"), "image/png"));
  assert.throws(() => validateMediaBytes(png, "audio/ogg"));
  validateMediaBytes(png, "image/png");
  const stream = new ReadableStream({
    start(c) {
      c.enqueue(new Uint8Array(20));
      c.close();
    },
  });
  await assert.rejects(readLimitedBody(stream, 10), /MEDIA_TOO_LARGE/);
});

test("upload tickets are bound to project, actor, request and expiry", () => {
  const previous = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = "test-secret-only";
  try {
    const ticket = {
      projectId,
      userId: "actor",
      requestId,
      key: `chat-media/${projectId}/image.png`,
      mime: "image/png" as const,
      expires: Date.now() + 10000,
    };
    const token = signMediaTicket(ticket);
    assert.equal(
      verifyMediaTicket(token, projectId, "actor", requestId).key,
      ticket.key,
    );
    assert.throws(() =>
      verifyMediaTicket(
        token,
        "cm223456789012345678901234",
        "actor",
        requestId,
      ),
    );
    assert.throws(() =>
      verifyMediaTicket(token, projectId, "other-actor", requestId),
    );
    assert.throws(() =>
      verifyMediaTicket(token, projectId, "actor", crypto.randomUUID()),
    );
    assert.throws(() =>
      verifyMediaTicket(token + "tamper", projectId, "actor", requestId),
    );
    const expired = signMediaTicket({ ...ticket, expires: 1 });
    assert.throws(() =>
      verifyMediaTicket(expired, projectId, "actor", requestId),
    );
    assert.equal(
      verifyMediaTicket(expired, projectId, "actor", requestId, true).key,
      ticket.key,
    );
  } finally {
    if (previous === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = previous;
  }
});

test("message validation supports attachment-only sends, bounded captions and separate audio text", () => {
  const attachment = { token: "signed", type: "IMAGE", requestId };
  assert.equal(
    SendChatMessageSchema.safeParse({ content: "", attachment }).success,
    true,
  );
  assert.equal(SendChatMessageSchema.safeParse({ content: "" }).success, false);
  assert.equal(
    SendChatMessageSchema.safeParse({ content: "x".repeat(1025), attachment })
      .success,
    false,
  );
  assert.equal(
    SendChatMessageSchema.safeParse({
      content: "hello",
      attachment: { ...attachment, type: "AUDIO" },
    }).success,
    false,
  );
  assert.equal(
    SendChatMessageSchema.safeParse({
      content: "",
      attachment: { ...attachment, type: "AUDIO" },
    }).success,
    true,
  );
  assert.equal(
    chatMediaFields({ id: "one", type: "IMAGE", content: "Caption" }, projectId)
      .content,
    "Caption",
  );
  assert.equal(
    chatMediaFields({ id: "one", type: "AUDIO", content: "[AUDIO]" }, projectId)
      .content,
    "",
  );
});

test("incoming media is fetched by provider ID, never an untrusted media URL", async () => {
  const originalFetch = globalThis.fetch;
  const oldUrl = process.env.EVOLUTION_API_URL,
    oldKey = process.env.EVOLUTION_API_KEY;
  process.env.EVOLUTION_API_URL = "https://evolution.example";
  process.env.EVOLUTION_API_KEY = "test-provider-key";
  try {
    globalThis.fetch = async (url, init) => {
      assert.equal(
        String(url),
        "https://evolution.example/chat/getBase64FromMediaMessage/instance",
      );
      assert.deepEqual(JSON.parse(String(init?.body)), {
        message: {
          key: {
            id: "provider-id",
            fromMe: false,
            remoteJid: "241123@s.whatsapp.net",
          },
        },
        convertToMp4: false,
      });
      return Response.json({
        base64: png.toString("base64"),
        mimetype: "image/png",
      });
    };
    const args = {
      evolutionId: "provider-id",
      fromMe: false,
      remoteJid: "241123@s.whatsapp.net",
      instanceName: "instance",
      type: "IMAGE",
    };
    assert.equal((await readProviderMedia(args)).mime, "image/png");
    await assert.rejects(
      readProviderMedia({ ...args, type: "AUDIO" }),
      /MEDIA_INVALID/,
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (oldUrl === undefined) delete process.env.EVOLUTION_API_URL;
    else process.env.EVOLUTION_API_URL = oldUrl;
    if (oldKey === undefined) delete process.env.EVOLUTION_API_KEY;
    else process.env.EVOLUTION_API_KEY = oldKey;
  }
});

test("private audio responses support seeking and reject invalid ranges", async () => {
  const bytes = new Uint8Array([1, 2, 3, 4, 5]);
  const partial = mediaResponse(bytes, "audio/ogg", "bytes=1-3");
  assert.equal(partial.status, 206);
  assert.equal(partial.headers.get("content-range"), "bytes 1-3/5");
  assert.equal(partial.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(
    new Uint8Array(await partial.arrayBuffer()),
    new Uint8Array([2, 3, 4]),
  );
  assert.equal(mediaResponse(bytes, "audio/ogg", "bytes=10-").status, 416);
  assert.equal(mediaResponse(bytes, "audio/ogg", "bytes=0-1,3-4").status, 416);
  assert.equal(
    mediaResponse(bytes, "audio/ogg", "bytes=-2").headers.get("content-range"),
    "bytes 3-4/5",
  );
});

test("video and document uploads enforce signatures, size and safe download responses", () => {
  const fixtures = [
    [
      "video/mp4",
      Buffer.from([0, 0, 0, 16, 102, 116, 121, 112, 109, 112, 52, 50]),
    ],
    ["application/pdf", Buffer.from("%PDF-1.7\nexample")],
    [
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      Buffer.from([80, 75, 3, 4, 0, 0]),
    ],
    ["text/plain", Buffer.from("Bonjour")],
  ] as const;
  for (const [mime, bytes] of fixtures) {
    assert.equal(mediaFileError({ type: mime, size: bytes.length }), null);
    validateMediaBytes(bytes, mime);
    assert.throws(() =>
      validateMediaBytes(Buffer.alloc(MAX_MEDIA_BYTES + 1), mime),
    );
  }
  assert.throws(() =>
    validateMediaBytes(Buffer.from("not a pdf"), "application/pdf"),
  );
  assert.throws(() =>
    validateMediaBytes(
      Buffer.from([80, 75, 3, 4]),
      "application/vnd.openxmlformats-officedocument.fake",
    ),
  );
  for (const type of ["VIDEO", "DOCUMENT"] as const) {
    assert.equal(
      SendChatMessageSchema.safeParse({
        content: "Légende",
        attachment: { token: "signed", type, requestId },
      }).success,
      true,
    );
    assert.ok(
      chatMediaFields(
        { id: "file", type, content: "[" + type + "]" },
        projectId,
      ).mediaUrl,
    );
    assert.equal(
      chatMediaFields(
        { id: "file", type, content: "[" + type + "]" },
        projectId,
      ).content,
      "",
    );
  }
  const response = mediaResponse(
    Buffer.from("%PDF-1.7"),
    "application/pdf",
    null,
    "rapport.pdf\r\nX-Evil: true",
  );
  assert.ok(
    response.headers.get("content-disposition")?.startsWith("attachment;"),
  );
  assert.equal(response.headers.get("x-evil"), null);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});
