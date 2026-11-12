import { test } from "node:test";
import assert from "node:assert/strict";
import { isMaquettesPath, maquettesEnabled } from "../lib/maquettes";

test("prototypes are served in development and previews, never in production", () => {
  assert.equal(maquettesEnabled({ NODE_ENV: "development" }), true);
  assert.equal(maquettesEnabled({ NODE_ENV: "production", VERCEL_ENV: "preview" }), true);
  assert.equal(maquettesEnabled({ NODE_ENV: "production", VERCEL_ENV: "production" }), false);
  // A production build outside Vercel (next start) hides them too.
  assert.equal(maquettesEnabled({ NODE_ENV: "production" }), false);
});

test("only the /maquettes tree is concerned", () => {
  assert.equal(isMaquettesPath("/maquettes"), true);
  assert.equal(isMaquettesPath("/maquettes/vitrine"), true);
  assert.equal(isMaquettesPath("/maquettes-publiques"), false);
  assert.equal(isMaquettesPath("/projects/abc"), false);
});
