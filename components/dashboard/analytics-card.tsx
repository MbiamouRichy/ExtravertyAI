import type { ReactNode } from "react";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AnalyticsCardProps {
    title: string;
    description: string;
    aside?: ReactNode;
    footer?: ReactNode;
    children: ReactNode;
    className?: string;
}

export function AnalyticsCard({
    title,
    description,
    aside,
    footer,
    children,
    className,
}: AnalyticsCardProps) {
    return (
        <Card
            className={cn(
                "flex h-full min-w-0 flex-col gap-0 overflow-hidden rounded-2xl",
                "border-border/70 bg-card py-0 shadow-sm",
                className,
            )}
        >
            <CardHeader className="flex flex-col gap-3 px-4 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6">
                <div className="min-w-0 space-y-1.5">
                    <CardTitle className="text-sm font-semibold tracking-tight">
                        {title}
                    </CardTitle>

                    <CardDescription className="text-xs leading-relaxed">
                        {description}
                    </CardDescription>
                </div>

                {aside && <div className="shrink-0">{aside}</div>}
            </CardHeader>

            <CardContent className="min-w-0 flex-1 px-4 pb-5 sm:px-6">
                {children}
            </CardContent>

            {footer && (
                <div className="border-t border-border/60 bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground sm:px-6">
                    {footer}
                </div>
            )}
        </Card>
    );
}