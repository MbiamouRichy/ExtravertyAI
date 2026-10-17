import type { ReactNode } from "react";
import { Crimson_Text } from "next/font/google";

// The root layout only ships Crimson Text upright; editorial accents need the
// real italic cut rather than a synthesized slant.
const serifItalic = Crimson_Text({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600"],
  style: ["italic"],
  variable: "--font-vitrine-serif",
  display: "swap",
});

export default function VitrineLayout({ children }: { children: ReactNode }) {
  return <div className={serifItalic.variable}>{children}</div>;
}
