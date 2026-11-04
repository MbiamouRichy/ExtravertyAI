import Link from "next/link";
import { ArrowRight, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Sans numéro de test, l'essai n'échange avec personne : on le signale d'emblée. */
export function TrialTestNumberNotice({
  projectId,
  canManage,
}: {
  projectId: string;
  canManage: boolean;
}) {
  return (
    <aside
      aria-label="Numéro de test de l’essai"
      className="mx-4 mt-4 flex flex-col gap-3 rounded-xl border border-primary/30 bg-card p-4 sm:mx-6 sm:flex-row sm:items-center sm:justify-between xl:mx-8"
    >
      <div className="flex min-w-0 gap-3">
        <FlaskConical aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <div className="min-w-0 text-sm">
          <p className="font-medium">Enregistrez votre numéro de test</p>
          <p className="text-muted-foreground">
            Pendant l’essai, l’assistant ne répond qu’à ce numéro. Écrivez ensuite
            à votre WhatsApp professionnel depuis ce téléphone pour le tester.
            {!canManage && " Un administrateur du projet peut l’enregistrer."}
          </p>
        </div>
      </div>
      {canManage && (
        <Button asChild size="sm" className="shrink-0">
          <Link href={`/projects/${projectId}/settings`}>
            Enregistrer le numéro
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      )}
    </aside>
  );
}
