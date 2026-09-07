import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getInvitationDetails } from "@/app/actions/invite";
import { InviteForm } from "@/components/dashboard/project/invite-form";
import { LogoIcon } from "@/components/logo";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Invite | ExtravertyAI",
};
export const dynamic = "force-dynamic";
interface InvitePageProps {
    searchParams: Promise<{ token?: string }>;
}

export default async function InvitePage({ searchParams }: InvitePageProps) {
    const { token } = await searchParams;

    const res = await getInvitationDetails(token || "");

    return (
        <div className="relative min-h-screen w-full flex flex-col items-center justify-between p-4 sm:p-6">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none" />

            {/* HEADER LOGO */}
            <header className="w-full max-w-5xl flex justify-between items-center py-4">
                <Link href="/" className="flex items-center gap-2">
                    <LogoIcon className="w-10 h-10" />
                </Link>
            </header>

            {/* ZONE CENTRALE */}
            <main className="w-full flex items-center justify-center my-auto py-8">
                {!res.success || !res.invitation ? (
                    /* ÉTAT D'ERREUR OU INVITATION EXPIRÉE */
                    <Card className="w-full max-w-md border-destructive/20 bg-card/50 shadow-lg text-center">
                        <CardHeader className="pb-4">
                            <div className="mx-auto h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-2">
                                <ShieldAlert className="w-6 h-6" />
                            </div>
                            <CardTitle className="text-xl">Invitation non valide</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <p className="text-sm text-muted-foreground">
                                {res.error || "Ce lien d'invitation est invalide, expiré ou a déjà été utilisé."}
                            </p>
                        </CardContent>
                        <CardFooter className="flex justify-center pt-2">
                            <Button asChild variant="outline" className="gap-2">
                                <Link href="/">
                                    <ArrowLeft className="w-4 h-4" /> Retour à l&apos;accueil
                                </Link>
                            </Button>
                        </CardFooter>
                    </Card>
                ) : (
                    /* FORMULAIRE D'ACCEPTATION */
                    <InviteForm invitation={res.invitation} token={token || ""} />
                )}
            </main>

            {/* FOOTER */}
            <footer className="w-full max-w-5xl text-center text-xs text-muted-foreground py-4">
                &copy; {new Date().getFullYear()} ExtravertyAI. Tous droits réservés. Libreville, Gabon.
            </footer>
        </div>
    );
}