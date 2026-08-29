import SettingsPage from "@/components/dashboard/user/settingsPage";
import { getSession } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
export const metadata: Metadata = {
    title: "User - Settings | ExtravertyAI",
}
export default async function PageUserSettings() {
    const session = await getSession();

    if (!session?.user?.id) {
        return redirect("/sign-in?callbackUrl=/projects/user/settings")
    }
    return (
        <SettingsPage />
    );
}