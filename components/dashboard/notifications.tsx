"use client";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import React from "react";


export function Notifications({children}:{children: React.ReactNode}) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {children}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem className="flex items-center justify-start gap-2">
                    <DropdownMenuLabel className="flex items-center gap-3">
                       notification
                    </DropdownMenuLabel>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
