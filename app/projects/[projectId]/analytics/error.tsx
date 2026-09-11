"use client";

import { CircleAlert, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AnalyticsError({
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center p-4 sm:p-6">
            <div
                role="alert"
                className="w-full max-w-md rounded-2xl border bg-card p-6 text-center shadow-sm"
            >
                <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl bg-muted">
                    <CircleAlert
                        aria-hidden="true"
                        className="size-5 text-muted-foreground"
                    />
                </div>

                <h2 className="text-lg font-semibold tracking-tight">
                    Statistiques indisponibles
                </h2>

                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    Impossible de charger les données pour le moment.
                    Réessayez dans quelques instants.
                </p>

                <Button
                    type="button"
                    onClick={reset}
                    className="mt-5 gap-2 rounded-xl"
                >
                    <RotateCcw aria-hidden="true" className="size-4" />
                    Réessayer
                </Button>
            </div>
        </div>
    );
}