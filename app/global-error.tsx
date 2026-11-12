"use client";

// Dernier recours : une erreur dans le layout racine remplace toute la page.
// Ce fichier rend donc lui-même <html> et <body>, sans thème ni polices du
// layout, et signale l’erreur à GlitchTip.
import "./globals.css";
import { CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReportError } from "@/hooks/use-report-error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useReportError(error);
  return (
    <html lang="fr">
      <body className="bg-background text-foreground antialiased">
        <main className="flex min-h-dvh items-center justify-center p-4">
          <div
            role="alert"
            className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm"
          >
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted">
              <CircleAlert aria-hidden="true" className="size-5 text-muted-foreground" />
            </div>
            <h1 className="text-lg font-semibold tracking-tight">
              ExtravertyAI est momentanément indisponible
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              L’incident nous a été signalé. Réessayez dans quelques instants.
            </p>
            <Button type="button" onClick={reset} className="mt-5 gap-2 rounded-xl">
              <RotateCcw aria-hidden="true" className="size-4" />
              Réessayer
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
