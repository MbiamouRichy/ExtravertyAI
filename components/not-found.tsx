"use client";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import { ArrowLeftIcon } from "lucide-react";
import { useRouter } from "next/navigation";

export function NotFoundPage({ personalButton }: { personalButton: React.ReactNode }) {
	const router = useRouter();
	const handleGoBack = () => {
		router.back();
	};
	return (
		<div className="flex min-h-screen p-4 w-screen items-center justify-center overflow-x-hidden">
			<Empty className="p-0 md:p-12">
				<EmptyHeader>
					<EmptyTitle className="mask-b-from-20% mask-b-to-80% font-extrabold text-9xl">
						404
					</EmptyTitle>
					<EmptyDescription className="-mt-8 md:text-nowrap text-foreground/80 text-base md:text-lg">
						La page que vous recherchez n{`'`}existe pas ou a été déplacée.<br />
						Veuillez vérifier l{`'`}URL ou retourner en arrière.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent>

					<div className="flex gap-2">
						{personalButton}

						<Button variant="outline" onClick={handleGoBack}>
							<ArrowLeftIcon data-icon="inline-start" />{" "}
							Retour en arrière
						</Button>
					</div>

				</EmptyContent>
			</Empty>
		</div>
	);
}
