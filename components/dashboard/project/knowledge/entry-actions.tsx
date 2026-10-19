"use client";

import { useId, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  deleteKnowledgeEntryAction,
  setKnowledgeEntryEnabledAction,
} from "@/app/actions/knowledge";

/** Enable switch, edit and delete for one entry; the parent refreshes the data. */
export function EntryActions({
  projectId,
  entryId,
  title,
  enabled,
  onEdit,
  onChanged,
}: {
  projectId: string;
  entryId: string;
  title: string;
  enabled: boolean;
  onEdit?: () => void;
  onChanged: () => void;
}) {
  const switchId = useId();
  const [optimistic, setOptimistic] = useState<boolean | null>(null);
  const [pending, startTransition] = useTransition();
  const shown = optimistic ?? enabled;

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Label htmlFor={switchId} className="sr-only">
        Utiliser « {title} » dans les réponses
      </Label>
      <Switch
        id={switchId}
        size="sm"
        checked={shown}
        disabled={pending}
        onCheckedChange={(checked) => {
          setOptimistic(checked);
          startTransition(async () => {
            const result = await setKnowledgeEntryEnabledAction({ projectId, id: entryId, enabled: checked });
            setOptimistic(null);
            if (!result.success) toast.error(result.error);
            else onChanged();
          });
        }}
        className="mr-1"
      />
      {onEdit && (
        <Button type="button" variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Modifier « ${title} »`}>
          <Pencil aria-hidden="true" />
        </Button>
      )}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={`Supprimer « ${title} »`}>
            <Trash2 aria-hidden="true" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette entrée ?</AlertDialogTitle>
            <AlertDialogDescription>
              « {title} » ne sera plus utilisée par l’assistant. Cette action est définitive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() =>
                startTransition(async () => {
                  const result = await deleteKnowledgeEntryAction({ projectId, id: entryId });
                  if (!result.success) toast.error(result.error);
                  else {
                    toast.success("Entrée supprimée");
                    onChanged();
                  }
                })
              }
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
