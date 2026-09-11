import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChartEmptyStateProps {
    icon: LucideIcon;
    title: string;
    description: string;
    className?: string;
}

export function ChartEmptyState({
    icon: Icon,
    title,
    description,
    className,
}: ChartEmptyStateProps) {
    return (
        <div
            className={cn(
                "flex min-h-64 w-full flex-col items-center justify-center rounded-xl",
                "border border-dashed border-border/80 bg-muted/20 px-6 py-8 text-center",
                className,
            )}
        >
            <div className="mb-4 rounded-2xl border bg-background p-3 shadow-sm">
                <Icon
                    aria-hidden="true"
                    className="size-5 text-muted-foreground"
                    strokeWidth={1.5}
                />
            </div>

            <p className="text-sm font-medium">{title}</p>

            <p className="mt-2 max-w-64 text-xs leading-relaxed text-muted-foreground">
                {description}
            </p>
        </div>
    );
}