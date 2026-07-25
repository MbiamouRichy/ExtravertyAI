import { AppShell } from "@/components/dashboard/app-shell";
import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {

    const session = await getSession();
    if (!session) {
        redirect("/sign-in");
    }
    if (!session?.user?.id) {
        redirect("/sign-in");
    }
    return (
        <AppShell>
            {children}
        </AppShell>
    );
}