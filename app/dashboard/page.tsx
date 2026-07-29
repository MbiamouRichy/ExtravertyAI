import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getUser } from "@/lib/auth-server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const user = await getUser(); // Get the user from the server-side session

  if (!user?.id) {
    redirect("/sign-in");
  }

  return (
    <main className="max-w-md h-screen flex items-center justify-center flex-col mx-auto p-6 space-y-4 text-white">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <Card>
        <CardHeader>
          <CardTitle>Vos infos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center space-x-1">
            <span className="w-8 h-8 rounded-full text-muted-foreground flex items-center justify-center text-sm">
              Nom
            </span>
            <p>{user.name}</p>
          </div>
          <div className="flex items-center space-x-1">
            <span className="w-8 h-8 rounded-full text-muted-foreground flex items-center justify-center text-sm">
              Email
            </span>
            <p>{user.email}</p>
          </div>
        </CardContent>

      </Card>
    </main>
  );
}
