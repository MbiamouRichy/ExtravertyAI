import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

config({ path: ".env.e2e.local", quiet: true });
const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) throw new Error("Définir E2E_BASE_URL dans .env.e2e.local.");
const target = new URL(baseURL);
if (
  target.username ||
  target.password ||
  target.search ||
  target.hash ||
  target.pathname !== "/"
)
  throw new Error(
    "E2E_BASE_URL doit être une origine sans identifiants ni paramètres.",
  );

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: target.origin,
    channel: process.env.E2E_BROWSER_CHANNEL || undefined,
    // Avoid recording login credentials and protection bypass secrets.
    trace: "off",
    screenshot: "off",
    video: "off",
  },
  projects: [
    { name: "api", testMatch: /.*\.api\.spec\.ts/ },
    {
      name: "desktop",
      testMatch: /.*\.browser\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      testMatch: /.*\.browser\.spec\.ts/,
      use: { ...devices["Pixel 7"] },
    },
  ],
});
