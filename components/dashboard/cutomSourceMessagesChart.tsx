"use client";

import { useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import { LabelList, Pie, PieChart } from "recharts";
import { Loader2, PieChart as PieChartIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
// Remplace par ton vrai chemin
import { getMessageSourcesStats, SourceDatum, TimePeriod } from "@/app/actions/getMessagesSources";

const PERIOD_LABELS: Record<TimePeriod, string> = {
    "7d": "7 derniers jours",
    "14d": "14 derniers jours",
    "21d": "21 derniers jours",
    "1m": "1 dernier mois",
    "2m": "2 derniers mois",
    "3m": "3 derniers mois",
    "6m": "6 derniers mois",
    "1y": "1 dernière année",
};

const chartConfig = {
    count: { label: "Messages" },
    android: { label: "Android", color: "var(--chart-1)" },
    ios: { label: "iOS", color: "var(--chart-2)" },
    ai: { label: "IA (Bot)", color: "var(--chart-3)" },
    unknown: { label: "Autre/Inconnu", color: "var(--chart-4)" },
};

interface CustomSourceMessageChartProps {
    projectId: string;
    initialData: SourceDatum[];
    initialTotal: number;
    className?: string;
}

export function CustomSourceMessageChart({
    projectId,
    initialData,
    initialTotal,
    className,
}: CustomSourceMessageChartProps) {
    const [period, setPeriod] = useState<TimePeriod>("7d");
    const [data, setData] = useState<SourceDatum[]>(initialData);
    const [totalMessages, setTotalMessages] = useState(initialTotal);
    const [isPending, startTransition] = useTransition();

    const handlePeriodChange = (newPeriod: TimePeriod) => {
        setPeriod(newPeriod);
        startTransition(async () => {
            const result = await getMessageSourcesStats(projectId, newPeriod);
            if (result.success) {
                setData(result.data);
                setTotalMessages(result.totalMessages);
            }
        });
    };

    return (
        <Card className={cn("flex flex-col shadow-sm border-border/60 transition-all relative overflow-hidden", className)}>

            {isPending && (
                <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[2px] flex items-center justify-center transition-all duration-300">
                    <div className="bg-background shadow-lg rounded-full p-3 flex items-center gap-2 border border-border/50 animate-in zoom-in-95">
                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                        <span className="text-sm font-medium pr-2">Actualisation...</span>
                    </div>
                </div>
            )}

            <CardHeader className="flex flex-col space-y-4 pb-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                <div className="flex flex-col space-y-1.5">
                    <CardTitle className="text-lg font-semibold tracking-tight">
                        Sources des messages
                    </CardTitle>
                    <CardDescription className="text-muted-foreground text-sm">
                        Répartition : {PERIOD_LABELS[period].toLowerCase()}
                    </CardDescription>
                </div>

                <Select value={period} onValueChange={handlePeriodChange} disabled={isPending}>
                    <SelectTrigger className="w-42.5 h-9 text-xs font-medium focus:ring-offset-0 focus:ring-1 bg-muted/20">
                        <SelectValue placeholder="Choisir une période" />
                    </SelectTrigger>
                    <SelectContent>
                        {Object.entries(PERIOD_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key} className="text-xs cursor-pointer">
                                {label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </CardHeader>

            <CardContent className="flex-1 pb-6 flex flex-col justify-center">
                {totalMessages > 0 ? (
                    <ChartContainer className="mx-auto aspect-square max-h-72 w-full" config={chartConfig}>
                        <PieChart accessibilityLayer>
                            <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                            <Pie
                                data={data}
                                dataKey="count"
                                nameKey="source"
                                cornerRadius={2}
                                innerRadius={40}
                                outerRadius={95}
                                stroke="var(--card)"
                                strokeWidth={2}
                                paddingAngle={3}
                            >
                                <LabelList
                                    className="fill-background font-bold text-[11px]"
                                    dataKey="count"
                                    position="inside"
                                    stroke="none"
                                    // 🛡️ CORRECTION ICI : On utilise "any" pour satisfaire le typage interne de Recharts
                                    // 🛡️ Typage strict avec "unknown" au lieu de "any"
                                    formatter={(val: unknown) => {
                                        // 1. On rejette le vide et les cas de division par zéro
                                        if (totalMessages === 0 || val == null) return "";

                                        // 2. Type Guard : on s'assure que "val" est bien transformable en nombre
                                        if (typeof val !== "number" && typeof val !== "string") return "";

                                        // 3. Conversion sécurisée
                                        const numericValue = Number(val);
                                        if (isNaN(numericValue)) return "";

                                        // 4. Calcul final
                                        const percent = ((numericValue / totalMessages) * 100).toFixed(0);
                                        return percent !== "0" ? `${percent}%` : "";
                                    }}
                                />
                            </Pie>
                            <ChartLegend className="mt-8 flex-wrap justify-center gap-x-6 gap-y-2" content={<ChartLegendContent nameKey="source" />} />
                        </PieChart>
                    </ChartContainer>
                ) : (
                    <div className="flex flex-col aspect-square max-h-70 w-full items-center justify-center text-center animate-in fade-in zoom-in-95 duration-500">
                        <div className="bg-muted/30 p-4 rounded-full mb-3 ring-1 ring-border/50">
                            <PieChartIcon className="w-8 h-8 text-muted-foreground/60" strokeWidth={1.5} />
                        </div>
                        <p className="text-sm font-medium text-foreground">Aucune donnée</p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-50">
                            Les messages reçus sur cette période apparaîtront ici.
                        </p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}