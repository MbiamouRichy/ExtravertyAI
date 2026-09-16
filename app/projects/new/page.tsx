import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import CreateProjectForm from "@/components/dashboard/project/createProjectForm";
import PaymentCanceledDialog from "@/components/dashboard/project/paymentCanceledDialog";
import { getSession } from "@/lib/auth-server";

export const metadata: Metadata = {
  title: "Créer un projet | ExtravertyAI",
  description: "Configurez votre projet WhatsApp et choisissez votre forfait.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function NewProjectPage() {
  const session = await getSession();

  if (!session?.user?.id) {
    redirect(`/sign-in?callbackUrl=${encodeURIComponent("/projects/new")}`);
  }

  return (
    <>
      <CreateProjectForm />

      <Suspense fallback={null}>
        <PaymentCanceledDialog />
      </Suspense>
    </>
  );
}
