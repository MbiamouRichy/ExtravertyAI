"use client";

import { useLayoutEffect, useRef } from "react";
import { useTheme } from "next-themes";

// The account preference overrides this browser's local value when loaded or
// refreshed. Do not reapply unchanged server props during an optimistic edit.
export function AccountThemeSync({
  userId,
  theme,
}: {
  userId: string;
  theme: "light" | "dark" | "system";
}) {
  const { setTheme } = useTheme();
  const applied = useRef<string | null>(null);
  useLayoutEffect(() => {
    const version = `${userId}:${theme}`;
    if (applied.current === version) return;
    applied.current = version;
    setTheme(theme);
  }, [userId, theme, setTheme]);
  return null;
}
