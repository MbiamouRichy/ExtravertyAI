import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Plug, ShieldCheck } from "lucide-react";

import prisma from "@/lib/prisma";
import { getSession } from "@/lib/auth-server";
import { planAllows, planUpgradeMessage } from "@/lib/plan-features";
import { integrationsOverview } from "@/lib/integrations";
import { googleConfigured } from "@/lib/google-sheets";
import { integrationsEncryptionConfigured } from "@/lib/secret-box";
import { Button } from "@/components/ui/button";
import { IntegrationsWorkspace } from "@/components/dashboard/project/integrations/integrations-workspace";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Intégrations | ExtravertyAI",
  robots: { index: false, follow: false },
};

export default async function IntegrationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ projectId }, query] = await Promise.all([params, searchParams]);
  const session = await getSession();
  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/projects/${projectId}/integrations`)}`);
  }
  const membership = await prisma.projectMembership.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId } },
    select: { role: true, project: { select: { plan: true, deletionPending: true } } },
  });
  if (!membership || membership.project.deletionPending) notFound();

  const header = (
    <header>
      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Workspace</p>
      <h1 className="mt-1 text-3xl md:text-4xl">Intégrations</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Envoyez automatiquement vos prospects, ventes et notes de satisfaction
        vers Google Sheets, Make, Zapier ou votre propre outil.
      </p>
    </header>
  );

  if (!["OWNER", "ADMIN"].includes(membership.role)) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-8 p-4 sm:p-6 xl:p-8">
        {header}
        <section className="rounded-2xl border bg-card p-6">
          <ShieldCheck aria-hidden="true" className="size-5" />
          <p className="mt-3 font-heading text-lg font-semibold tracking-tight">
            Réservé aux propriétaires et administrateurs
          </p>
        </section>
      </main>
    );
  }

  if (!planAllows(membership.project.plan, "integrations")) {
    return (
      <main className="mx-auto w-full max-w-5xl space-y-8 p-4 sm:p-6 xl:p-8">
        {header}
        <section className="rounded-2xl border bg-card p-6 sm:p-8">
          <span className="flex size-11 items-center justify-center rounded-xl border bg-muted/50">
            <Plug aria-hidden="true" className="size-5" />
          </span>
          <h2 className="mt-4 font-heading text-lg font-semibold tracking-tight">
            {planUpgradeMessage("integrations")}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Chaque prospect qualifié, chaque vente et chaque note de satisfaction
            arrivent dans vos outils sans copier-coller.
          </p>
          <Button asChild className="mt-5">
            <Link href={`/projects/${projectId}/billing`}>
              Voir les offres
              <ArrowRight data-icon="inline-end" />
            </Link>
          </Button>
        </section>
      </main>
    );
  }

  const overview = await integrationsOverview(prisma, projectId);
  const encryption = integrationsEncryptionConfigured();
  const outcome = typeof query.google === "string" ? query.google : null;

  return (
    <main className="mx-auto w-full max-w-6xl space-y-6 p-4 sm:p-6 xl:p-8">
      {header}
      {!encryption && (
        <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          La clé de chiffrement des intégrations n’est pas configurée sur ce serveur
          (INTEGRATIONS_ENCRYPTION_KEY). Les intégrations ne peuvent pas être créées.
        </p>
      )}
      <IntegrationsWorkspace
        projectId={projectId}
        googleAvailable={googleConfigured() && encryption}
        googleOutcome={outcome}
        endpoints={overview.endpoints.map((endpoint) => ({
          ...endpoint,
          lastDeliveryAt: endpoint.lastDeliveryAt?.toISOString() ?? null,
        }))}
        deliveries={overview.deliveries.map((delivery) => ({
          id: delivery.id,
          endpointId: delivery.endpointId,
          event: delivery.event,
          state: delivery.state,
          attempts: delivery.attempts,
          lastStatus: delivery.lastStatus,
          lastError: delivery.lastError,
          createdAt: delivery.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
