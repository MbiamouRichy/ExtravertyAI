import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/** Icône de l’entreprise, ou son initiale tant qu’aucune image n’est choisie. */
export function ProjectIcon({
  name,
  logoUrl,
  className,
  fallbackClassName,
}: {
  name: string;
  logoUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
}) {
  return (
    <Avatar
      className={cn("size-10 shrink-0 rounded-xl after:rounded-xl", className)}
    >
      {logoUrl && (
        <AvatarImage src={logoUrl} alt="" className="rounded-xl object-cover" />
      )}
      <AvatarFallback
        className={cn(
          "rounded-xl bg-primary font-heading text-sm font-bold text-primary-foreground",
          fallbackClassName,
        )}
      >
        {name.trim().slice(0, 1).toUpperCase() || "P"}
      </AvatarFallback>
    </Avatar>
  );
}
