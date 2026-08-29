import { AppHeader } from "@/components/dashboard/app-header";

export default function DashboardLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {

    return (
        <>
            <AppHeader />
            {children}
        </>

    );
}