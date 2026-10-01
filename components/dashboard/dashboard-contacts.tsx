import prisma from "@/lib/prisma";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowRightIcon, Bot, User } from "lucide-react";
import Link from "next/link";

export async function DashboardContacts({ projectId }: { projectId: string }) {
	const recentContacts = await prisma.contact.findMany({
		where: { projectId },
		orderBy: [
			{ lastMessageAt: { sort: "desc", nulls: "last" } },
			{ createdAt: "desc" },
			{ id: "desc" },
		],
		take: 5,
		select: { id: true, name: true, pushName: true, phone: true, aiActive: true },
	});

	return (
		<Card className="relative gap-0 md:col-span-2 lg:col-span-3">
			<CardHeader className="border-b">
				<CardTitle className="text-base">Derniers prospects</CardTitle>
				<CardDescription>Contacts WhatsApp récemment actifs sur ce projet.</CardDescription>
			</CardHeader>
			<CardContent className="px-0">
				<Table>
					<TableCaption className="sr-only">Liste des derniers contacts WhatsApp.</TableCaption>
					<TableHeader>
						<TableRow>
							<TableHead className="ps-6">Contact</TableHead>
							<TableHead>Numéro</TableHead>
							<TableHead className="pe-6 text-right">Prise en charge</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{recentContacts.length === 0 && (
							<TableRow>
								<TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
									Aucun contact pour le moment.
								</TableCell>
							</TableRow>
						)}
						{recentContacts.map((contact) => (
							<TableRow className="h-12" key={contact.id}>
								<TableCell className="max-w-40 truncate ps-6 font-medium">
									{contact.name || contact.pushName || "Inconnu"}
									{!contact.name && contact.pushName && (
										<span className="ml-2 text-xs text-muted-foreground">(WhatsApp)</span>
									)}
								</TableCell>
								<TableCell className="text-muted-foreground font-mono text-sm">
									+{contact.phone}
								</TableCell>
								<TableCell className="pe-6 text-right">
									{contact.aiActive ? (
										<Badge variant="secondary" className="gap-1 font-normal">
											<Bot className="h-3 w-3" /> IA
										</Badge>
									) : (
										<Badge variant="outline" className="gap-1 font-normal">
											<User className="h-3 w-3" /> Agent
										</Badge>
									)}
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</CardContent>
			<div className="flex items-center mt-auto justify-center border-t py-3">
				<Button asChild className="relative" variant="ghost" size="sm">
					<Link href={`/projects/${projectId}/contacts`}>
						Voir tout le CRM
						<ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
					</Link>
				</Button>
			</div>
		</Card>
	);
}