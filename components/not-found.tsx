import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import { HomeIcon, PhoneIcon } from "lucide-react";
import Link from "next/link";

export function NotFoundPage() {
	return (
		<div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden">
			<Empty>
				<EmptyHeader>
					<EmptyTitle className="mask-b-from-20% mask-b-to-80% font-extrabold text-9xl">
						404
					</EmptyTitle>
					<EmptyDescription className="-mt-8 text-nowrap text-foreground/80">
						La page que vous recherchez n{`'`}existe pas ou a été déplacée.<br />
						Veuillez vérifier l{`'`}URL ou rechercher une page.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>
					<div className="flex gap-2">
						<Button asChild>
							<Link title="page d'accueil" href="/">
								<HomeIcon data-icon="inline-start" />
								Accueil
							</Link>
						</Button>

						<Button asChild variant="outline">
							<Link title="page de contact" href="/contact">
								<PhoneIcon data-icon="inline-start" />{" "}
								Contacter-nous
							</Link>
						</Button>
					</div>
				</EmptyContent>
			</Empty>
		</div>
	);
}
