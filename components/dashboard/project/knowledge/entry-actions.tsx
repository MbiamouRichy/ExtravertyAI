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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  // La valeur choisie reste affichée jusqu’à ce que l’actualisation la confirme.
  if (optimistic === enabled) setOptimistic(null);
  const shown = optimistic ?? enabled;

  return (
    <div className="-mr-2 flex shrink-0 items-center justify-end gap-1 sm:mr-0">
      <Label htmlFor={switchId} className="sr-only">
        Utiliser « {title} » dans les réponses
      </Label>
      <Tooltip>
        {/* Le déclencheur écrit son propre data-state : il ne doit pas toucher celui du switch. */}
        <TooltipTrigger asChild>
          <span className="mr-1 inline-flex">
            <Switch
              id={switchId}
              checked={shown}
              disabled={pending}
              onCheckedChange={(checked) => {
                setOptimistic(checked);
                startTransition(async () => {
                  const result = await setKnowledgeEntryEnabledAction({ projectId, id: entryId, enabled: checked });
                  if (result.success) return onChanged();
                  setOptimistic(null);
                  toast.error(result.error);
                });
              }}
            />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          {shown ? "Ne plus utiliser dans les réponses" : "Utiliser dans les réponses"}
        </TooltipContent>
      </Tooltip>
      {onEdit && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Modifier « ${title} »`}>
              <Pencil aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Modifier</TooltipContent>
        </Tooltip>
      )}
      <AlertDialog>
        <Tooltip>
          <TooltipTrigger asChild>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={`Supprimer « ${title} »`}>
                <Trash2 aria-hidden="true" />
              </Button>
            </AlertDialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Supprimer</TooltipContent>
        </Tooltip>
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
