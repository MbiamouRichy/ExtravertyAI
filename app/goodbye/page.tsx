import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MessageSquareOff, ArrowRight, Sparkles, LifeBuoy } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "Au revoir  | ExtravertyAI",
};
export const dynamic = "force-static";

export default function GoodbyePage() {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative overflow-hidden">

            {/* Effet de fond moderne (Subtle Mesh / Glow) */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 bg-primary/5 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-size-[24px_24px] pointer-events-none" />

            {/* Contenu Principal */}
            <main className="relative z-10 max-w-lg w-full space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-both">

                {/* En-tête (Icône & Typographie) */}
                <div className="text-center space-y-5">
                    <div className="mx-auto w-16 h-16 bg-muted/50 rounded-2xl flex items-center justify-center border border-border/50 shadow-sm ring-1 ring-white/10">
                        <MessageSquareOff className="w-7 h-7 text-muted-foreground" />
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
                            Ce n&apos;est qu&apos;un au revoir.
                        </h1>
                        <p className="text-base text-muted-foreground leading-relaxed max-w-md mx-auto">
                            Votre compte a bien été supprimé. Merci d&apos;avoir fait confiance à <span className="text-foreground font-medium">ExtravertyAI</span> pour automatiser vos échanges WhatsApp.
                        </p>
                    </div>
                </div>

                {/* Carte de confirmation de suppression (Tournée de manière positive) */}
                <Card className="border-border/50 shadow-lg shadow-black/5 bg-card/50 backdrop-blur-sm">
                    <CardContent className="p-6 space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 bg-primary/10 p-2 rounded-md">
                                <Sparkles className="w-4 h-4 text-primary" />
                            </div>
                            <div>
                                <h3 className="font-semibold text-foreground">Confidentialité garantie</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Conformément à nos engagements, vos scénarios, templates de réponses et configurations d&apos;agents ont été effacés de nos serveurs de manière <span className="font-medium text-foreground">immédiate et définitive</span>.
                                </p>
                            </div>
                        </div>

                        <div className="h-px w-full bg-border/50 my-4" />

                        {/* Call to Actions (CTA) */}
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button asChild className="w-full sm:w-auto flex-1 group">
                                <Link href="/sign-up">
                                    Créer un nouveau compte
                                    <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                                </Link>
                            </Button>
                            <Button asChild variant="outline" className="w-full sm:w-auto flex-1 bg-background">
                                <Link href="/">
                                    Retour à l&apos;accueil
                                </Link>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </main>

            {/* Footer Minimaliste */}
            <footer className="absolute bottom-8 flex flex-col items-center gap-2 animate-in fade-in duration-1000 delay-300 fill-mode-both">
                <Link
                    href="/contact"
                    className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
                >
                    <LifeBuoy className="w-4 h-4" />
                    Une question ou une erreur ? Contactez le support
                </Link>
            </footer>
        </div>
    );
}