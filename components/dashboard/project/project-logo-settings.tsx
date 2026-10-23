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

/** Icône de l’entreprise : affichée sur la liste des projets et dans l’espace. */
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
      toast.success("Icône de l’entreprise mise à jour.");
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
      toast.success("Icône retirée.");
      router.refresh();
    } catch {
      toast.error("Connexion interrompue. Réessayez.");
    } finally {
      setPending(null);
    }
  }

  return (
    <section
      aria-labelledby="project-logo-title"
      className="rounded-2xl border bg-card p-4 sm:p-6"
    >
      <h2
        id="project-logo-title"
        className="font-heading text-lg font-semibold tracking-tight"
      >
        Icône de l’entreprise
      </h2>
      <p id={descriptionId} className="mt-1 text-sm text-muted-foreground">
        Votre logo remplace l’initiale du projet dans votre espace. JPEG, PNG
        ou WEBP, 2 Mo au maximum, de préférence carré.
      </p>
      <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center">
        <ProjectIcon
          name={name}
          logoUrl={current}
          className="size-16"
          fallbackClassName="text-xl"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !!pending}
            aria-describedby={descriptionId}
            onClick={() => input.current?.click()}
          >
            {pending === "upload" ? (
              <Loader2
                data-icon="inline-start"
                className="animate-spin motion-reduce:animate-none"
              />
            ) : (
              <ImageUp data-icon="inline-start" />
            )}
            {pending === "upload"
              ? "Envoi…"
              : current
                ? "Changer l’icône"
                : "Ajouter une icône"}
          </Button>
          {current && (
            <Button
              type="button"
              variant="ghost"
              disabled={disabled || !!pending}
              onClick={() => void remove()}
            >
              {pending === "remove" ? (
                <Loader2
                  data-icon="inline-start"
                  className="animate-spin motion-reduce:animate-none"
                />
              ) : (
                <Trash2 data-icon="inline-start" />
              )}
              Retirer
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
    </section>
  );
}
