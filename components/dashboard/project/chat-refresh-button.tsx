"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { getConnectionData } from "@/app/actions/instance-actions";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ChatRefreshButton({ projectId }: { projectId?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      className="gap-2 rounded-xl"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          try {
            if (projectId) {
              const result = await getConnectionData(projectId);
              if (result.status === "error") {
                toast.error(result.error);
                return;
              }
              if (result.status === "connected") {
                window.location.replace(
                  `/projects/${encodeURIComponent(projectId)}/chat`,
                );
                return;
              }
              toast.info("WhatsApp n’est pas encore connecté.");
            }
            router.refresh();
          } catch {
            toast.error("Impossible d’actualiser la connexion. Réessayez.");
          }
        });
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
