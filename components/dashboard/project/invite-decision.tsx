"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { consumeInvitation, refuseInvitation } from "@/app/actions/invite";
import { Button } from "@/components/ui/button";
import { useHaptics } from "@/lib/webHaptics";

/** Le compte existe et la bonne personne est connectée : elle décide elle-même. */
export function InviteDecision({
  token,
  email,
  projectName,
  inviterName,
  roleLabel,
  roleDescription,
}: {
  token: string;
  email: string;
  projectName: string;
  inviterName: string;
  roleLabel: string;
  roleDescription: string;
}) {
  const router = useRouter();
  const { playHaptic } = useHaptics();
  const [isPending, startTransition] = useTransition();
  const [choice, setChoice] = useState<"accept" | "refuse" | null>(null);

  function fail(message?: string) {
    playHaptic("error");
    toast.error(message ?? "Une erreur est survenue. Réessayez.", {
      position: "top-center",
    });
    router.refresh();
  }

  function accept() {
    setChoice("accept");
    startTransition(async () => {
      const result = await consumeInvitation(token);
      if (!result.success) return fail(result.error);
      playHaptic("success");
      toast.success(result.message, { position: "top-center" });
      router.replace(`/projects/${result.projectId}`);
    });
  }

  function refuse() {
    setChoice("refuse");
    startTransition(async () => {
      const result = await refuseInvitation(token);
      if (!result.success) return fail(result.error);
      toast.success("Invitation refusée. Aucun accès n’a été créé.", {
        position: "top-center",
      });
      router.replace("/projects");
    });
  }

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
          Confirmation requise
        </p>
        <h1 className="text-3xl md:text-4xl">Rejoindre ce projet ?</h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">{inviterName}</span>{" "}
          vous invite à rejoindre{" "}
          <span className="break-words font-medium text-foreground">
            {projectName}
          </span>
          . Aucun accès n’est créé sans votre accord.
        </p>
      </header>

      <dl className="divide-y rounded-2xl border bg-card text-sm">
        <div className="flex items-baseline justify-between gap-4 p-4">
          <dt className="text-muted-foreground">Compte</dt>
          <dd className="min-w-0 truncate font-medium" title={email}>
            {email}
          </dd>
        </div>
        <div className="p-4">
          <div className="flex items-baseline justify-between gap-4">
            <dt className="text-muted-foreground">Rôle proposé</dt>
            <dd className="font-medium">{roleLabel}</dd>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
            {roleDescription}
          </p>
        </div>
      </dl>

      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          disabled={isPending}
          aria-busy={isPending && choice === "accept"}
          onClick={accept}
        >
          {isPending && choice === "accept" && (
            <Loader2 className="animate-spin" aria-hidden="true" />
          )}
          Accepter et rejoindre
        </Button>
        <Button
          variant="ghost"
          disabled={isPending}
          aria-busy={isPending && choice === "refuse"}
          onClick={refuse}
        >
          {isPending && choice === "refuse" && (
            <Loader2 className="animate-spin" aria-hidden="true" />
          )}
          Refuser l’invitation
        </Button>
      </div>
    </div>
  );
}
