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
    select: {
      id: true,
      name: true,
      pushName: true,
      phone: true,
      aiActive: true,
    },
  });

  return (
    <Card className="relative min-w-0 gap-0">
      <CardHeader className="border-b">
        <CardTitle className="text-base">Derniers prospects</CardTitle>
        <CardDescription>
          Contacts WhatsApp récemment actifs sur ce projet.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <Table className="table-fixed sm:table-auto">
          <TableCaption className="sr-only">
            Liste des derniers contacts WhatsApp.
          </TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/2 ps-4 sm:w-auto sm:ps-6">
                Contact
              </TableHead>
              <TableHead className="w-1/2 pe-4 sm:w-auto">Numéro</TableHead>
              <TableHead className="hidden pe-6 text-right sm:table-cell">
                Prise en charge
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentContacts.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="h-24 text-center text-muted-foreground"
                >
                  Aucun contact pour le moment.
                </TableCell>
              </TableRow>
            )}
            {recentContacts.map((contact) => (
              <TableRow className="h-12" key={contact.id}>
                <TableCell className="whitespace-normal break-words ps-4 font-medium sm:max-w-40 sm:truncate sm:whitespace-nowrap sm:ps-6">
                  {contact.name || contact.pushName || "Inconnu"}
                  {!contact.name && contact.pushName && (
                    <span className="ml-2 hidden sm:inline text-xs text-muted-foreground">
                      (WhatsApp)
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-normal break-all pe-4 text-muted-foreground font-mono text-xs sm:whitespace-nowrap sm:break-normal sm:text-sm">
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
