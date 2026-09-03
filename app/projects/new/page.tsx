import CreateProjectForm from '@/components/dashboard/project/createProjectForm'
import PaymentCanceledDialog from '@/components/dashboard/project/paymentCanceledDialog';
import { getSession } from '@/lib/auth-server';
import type { Metadata } from "next";
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

export const metadata: Metadata = {
    title: "New Project | ExtravertyAI",
}

async function NewProjectPage() {
    const session = await getSession();
    if (!session?.user?.id) {
        return redirect(`/sign-in?callbackUrl=/projects/new`);
    }
    return (
        <>
            <CreateProjectForm />
            <Suspense fallback={null}>
                <PaymentCanceledDialog />
            </Suspense>
        </>
    )
}

export default NewProjectPage