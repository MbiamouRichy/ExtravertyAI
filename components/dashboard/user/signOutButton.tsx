"use client"
import { Button } from '@/components/ui/button';
import { signOut } from '@/lib/auth-client';
import { cn } from '@/lib/utils';
import { LogOutIcon } from 'lucide-react';
import { redirect } from 'next/navigation';

function SignOutButton({ variant, className }: { variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"; className?: string }) {
    return (
        <Button onClick={() => {
            signOut()
            redirect("/sign-in");
        }}
            className={cn("cursor-pointer", className)}
            variant={variant || "destructive"}
        >
            <LogOutIcon
            />
            Se déconnecter
        </Button>
    )
}

export default SignOutButton