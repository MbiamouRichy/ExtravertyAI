"use client";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    CreditCard,
    CheckCircle2,
    ArrowUpRight,
} from "lucide-react";

function AbonnementFacturation({ user }: { user: { name: string; email: string; role: string; plan: string } }) {
    return (
        <Card className="shadow-sm flex flex-col">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-neutral-500" />
                    Plan & Facturation
                </CardTitle>
                <CardDescription>
                    Gérez votre abonnement Extraverty AI.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 flex-1">
                <div className="bg-neutral-900 text-white p-5 rounded-lg flex justify-between items-center">
                    <div>
                        <p className="text-sm text-neutral-300 font-medium uppercase tracking-wider mb-1">Plan Actuel</p>
                        <p className="text-2xl font-bold">{user.plan}</p>
                    </div>
                    <Badge className="bg-white/10 text-white hover:bg-white/20 border-0 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Actif
                    </Badge>
                </div>

                <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                        <span className="font-medium text-neutral-900">Instances WhatsApp</span>
                        <span className="text-neutral-500">2 / 5 utilisées</span>
                    </div>
                    {/* Progress bar avec une couleur neutre foncée */}
                    <Progress value={40} className="h-2 [&>div]:bg-neutral-800" />
                    <p className="text-xs text-neutral-500">
                        Vous avez utilise 4
                    </p>
                </div>
            </CardContent>
            <CardFooter className="bg-neutral-50 border-t border-neutral-100 justify-between">
                <p className="text-xs text-neutral-500">Prochain prélèvement le 15 Juil 2026</p>
                <Button variant="outline" className="border-neutral-300 text-neutral-700 hover:bg-neutral-100">
                    Gérer l&apos;abonnement <ArrowUpRight className="ml-2 h-4 w-4" />
                </Button>
            </CardFooter>
        </Card>
    )
}

export default AbonnementFacturation