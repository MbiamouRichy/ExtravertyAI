import { AppShell } from "@/components/dashboard/app-shell";

export default async function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {


    return (
        <AppShell>
            {children}
        </AppShell>
    );
}