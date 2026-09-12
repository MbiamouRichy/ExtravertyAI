"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ChatRefreshButton() {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    return (
        <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl"
            disabled={pending}
            onClick={() => {
                startTransition(() => router.refresh());
            }}
        >
            <RefreshCw
                aria-hidden="true"
                className={cn(
                    "size-4",
                    pending && "animate-spin motion-reduce:animate-none",
                )}
            />
            {pending ? "Actualisation…" : "Actualiser"}
        </Button>
    );
}