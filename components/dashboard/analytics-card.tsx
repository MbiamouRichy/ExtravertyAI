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
                "flex h-full min-w-0 flex-col gap-0 overflow-hidden bg-card py-0",
                className,
            )}
        >
            <CardHeader className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-4 pt-4 pb-3 sm:px-5">
                <div className="min-w-0 space-y-0.5">
                    <CardTitle className="text-sm font-medium tracking-tight">
                        {title}
                    </CardTitle>

                    <CardDescription className="text-xs">
                        {description}
                    </CardDescription>
                </div>

                {aside && <div className="shrink-0">{aside}</div>}
            </CardHeader>

            <CardContent className="min-w-0 flex-1 px-4 pb-4 sm:px-5">
                {children}
            </CardContent>

            {footer && (
                <div className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground sm:px-5">
                    {footer}
                </div>
            )}
        </Card>
    );
}