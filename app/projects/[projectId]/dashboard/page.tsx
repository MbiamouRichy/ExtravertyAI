import { getUser } from "@/lib/auth-server";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { Dashboard } from "@/components/dashboard/dashboard";

export const metadata: Metadata = {
  title: "Dashboard | ExtravertyAI",
}
export default async function DashboardPage() {
  const user = await getUser(); // Get the user from the server-side session

  if (!user?.id) {
    return redirect("/sign-in");
  }

  return (
    <Dashboard />
  );
}
