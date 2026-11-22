import { test } from "node:test";
import assert from "node:assert/strict";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import type { PrismaClient } from "../src/generated/prisma/client";
import { AUTH_RATE_LIMIT } from "../lib/auth-rate-limit";
import { withTestDatabase } from "./helpers/database";

const BASE = "http://localhost:3000";

// Une instance Better Auth par « instance Vercel », toutes sur la même base.
function serverInstance(prisma: PrismaClient) {
  return betterAuth({
    baseURL: BASE,
    secret: "test-secret-for-rate-limits-0123456789abcdef",
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    emailAndPassword: { enabled: true },
    // Activées comme en production et en préversion.
    rateLimit: { ...AUTH_RATE_LIMIT, enabled: true },
    logger: { disabled: true },
  });
}

type Auth = ReturnType<typeof serverInstance>;

// Corps vide : refusé par la validation, mais compté avant elle, sans hachage.
function call(auth: Auth, path: string, ip: string, method = "POST") {
  return auth.handler(
    new Request(`${BASE}/api/auth${path}`, {
      method,
      headers: { "content-type": "application/json", origin: BASE, "x-forwarded-for": ip },
      ...(method === "POST" ? { body: "{}" } : {}),
    }),
  );
}

test("sign-in attempts are counted in the database and shared by every server instance", async () => {
  await withTestDatabase(async (prisma) => {
    const [first, second] = [serverInstance(prisma), serverInstance(prisma)];
    const statuses = [];
    for (const auth of [first, second, first, second]) {
      statuses.push((await call(auth, "/sign-in/email", "203.0.113.7")).status);
    }
    assert.deepEqual(
      statuses.map((status) => status === 429),
      [false, false, false, true],
      `statuts : ${statuses.join(", ")}`,
    );
    assert.notEqual((await call(second, "/sign-in/email", "203.0.113.8")).status, 429);
    const rows = await prisma.rateLimit.findMany({ select: { key: true, count: true } });
    assert.deepEqual(
      rows.map((row) => row.key).sort(),
      ["203.0.113.7|/sign-in/email", "203.0.113.8|/sign-in/email"],
    );
  });
});

test("password account creation is capped at 10 per hour and per IP", async () => {
  await withTestDatabase(async (prisma) => {
    const [first, second] = [serverInstance(prisma), serverInstance(prisma)];
    for (let attempt = 0; attempt < 10; attempt++) {
      const response = await call(attempt % 2 ? second : first, "/sign-up/email", "198.51.100.4");
      assert.notEqual(response.status, 429, `essai ${attempt + 1}`);
    }
    const blocked = await call(first, "/sign-up/email", "198.51.100.4");
    assert.equal(blocked.status, 429);
    // Une heure entière avant de pouvoir recommencer.
    assert.ok(Number(blocked.headers.get("X-Retry-After")) > 59 * 60);
  });
});

test("reading the session is never throttled nor written to the counters", async () => {
  await withTestDatabase(async (prisma) => {
    const auth = serverInstance(prisma);
    for (let attempt = 0; attempt < 5; attempt++) {
      assert.notEqual((await call(auth, "/get-session", "192.0.2.9", "GET")).status, 429);
    }
    assert.equal(await prisma.rateLimit.count(), 0);
  });
});
