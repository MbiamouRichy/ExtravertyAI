import { test, expect } from "@playwright/test";
import { build } from "esbuild";

test("account theme overrides browser storage, preserves edits and updates for another account", async ({ page }) => {
  test.setTimeout(120000);
  const bundle = await build({
    stdin: {
      contents: `
        import React, { useState } from "react";
        import { createRoot } from "react-dom/client";
        import { ThemeProvider, useTheme } from "next-themes";
        import { AccountThemeSync } from "./components/dashboard/account-theme-sync";
        function Fixture() {
          const [account, setAccount] = useState({ userId: "first", theme: "dark" });
          const { theme, setTheme } = useTheme();
          return <>
            <AccountThemeSync {...account} />
            <output>{theme}</output>
            <button onClick={() => setTheme("light")}>Edit</button>
            <button onClick={() => setAccount({ userId: "first", theme: "system" })}>Server update</button>
            <button onClick={() => setAccount({ userId: "second", theme: "dark" })}>Switch account</button>
          </>;
        }
        createRoot(document.getElementById("root")).render(<React.StrictMode><ThemeProvider attribute="class" defaultTheme="system"><Fixture /></ThemeProvider></React.StrictMode>);
      `,
      resolveDir: process.cwd(), loader: "tsx",
    },
    bundle: true, write: false, platform: "browser", jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
  });
  await page.route("http://theme.test/**", (route) => route.fulfill({ contentType: "text/html", body: '<div id="root"></div>' }));
  await page.addInitScript(() => localStorage.setItem("theme", "light"));
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("http://theme.test/");
  await page.addScriptTag({ content: bundle.outputFiles[0].text });
  await expect(page.locator("output")).toHaveText("dark");
  await expect(page.locator("html")).toHaveClass("dark");
  expect(await page.evaluate(() => localStorage.getItem("theme"))).toBe("dark");
  await page.getByText("Edit", { exact: true }).click();
  await expect(page.locator("html")).toHaveClass("light");
  await expect(page.locator("output")).toHaveText("light");
  await page.getByText("Server update", { exact: true }).click();
  await expect(page.locator("output")).toHaveText("system");
  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveClass("dark");
  await page.getByText("Edit", { exact: true }).click();
  await page.getByText("Switch account", { exact: true }).click();
  await expect(page.locator("output")).toHaveText("dark");
  await expect(page.locator("html")).toHaveClass("dark");
});
