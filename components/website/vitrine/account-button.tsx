"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/auth-client";

/**
 * True once a session is known. The server render and the first client render
 * agree (no session yet), so the page stays static and hydration-safe.
 */
export function useSignedIn() {
  const { data } = useSession();
  return !!data?.user;
}

type AccountButtonProps = Omit<ComponentProps<typeof Button>, "asChild" | "children" | "onClick"> & {
  /** Destination for visitors: sign-up or sign-in. */
  href: string;
  children: ReactNode;
  /** Destination once signed in: the customer space by default. */
  signedInHref?: string;
  /** Label once signed in; the visitor label is kept when omitted. */
  signedInLabel?: ReactNode;
  onNavigate?: () => void;
};

/**
 * Sign-up and sign-in calls to action, which lead a signed-in customer to their
 * space instead of showing them the forms again.
 */
export function AccountButton({
  href,
  children,
  signedInHref = "/projects",
  signedInLabel,
  onNavigate,
  ...props
}: AccountButtonProps) {
  const signedIn = useSignedIn();
  return (
    <Button asChild {...props}>
      <Link href={signedIn ? signedInHref : href} onClick={onNavigate}>
        {signedIn && signedInLabel ? signedInLabel : children}
      </Link>
    </Button>
  );
}
