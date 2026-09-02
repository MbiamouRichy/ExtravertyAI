"use client";

import { Button } from "@/components/ui/button";
import {
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
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import { ArrowRightIcon, Bot, User } from "lucide-react";
import Link from "next/link";

// Type basé sur ton Prisma Schema
type RecentContact = {
	id: string;
	name: string | null;
	pushName: string | null;
	phone: string;
	aiActive: boolean;
};

// Mock de données pour l'exemple
const recentContacts: RecentContact[] = [
	{ id: "c1", name: "Jean Dupont", pushName: "Jeandu241", phone: "24107123456", aiActive: true },
	{ id: "c2", name: null, pushName: "Alice Business", phone: "24107112233", aiActive: false },
	{ id: "c3", name: "Marc Olivier", pushName: "MarcO", phone: "24106554433", aiActive: true },
	{ id: "c4", name: "Sophie Tech", pushName: "Sophie", phone: "24107778899", aiActive: false },
	{ id: "c4", name: "Sophie Tech", pushName: "Sophie", phone: "24107778899", aiActive: false },
	{ id: "c4", name: "Sophie Tech", pushName: "Sophie", phone: "24107778899", aiActive: false },
	{ id: "c4", name: "Sophie Tech", pushName: "Sophie", phone: "24107778899", aiActive: false },
	{ id: "c1", name: "Jean Dupont", pushName: "Jeandu241", phone: "24107123456", aiActive: true },
	{ id: "c2", name: null, pushName: "Alice Business", phone: "24107112233", aiActive: false },
	{ id: "c3", name: "Marc Olivier", pushName: "MarcO", phone: "24106554433", aiActive: true },
	{ id: "c4", name: "Sophie Tech", pushName: "Sophie", phone: "24107778899", aiActive: false },
	{ id: "c4", name: "Sophie Tech", pushName: "Sophie", phone: "24107778899", aiActive: false },
	{ id: "c4", name: "Sophie Tech", pushName: "Sophie", phone: "24107778899", aiActive: false },
	{ id: "c4", name: "Sophie Tech", pushName: "Sophie", phone: "24107778899", aiActive: false },
];

export function DashboardContacts({ projectId }: { projectId: string }) {
	return (
		<DashboardCard className="relative gap-0 md:col-span-2 lg:col-span-3">
			<CardHeader className="border-b">
				<CardTitle className="text-base">Derniers prospects</CardTitle>
				<CardDescription>Contacts WhatsApp récemment actifs sur ce projet.</CardDescription>
			</CardHeader>
			<CardContent className="px-0 max-h-72 mask-b-from-50% mask-b-to-100%">
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
										<Badge variant="secondary" className="gap-1 font-normal bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
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
			<div className="mask-t-from-30% absolute inset-x-0 bottom-0 flex h-1/5  items-center justify-center bg-linear-to-t from-background to-background/0">
				<Button asChild className="relative" variant="ghost" size="sm">
					<Link href={`/projects/${projectId}/analytics/contacts`}>
						Voir tout le CRM
						<ArrowRightIcon className="ml-2 h-4 w-4" aria-hidden="true" />
					</Link>
				</Button>
			</div>
		</DashboardCard>
	);
}