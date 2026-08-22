import { cn } from "@/lib/utils";
import { DecorIcon } from "./decor-icon";

export default function CustomCard({ children, className }: { children: React.ReactNode, className?: string }) {
    return (
        <div className={cn("relative", className)}>
            <div className="absolute -inset-y-6 -left-px w-px bg-border" />
            <div className="absolute -inset-y-6 -right-px w-px bg-border" />
            <div className="absolute -inset-x-6 -top-px h-px bg-border" />
            <div className="absolute -inset-x-6 -bottom-px h-px bg-border" />
            <DecorIcon position="top-left" />
            <DecorIcon position="bottom-right" />
            <div className="w-full">
                {children}
            </div>
        </div>
    )
}
