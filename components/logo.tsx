import { cn } from "@/lib/utils";
import Image from "next/image";
import type React from "react";

export const LogoIcon = ({ className, LogoClassName }: { className?: string; LogoClassName?: string }) => (
  <div className={cn("flex items-center", className)}>
    <Logo className={cn(LogoClassName)} />
    <p className="text-lg font-extrabold font-bricolage-grotesque">
      ExtravertyAI
    </p>
  </div>
);

export const Logo = ({ className }: { className?: string }) => (
  <>
    <Image
      src={"/logo.png"}
      alt="logo"
      width={100}
      height={100}
      className={cn("dark:hidden block", className)}
    />
    <Image
      src={"/logo-blanc.png"}
      alt="logo"
      width={100}
      height={100}
      className={cn("dark:block hidden", className)}
    />
  </>
);
