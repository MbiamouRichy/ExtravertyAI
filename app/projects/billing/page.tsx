import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Receipt } from "lucide-react";
import { getSession } from "@/lib/auth-server";
import prisma from "@/lib/prisma";
import { Button } from "@/components/ui/button";
export const metadata: Metadata = {
  title: "Facturation des projets | ExtravertyAI",
  robots: { index: false, follow: false },
};
export default async function BillingProjectsPage() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/sign-in?callbackUrl=/projects/billing");
  const memberships = await prisma.projectMembership.findMany({
    where: { userId: session.user.id, role: { in: ["OWNER", "ADMIN"] } },
    select: { project: { select: { id: true, name: true, plan: true } } },
    orderBy: { project: { name: "asc" } },
  });
  if (memberships.length === 1)
    redirect(`/projects/${memberships[0].project.id}/billing`);
  return (
    <main className="mx-auto max-w-4xl space-y-7 px-4 py-10 sm:px-8">
      <header>
        <h1 className="text-3xl! font-semibold">Facturation de vos projets</h1>
        <p className="mt-3 text-muted-foreground">
          Choisissez le projet dont vous souhaitez consulter l’abonnement et les
          factures.
        </p>
      </header>
      <div className="divide-y rounded-2xl border">
        {memberships.length ? (
          memberships.map(({ project }) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}/billing`}
              className="flex items-center gap-4 p-6 transition-colors hover:bg-muted/50"
            >
              <Receipt className="size-5" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{project.name}</p>
                <p className="mt-1 text-sm capitalize text-muted-foreground">
                  Offre {project.plan}
                </p>
              </div>
              <ArrowUpRight className="size-4" />
            </Link>
          ))
        ) : (
          <p className="p-8 text-sm text-muted-foreground">
            Aucun projet dont vous pouvez consulter la facturation.
          </p>
        )}
      </div>
      <Button variant="outline" asChild>
        <Link href="/projects">Retour aux projets</Link>
      </Button>
    </main>
  );
}
