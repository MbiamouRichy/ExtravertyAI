"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Bot, User, Loader2 } from "lucide-react";
import { useHaptics } from "@/lib/webHaptics";
import { toggleContactAiStatus } from "@/app/actions/contacts.action";

interface ToggleContactAiProps {
  projectId: string;
  contact: {
    id: string;
    aiActive: boolean;
    name: string | null;
    phone: string;
  };
}

export default function ToggleContactAi({ projectId, contact }: ToggleContactAiProps) {
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState<boolean>(false);
  const { playHaptic } = useHaptics();

  const displayName = contact.name || `+${contact.phone}`;

  const handleToggleAi = () => {
    startTransition(async () => {
      const result = await toggleContactAiStatus(projectId, contact.id, !contact.aiActive);

      if (result.success) {
        playHaptic("success");
        toast.success(
          contact.aiActive
            ? `Vous avez pris le relais pour ${displayName}.`
            : `Le bot gère à nouveau ${displayName}.`
        );
        setOpen(false);
      } else {
        playHaptic("error");
        toast.error(result.error || "Erreur lors du changement de statut de l'IA.");
      }
    });
  };

  // --- SI L'IA EST ACTIVE (L'agent veut prendre la main -> Modale de confirmation) ---
  if (contact.aiActive) {
    return (
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            className="w-full justify-start"
            disabled={isPending}
          >
            <User className="mr-2 h-4 w-4" />
            Reprendre la main (Désactiver IA)
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Passer en mode manuel ?</AlertDialogTitle>
            <AlertDialogDescription>
              L&apos;IA cessera de répondre automatiquement à <strong>{displayName}</strong>. Vous devrez gérer cette conversation manuellement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
            <Button
              variant="default" // Couleur primaire (pas destructif, c'est une action positive)
              disabled={isPending}
              onClick={handleToggleAi}
            >
              {isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <User className="w-4 h-4 mr-2" />}
              Oui, prendre le relais
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  // --- SI L'IA EST INACTIVE (L'agent redélègue au bot -> Action directe sans modale) ---
  return (
    <Button
      variant="ghost"
      className="w-full justify-start"
      onClick={handleToggleAi}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin text-primary" />
      ) : (
        <Bot className="w-4 h-4 mr-2 text-primary" />
      )}
      Déléguer à l&apos;IA
    </Button>
  );
}