"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  removeProjectLogoAction,
  updateProjectLogoAction,
} from "@/app/actions/project-logo";
import { PROJECT_LOGO_MAX_BYTES, PROJECT_LOGO_TYPES } from "@/lib/project-logo";
import { ProjectIcon } from "./project-icon";

/** Logo du projet : affiché sur la liste des projets et dans l’espace. */
export function ProjectLogoSettings({
  projectId,
  name,
  logoUrl,
  disabled,
}: {
  projectId: string;
  name: string;
  logoUrl: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const descriptionId = useId();
  const [current, setCurrent] = useState(logoUrl);
  const [pending, setPending] = useState<"upload" | "remove" | null>(null);

  async function upload(file: File) {
    // Confort uniquement : le serveur vérifie la taille et le contenu réel.
    if (file.size > PROJECT_LOGO_MAX_BYTES) {
      toast.error("Choisissez une image de 2 Mo au maximum.");
      return;
    }
    const data = new FormData();
    data.set("projectId", projectId);
    data.set("file", file);
    setPending("upload");
    try {
      const result = await updateProjectLogoAction(data);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setCurrent(result.logoUrl);
      toast.success("Logo mis à jour.");
      router.refresh();
    } catch {
      toast.error("Connexion interrompue. Réessayez.");
    } finally {
      setPending(null);
    }
  }

  async function remove() {
    setPending("remove");
    try {
      const result = await removeProjectLogoAction(projectId);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setCurrent(null);
      toast.success("Logo retiré.");
      router.refresh();
    } catch {
      toast.error("Connexion interrompue. Réessayez.");
    } finally {
      setPending(null);
    }
  }

  // Ligne compacte : aperçu, puis libellé et formats, puis actions (sous le
  // texte sur téléphone, à droite dès sm). La carte est fournie par la page.
  return (
    <div className="flex items-center gap-4">
      <ProjectIcon
        name={name}
        logoUrl={current}
        className="size-14"
        fallbackClassName="text-lg"
      />
      <div className="min-w-0 flex-1 space-y-2.5 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:space-y-0">
        <div className="min-w-0">
          <p className="text-sm font-medium">Logo</p>
          <p id={descriptionId} className="mt-0.5 text-xs text-muted-foreground">
            PNG, JPEG ou WEBP · 2 Mo max.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !!pending}
            aria-describedby={descriptionId}
            aria-busy={pending === "upload"}
            onClick={() => input.current?.click()}
          >
            {pending === "upload" ? (
              <Loader2
                aria-hidden="true"
                data-icon="inline-start"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              <ImageUp aria-hidden="true" data-icon="inline-start" />
            )}
            {pending === "upload" ? "Envoi…" : current ? "Changer" : "Ajouter"}
          </Button>
          {current && (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              disabled={disabled || !!pending}
              aria-busy={pending === "remove"}
              aria-label="Retirer le logo"
              title="Retirer le logo"
              onClick={() => void remove()}
              className="text-muted-foreground hover:text-destructive"
            >
              {pending === "remove" ? (
                <Loader2
                  aria-hidden="true"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <Trash2 aria-hidden="true" />
              )}
            </Button>
          )}
          <input
            ref={input}
            type="file"
            accept={Object.keys(PROJECT_LOGO_TYPES).join(",")}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
        </div>
      </div>
    </div>
  );
}
