import { KNOWLEDGE_LIMITS } from "./knowledge-shared";
import { KnowledgeError, type KnowledgeExtractors } from "./knowledge";
import { safeRequest } from "./safe-fetch";

const HTML_TYPES = new Set(["text/html", "application/xhtml+xml"]);

/** Public page → readable article text. Network access goes through safeRequest only. */
export async function fetchWebPage(url: string): Promise<{ title: string; text: string }> {
  const response = await safeRequest(url, {
    timeoutMs: 15_000,
    maxBytes: KNOWLEDGE_LIMITS.webMaxBytes,
    headers: { accept: "text/html,application/xhtml+xml,text/plain;q=0.9" },
  });
  if (response.status >= 400) throw new KnowledgeError(`HTTP_${response.status}`);
  const type = String(response.headers["content-type"] ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const raw = response.body.toString("utf8");
  if (type === "text/plain") return { title: "", text: raw };
  if (!HTML_TYPES.has(type)) throw new KnowledgeError("UNSUPPORTED_TYPE");
  return htmlToText(raw);
}

export async function htmlToText(raw: string): Promise<{ title: string; text: string }> {
  const [{ parseHTML }, { Readability }] = await Promise.all([
    import("linkedom"),
    import("@mozilla/readability"),
  ]);
  const { document } = parseHTML(raw);
  // Scripts, styles and forms never carry business knowledge.
  for (const node of document.querySelectorAll("script, style, noscript, template, form, iframe")) {
    node.remove();
  }
  const title = (document.title || "").trim();
  const article = new Readability(document as unknown as Document).parse();
  const text = (article?.textContent || document.body?.textContent || "").trim();
  return { title: (article?.title || title).trim().slice(0, 150), text };
}

export async function readKnowledgePdf(
  key: string,
  projectId: string,
): Promise<{ title: string; text: string }> {
  if (!key.startsWith(`knowledge/${projectId}/`) || key.includes("..")) {
    throw new KnowledgeError("PDF_INVALID");
  }
  const [{ s3Client }, { GetObjectCommand }, { readLimitedBody }] = await Promise.all([
    import("./storage"),
    import("@aws-sdk/client-s3"),
    import("./chat-media-server"),
  ]);
  const result = await s3Client.send(
    new GetObjectCommand({ Bucket: process.env.MINIO_BUCKET, Key: key }),
    { abortSignal: AbortSignal.timeout(30_000) },
  );
  if (!result.Body) throw new KnowledgeError("PDF_INVALID");
  const bytes = await readLimitedBody(result.Body.transformToWebStream(), KNOWLEDGE_LIMITS.pdfMaxBytes);
  return extractPdfText(bytes);
}

export async function extractPdfText(bytes: Uint8Array): Promise<{ title: string; text: string }> {
  const { extractText, getDocumentProxy } = await import("unpdf");
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>>;
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes));
  } catch {
    throw new KnowledgeError("PDF_INVALID");
  }
  if (pdf.numPages > KNOWLEDGE_LIMITS.pdfMaxPages) throw new KnowledgeError("PDF_TOO_MANY_PAGES");
  const { text } = await extractText(pdf, { mergePages: false });
  return { title: "", text: (Array.isArray(text) ? text : [text]).join("\n\n") };
}

export const knowledgeExtractors: KnowledgeExtractors = {
  fetchPage: fetchWebPage,
  readPdf: readKnowledgePdf,
};

export async function storeKnowledgeFile(key: string, bytes: Buffer) {
  const [{ s3Client }, { PutObjectCommand }] = await Promise.all([
    import("./storage"),
    import("@aws-sdk/client-s3"),
  ]);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.MINIO_BUCKET,
      Key: key,
      Body: bytes,
      ContentType: "application/pdf",
    }),
    { abortSignal: AbortSignal.timeout(30_000) },
  );
}

export async function removeKnowledgeFile(key: string) {
  const [{ s3Client }, { DeleteObjectCommand }] = await Promise.all([
    import("./storage"),
    import("@aws-sdk/client-s3"),
  ]);
  await s3Client.send(new DeleteObjectCommand({ Bucket: process.env.MINIO_BUCKET, Key: key }), {
    abortSignal: AbortSignal.timeout(15_000),
  });
}
