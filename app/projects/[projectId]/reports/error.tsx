"use client";
import { Button } from "@/components/ui/button";
import { useReportError } from "@/hooks/use-report-error";
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useReportError(error);
  return (
    <div role="alert" className="space-y-4 p-6">
      <h2 className="text-xl font-semibold">
        Les rapports sont momentanément indisponibles
      </h2>
      <p className="text-muted-foreground">
        Réessayez dans quelques instants. Si le problème persiste, contactez le
        support.
      </p>
      <Button onClick={reset}>Réessayer</Button>
    </div>
  );
}
