import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import CreateProjectForm from "@/components/dashboard/project/createProjectForm";
import PaymentCanceledDialog from "@/components/dashboard/project/paymentCanceledDialog";
import { VerifyEmailGate } from "@/components/dashboard/project/verify-email-gate";
import { getSession } from "@/lib/auth-server";
import { projectPlanHref, resolvePlanId } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "Créer un projet | ExtravertyAI",
  description: "Configurez votre projet WhatsApp et choisissez votre forfait.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string | string[] }>;
}) {
  const initialPlan = resolvePlanId((await searchParams).plan);
  const session = await getSession();

  if (!session?.user?.id) {
    redirect(
      `/sign-in?callbackUrl=${encodeURIComponent(projectPlanHref(initialPlan))}`,
    );
  }

  if (session.user.emailVerified !== true)
    return (
      <VerifyEmailGate
        email={session.user.email}
        callbackUrl={projectPlanHref(initialPlan)}
      />
    );

  return (
    <>
      <CreateProjectForm key={initialPlan} initialPlan={initialPlan} />

      <Suspense fallback={null}>
        <PaymentCanceledDialog />
      </Suspense>
    </>
  );
}
