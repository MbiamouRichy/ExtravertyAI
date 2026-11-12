import Link from "next/link";
import { BriefcaseBusiness } from "lucide-react";

import { NotFoundPage } from "@/components/not-found";
import { Button } from "@/components/ui/button";

export default function NotFoundDashboard() {
  return (
    <NotFoundPage
      fallbackHref="/projects"
      action={
        <Button asChild size="lg">
          <Link href="/projects">
            <BriefcaseBusiness aria-hidden="true" data-icon="inline-start" />
            Mes projets
          </Link>
        </Button>
      }
    />
  );
}
