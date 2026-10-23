"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { assignNextConversationAction } from "@/app/actions/conversation-workflow";
import { cn } from "@/lib/utils";

/**
 * Confie à l’équipier la prochaine conversation sans responsable.
 * Les droits (propriétaire ou administrateur) sont vérifiés par le serveur.
 */
export function AssignNextButton({
  projectId,
  assigneeId,
  assigneeName,
  className,
}: {
  projectId: string;
  assigneeId: string;
  assigneeName: string;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function assign() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await assignNextConversationAction({
        projectId,
        assigneeId,
      });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(`Conversation confiée à ${result.assigneeName}`, {
        description: `${result.contactName} lui est maintenant assignée.`,
        action: {
          label: "Ouvrir",
          onClick: () =>
            router.push(
              `/projects/${encodeURIComponent(projectId)}/chat?contactId=${encodeURIComponent(result.contactId)}`,
            ),
        },
      });
      router.refresh();
    } catch {
      toast.error("Connexion interrompue. Réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={busy}
      aria-busy={busy}
      aria-label={`Assigner la prochaine conversation à ${assigneeName}`}
      title="Assigner la prochaine conversation en attente"
      onClick={() => void assign()}
      className={cn("shrink-0", className)}
    >
      {busy ? (
        <Loader2
          data-icon="inline-start"
          className="animate-spin motion-reduce:animate-none"
        />
      ) : (
        <UserPlus data-icon="inline-start" />
      )}
      Assigner
    </Button>
  );
}
