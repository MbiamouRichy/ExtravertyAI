import { AppShell } from "@/components/app-shell";
import { DashboardSkeleton } from "@/components/dashboard-skeleton";

export default function DemoPage({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <AppShell>
            <DashboardSkeleton />
            {children}
        </AppShell>
    );
}