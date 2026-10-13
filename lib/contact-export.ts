import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { PrismaClient } from "../src/generated/prisma/client";

export async function contactExportSnapshot(
  db: PrismaClient,
  projectId: string,
) {
  const contacts = await db.contact.findMany({
    where: { projectId },
    orderBy: { id: "asc" },
    select: {
      id: true,
      name: true,
      pushName: true,
      phone: true,
      aiActive: true,
      createdAt: true,
    },
  });
  const hash = createHash("sha256")
    .update(JSON.stringify(contacts))
    .digest("hex");
  return { contacts, hash };
}

type Receipt = {
  userId: string;
  projectId: string;
  hash: string;
  format: "csv" | "xlsx";
  expires: number;
};
function signature(value: string) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("Export verification is not configured");
  return createHmac("sha256", secret)
    .update("contact-export:" + value)
    .digest("base64url");
}
export function signExportReceipt(
  input: Omit<Receipt, "expires">,
  now = Date.now(),
) {
  const body = Buffer.from(
    JSON.stringify({ ...input, expires: now + 600000 }),
  ).toString("base64url");
  return body + "." + signature(body);
}
export function verifyExportReceipt(
  token: string,
  expected: Omit<Receipt, "expires">,
  now = Date.now(),
) {
  try {
    if (token.length > 2000) return false;
    const [body, sig, extra] = token.split(".");
    if (!body || !sig || extra) return false;
    const actual = Buffer.from(sig),
      wanted = Buffer.from(signature(body));
    if (actual.length !== wanted.length || !timingSafeEqual(actual, wanted))
      return false;
    const data = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as Receipt;
    return (
      data.expires > now &&
      data.expires <= now + 600000 &&
      Object.entries(expected).every(
        ([key, value]) => data[key as keyof Receipt] === value,
      )
    );
  } catch {
    return false;
  }
}
