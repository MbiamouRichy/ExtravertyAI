'use client'
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";
import Link from "next/link";

 const SignOutButton = () => {
  return <Button asChild onClick={() => signOut()}><Link href="/sign-in">Sign Out</Link></Button>;
};

export default SignOutButton