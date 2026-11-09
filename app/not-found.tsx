import Link from "next/link";
import { House } from "lucide-react";

import { NotFoundPage } from "@/components/not-found";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <NotFoundPage
      fallbackHref="/"
      action={
        <Button asChild size="lg">
          <Link href="/">
            <House aria-hidden="true" data-icon="inline-start" />
            Accueil
          </Link>
        </Button>
      }
    />
  );
}
