import { test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { config, proxy } from "../proxy";
import { safeAuthCallback } from "../lib/auth-redirects";

const ORIGIN = "https://app.example.test";

function call(path: string, init: { method?: string; cookie?: string } = {}) {
  return proxy(
    new NextRequest(`${ORIGIN}${path}`, {
      method: init.method ?? "GET",
      headers: init.cookie ? { cookie: init.cookie } : {},
    }),
  );
}

test("a visitor without a session gets a real redirect to sign-in, with a safe callback", () => {
  const response = call("/projects/cmuhe8ap1000004l64j9yddk1/chat?contact=abc&_rsc=1x2y");
  assert.equal(response.status, 307);
  const location = new URL(response.headers.get("location")!);
  assert.equal(location.origin, ORIGIN);
  assert.equal(location.pathname, "/sign-in");
  const callback = location.searchParams.get("callbackUrl")!;
  // Paramètre interne du routeur retiré ; chemin relatif accepté tel quel.
  assert.equal(callback, "/projects/cmuhe8ap1000004l64j9yddk1/chat?contact=abc");
  assert.equal(safeAuthCallback(callback), callback);
});

test("a session cookie, in secure or plain form, lets the page run its own checks", () => {
  for (const cookie of [
    "__Secure-better-auth.session_token=token.signature",
    "better-auth.session_token=token.signature",
  ]) {
    const response = call("/projects", { cookie });
    assert.equal(response.headers.get("location"), null, cookie);
    assert.equal(response.headers.get("x-middleware-next"), "1", cookie);
  }
  // Un autre cookie ne suffit pas.
  assert.equal(call("/projects", { cookie: "theme=dark" }).status, 307);
});

test("server actions keep their own error response", () => {
  const response = call("/projects/cmuhe8ap1000004l64j9yddk1/settings", { method: "POST" });
  assert.equal(response.headers.get("location"), null);
});

test("only the signed-in workspace and the mockups are filtered", () => {
  // Les maquettes passent par le proxy pour renvoyer une vraie 404 en production.
  assert.deepEqual(config.matcher, ["/projects/:path*", "/maquettes", "/maquettes/:path*"]);
});
