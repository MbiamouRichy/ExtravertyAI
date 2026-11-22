import { helpCenterToMarkdown } from "@/lib/help-center/markdown";

// /aide.md : tout le centre d’aide en Markdown, pour les assistants IA et le
// support. Même contenu que docs/centre-aide.md, généré au build.
export const dynamic = "force-static";

export function GET() {
  return new Response(helpCenterToMarkdown(), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Robots-Tag": "noindex",
    },
  });
}
