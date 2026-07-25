import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { CreditCard, Download, Receipt, Zap, AlertCircle } from "lucide-react";

export default function BillingPage() {
    return (
        <div className="mx-auto max-w-5xl space-y-8 p-6 md:p-8">
            {/* En-tête de la page */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Facturation & Abonnement</h1>
                <p className="text-muted-foreground mt-2">
                    Gérez vos préférences de facturation et suivez votre consommation mensuelle.
                </p>
            </div>

            <div className="grid gap-8 md:grid-cols-3">
                {/* Colonne Principale (Plan et Utilisation) */}
                <div className="space-y-8 md:col-span-2">

                    {/* Carte : Plan Actuel & Consommation */}
                    <Card className="border-border/50 shadow-sm relative overflow-hidden">
                        {/* Petite bordure colorée en haut pour le côté premium */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-primary" />

                        <CardHeader className="pb-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2 text-2xl">
                                        Plan Premium
                                        <Badge variant="default" className="ml-2 font-normal">Actif</Badge>
                                    </CardTitle>
                                    <CardDescription className="mt-1.5">
                                        Votre abonnement se renouvelle le 12 Août 2026.
                                    </CardDescription>
                                </div>
                                <div className="text-right">
                                    <div className="text-3xl font-bold">99 €<span className="text-sm text-muted-foreground font-normal">/mois</span></div>
                                </div>
                            </div>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            {/* Barre de progression (Usage) */}
                            <div className="space-y-3 rounded-lg border border-border/50 bg-muted/30 p-4">
                                <div className="flex justify-between text-sm font-medium">
                                    <span className="flex items-center gap-1.5">
                                        <Zap className="h-4 w-4 text-amber-500" />
                                        Messages WhatsApp automatisés
                                    </span>
                                    <span>8 450 / 10 000</span>
                                </div>
                                <Progress value={84.5} className="h-2.5" />
                                <p className="text-xs text-muted-foreground">
                                    Vous avez consommé 84.5% de votre quota mensuel.
                                    <a href="#" className="text-primary hover:underline ml-1">Augmenter la limite</a>
                                </p>
                            </div>
                        </CardContent>

                        <CardFooter className="flex justify-between border-t border-border/50 bg-muted/10 pt-4">
                            <Button variant="outline">Annuler l&apos;abonnement</Button>
                            <Button>Gérer le plan</Button>
                        </CardFooter>
                    </Card>

                    {/* Carte : Méthode de paiement */}
                    <Card className="border-border/50 shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg">Méthode de paiement</CardTitle>
                            <CardDescription>
                                La carte associée à votre compte ExtravertyAI pour la facturation.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between rounded-lg border border-border/50 p-4">
                                <div className="flex items-center gap-4">
                                    <div className="rounded bg-muted p-2">
                                        <CreditCard className="h-6 w-6 text-foreground/70" />
                                    </div>
                                    <div>
                                        <p className="font-medium text-sm">Visa se terminant par 4242</p>
                                        <p className="text-xs text-muted-foreground">Expire en 12/28</p>
                                    </div>
                                </div>
                                <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 border-emerald-500/20">
                                    Principale
                                </Badge>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button variant="outline" className="w-full sm:w-auto">
                                Mettre à jour la carte
                            </Button>
                        </CardFooter>
                    </Card>
                </div>

                {/* Colonne Secondaire (Historique des factures) */}
                <div className="md:col-span-1">
                    <Card className="border-border/50 shadow-sm h-full">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Receipt className="h-5 w-5" />
                                Historique
                            </CardTitle>
                            <CardDescription>
                                Vos dernières factures.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow className="border-border/50 border-b">
                                        <TableHead className="text-xs">Date</TableHead>
                                        <TableHead className="text-xs text-right">Montant</TableHead>
                                        <TableHead className="w-[50px]"></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {/* Mock des factures */}
                                    {[
                                        { date: "12 Juil 2026", amount: "99,00 €" },
                                        { date: "12 Juin 2026", amount: "99,00 €" },
                                        { date: "12 Mai 2026", amount: "99,00 €" },
                                    ].map((invoice, i) => (
                                        <TableRow key={i} className="border-border/50 border-b">
                                            <TableCell className="py-3 text-sm font-medium">
                                                {invoice.date}
                                            </TableCell>
                                            <TableCell className="py-3 text-sm text-right">
                                                {invoice.amount}
                                            </TableCell>
                                            <TableCell className="py-3 text-right">
                                                <Button variant="ghost" size="icon-sm" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                                    <Download className="h-4 w-4" />
                                                    <span className="sr-only">Télécharger</span>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                        <CardFooter className="pt-2">
                            <Button variant="link" className="w-full text-muted-foreground hover:text-foreground">
                                Voir toutes les factures
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            </div>

            {/* Note de bas de page */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-center pt-8">
                <AlertCircle className="h-4 w-4" />
                <p>Les paiements sont sécurisés et traités par Stripe.</p>
            </div>
        </div>
    );
}