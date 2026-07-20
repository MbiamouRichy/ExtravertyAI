import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";
import { UAParser } from "ua-parser-js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Key, Smartphone, Mail, CalendarDays, UserCog } from "lucide-react";
import SignOutButton from "@/components/dashboard/user/signOutButton";
import { ModifierProfile } from "@/components/dashboard/user/modifierProfile";
import { getSession } from "@/lib/auth-server";
import { formatTimeAgo } from "@/lib/formatTimeAgo";

export default async function ProfilePage() {
  // Récupération de la session utilisateur via Better Auth
  const sessionData = await getSession();

  if (!sessionData?.user?.id) {
    redirect("/sign-in");
  }

  const user = sessionData.user;

  // 1. Récupérer la dernière modification du mot de passe
  const passwordAccount = await prisma.account.findFirst({
    where: { userId: user.id, providerId: "credential" },
    select: { updatedAt: true },
  });
  const passwordLastUpdated = passwordAccount
    ? formatTimeAgo(passwordAccount.updatedAt)
    : "Géré par un fournisseur externe (Google/GitHub)";

  // 2. Récupérer les sessions actives
  const rawSessions = await prisma.session.findMany({
    where: { userId: user.id, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });

  const sessions = rawSessions.map((s) => {
    // Avec l'import nommé, TypeScript reconnaît le constructeur
    const parser = new UAParser(s.userAgent || "");
    const result = parser.getResult();

    return {
      id: s.id,
      browser: result.browser.name || "Navigateur inconnu",
      os: result.os.name || "Système inconnu",
      device: result.device.type === "mobile" ? "Mobile" : "Ordinateur",
      ip: s.ipAddress || "IP masquée",
    };
  });

  const joinedDate = new Date(user.createdAt).toLocaleDateString("fr-FR", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profil Utilisateur</h1>
        <p className="text-muted-foreground mt-2">
          Gérez vos informations personnelles et la sécurité de votre compte.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Colonne Gauche : Identité */}
        <div className="space-y-6 md:col-span-1">
          <Card className="border-border shadow-sm">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <div className="relative mb-4">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-primary/20 to-primary/0 blur-md" />
                <Avatar className="h-24 w-24 border-2 border-background relative shadow-sm">
                  <AvatarImage src={user.image || ""} alt={user.name} />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {user.name?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>

              <h2 className="text-xl font-semibold">{user.name}</h2>
              <p className="text-sm text-muted-foreground mb-4">{user.email}</p>

              <Badge variant="secondary" className="mb-6 uppercase tracking-wider text-xs">
                {user.globalRole || "Utilisateur"}
              </Badge>

              <div className="w-full flex flex-col justify-between gap-2 items-center">
                <ModifierProfile user={user}>
                  <Button className="w-full cursor-pointer">
                    <UserCog className="mr-2 h-4 w-4" />
                    Modifier le profil
                  </Button>
                </ModifierProfile>
                <SignOutButton className="w-full cursor-pointer" />
              </div>
            </CardContent>

            <Separator />

            <CardContent className="p-4 bg-muted/30 text-sm text-muted-foreground flex items-center justify-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Membre depuis {joinedDate}
            </CardContent>
          </Card>
        </div>

        {/* Colonne Droite : Sécurité & Sessions dynamiques */}
        <div className="space-y-6 md:col-span-2">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5 text-primary" />
                Sécurité du compte
              </CardTitle>
              <CardDescription>
                Gérez vos méthodes de connexion et mots de passe.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Adresse Email
                  </p>
                  <p className="text-sm text-muted-foreground">{user.email}</p>
                </div>
                <Badge variant={user.emailVerified ? "default" : "destructive"}>
                  {user.emailVerified ? "Vérifiée" : "Non vérifiée"}
                </Badge>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-medium flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    Mot de passe
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Dernière modification : {passwordLastUpdated}
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Modifier
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Smartphone className="h-5 w-5 text-primary" />
                Sessions actives ({sessions.length})
              </CardTitle>
              <CardDescription>
                Les appareils actuellement connectés à votre compte.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sessions.map((s, index) => (
                <div key={s.id} className="flex items-center justify-between p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Smartphone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{s.os} - {s.browser}</p>
                      <p className="text-xs text-muted-foreground">
                        IP : {s.ip} {index === 0 ? "• Session actuelle" : ""}
                      </p>
                    </div>
                  </div>
                  {index === 0 ? (
                    <Badge className="bg-emerald-500 hover:bg-emerald-600">Actuelle</Badge>
                  ) : (
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                      Révoquer
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}