import { NotFoundPage } from "@/components/not-found";
import { Button } from "@/components/ui/button";
import { HomeIcon } from "lucide-react";
import Link from "next/link";


export default function NotFound() {
  return (
    <NotFoundPage personalButton={
      <Button asChild>
        <Link title="page d'accueil" href="/">
          <HomeIcon data-icon="inline-start" />
          Accueil
        </Link>
      </Button>}
    />
  )
}
