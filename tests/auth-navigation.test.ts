import { test } from "node:test";
import assert from "node:assert/strict";
import { enterSignedInApp } from "../lib/auth-navigation";

function fakeLocation() {
  const replaced: string[] = [];
  return { replaced, location: { replace: (url: string | URL) => void replaced.push(String(url)) } };
}

test("after sign-in, the app is loaded in full, replacing the sign-in page in history", () => {
  const { replaced, location } = fakeLocation();
  void enterSignedInApp("/projects", location);
  void enterSignedInApp("/projects/p1/settings?tab=team#account-security", location);
  assert.deepEqual(replaced, ["/projects", "/projects/p1/settings?tab=team#account-security"]);
});

test("after sign-in, an external or malformed destination falls back to the projects", () => {
  for (const destination of [
    "https://evil.example/projects",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "",
  ]) {
    const { replaced, location } = fakeLocation();
    void enterSignedInApp(destination, location);
    assert.deepEqual(replaced, ["/projects"], destination);
  }
});

test("after sign-in, the returned promise never settles, so pending states stay until the page leaves", async () => {
  const { location } = fakeLocation();
  const outcome = await Promise.race([
    enterSignedInApp("/projects", location).then(
      () => "resolved",
      () => "rejected",
    ),
    new Promise((resolve) => setTimeout(() => resolve("pending"), 20)),
  ]);
  assert.equal(outcome, "pending");
});
