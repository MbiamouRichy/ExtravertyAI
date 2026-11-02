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
                "flex min-h-48 w-full flex-col items-center justify-center rounded-lg",
                "border border-dashed px-6 py-6 text-center",
                className,
            )}
        >
            <Icon
                aria-hidden="true"
                className="mb-3 size-5 text-muted-foreground"
                strokeWidth={1.5}
            />

            <p className="text-sm font-medium">{title}</p>

            <p className="mt-1 max-w-64 text-xs leading-relaxed text-muted-foreground">
                {description}
            </p>
        </div>
    );
}