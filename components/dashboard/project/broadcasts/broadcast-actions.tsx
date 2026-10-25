"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Ban, Loader2, Pause, Play } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  cancelBroadcastAction,
  pauseBroadcastAction,
  resumeBroadcastAction,
} from "@/app/actions/broadcasts";
import type { BroadcastStatus } from "./types";

/** Pause, resume and cancel: owners and administrators only. */
export function BroadcastActions({
  projectId,
  broadcastId,
  name,
  status,
  pending,
  onChanged,
}: {
  projectId: string;
  broadcastId: string;
  name: string;
  status: BroadcastStatus;
  /** Recipients not reached yet, shown before cancelling. */
  pending: number;
  onChanged: () => void;
}) {
  const [busy, startTransition] = useTransition();
  const run = (
    action: typeof pauseBroadcastAction,
    success: string,
  ) =>
    startTransition(async () => {
      const result = await action({ projectId, broadcastId });
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      toast.success(success);
      onChanged();
    });

  if (!["SCHEDULED", "SENDING", "PAUSED"].includes(status)) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "PAUSED" ? (
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={() => run(resumeBroadcastAction, "Diffusion relancée")}
        >
          {busy ? <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" /> : <Play data-icon="inline-start" />}
          Reprendre
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => run(pauseBroadcastAction, "Diffusion mise en pause")}
        >
          {busy ? <Loader2 data-icon="inline-start" className="animate-spin motion-reduce:animate-none" /> : <Pause data-icon="inline-start" />}
          Mettre en pause
        </Button>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" size="sm" variant="ghost" disabled={busy}>
            <Ban data-icon="inline-start" />
            Annuler
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler « {name} » ?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending > 0
                ? `${pending.toLocaleString("fr-FR")} contact${pending > 1 ? "s" : ""} ne recevr${pending > 1 ? "ont" : "a"} pas le message. Les messages déjà partis restent envoyés.`
                : "Les messages déjà partis restent envoyés."}{" "}
              L’annulation est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Garder la diffusion</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => run(cancelBroadcastAction, "Diffusion annulée")}
            >
              Annuler la diffusion
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
