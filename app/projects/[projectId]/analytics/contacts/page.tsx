import { Metadata } from "next";
import { Users, Bot, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ContactsTableColumns, ContactTableType } from "@/components/dashboard/project/contacts-column";
import { ContactsTable } from "@/components/dashboard/project/contacts-table";
// Ajuste le chemin

export const metadata: Metadata = {
    title: "CRM Contacts | ExtravertyAI",
    description: "Gérez vos prospects WhatsApp et suivez les conversations.",
};

interface ContactsPageProps {
    params: {
        projectId: string;
    };
}

// 🧪 MOCK DATA : À utiliser uniquement pour tester l'UI
export const mockContacts: ContactTableType[] = [
    {
        id: "cuid_test_1",
        phone: "24107010203",
        pushName: "Jeandu241",
        name: "Jean Dupont (VIP)",
        aiActive: true,
        createdAt: new Date("2026-09-01T10:30:00Z"),
        projectId: "proj_demo",
    },
    {
        id: "cuid_test_2",
        phone: "24106554433",
        pushName: "AliceB",
        name: null, // Test UI: Le système doit afficher le pushName avec le fallback
        aiActive: false,
        createdAt: new Date("2026-09-01T14:15:00Z"),
        projectId: "proj_demo",
    },
    {
        id: "cuid_test_3",
        phone: "24107778899",
        pushName: "Marc Olivier Très Long Nom de Famille", // Test UI: Vérifier que la cellule se tronque bien
        name: "Marc O.",
        aiActive: true,
        createdAt: new Date("2026-08-30T09:00:00Z"),
        projectId: "proj_demo",
    },
    {
        id: "cuid_test_4",
        phone: "24101112233",
        pushName: "Sophie Tech",
        name: "Sophie - Support",
        aiActive: false,
        createdAt: new Date("2026-08-28T16:45:00Z"),
        projectId: "proj_demo",
    },
    {
        id: "cuid_test_5",
        phone: "33612345678", // Test UI: Un numéro international différent
        pushName: "Client_FR_01",
        name: null,
        aiActive: true,
        createdAt: new Date("2026-08-25T11:20:00Z"),
        projectId: "proj_demo",
    },
    {
        id: "cuid_test_6",
        phone: "24104445566",
        pushName: "Entreprise XYZ",
        name: "Directeur XYZ",
        aiActive: true,
        createdAt: new Date("2026-08-15T08:00:00Z"),
        projectId: "proj_demo",
    },
];
// 🚀 Server Component : Chargement ultra-rapide côté serveur
export default async function ContactsPage({ params }: ContactsPageProps) {
    const { projectId } = params;
    console.log(projectId)

    // 1. Récupération des données réelles via Prisma
    // Utilisation d'une requête optimisée sans charger les messages pour la vue globale
    // const contacts = await prisma.contact.findMany({
    //     where: { projectId },
    //     orderBy: { createdAt: "desc" },
    //     select: {
    //         id: true,
    //         phone: true,
    //         pushName: true,
    //         name: true,
    //         aiActive: true,
    //         createdAt: true,
    //         projectId: true,
    //     },
    // });

    const contacts = mockContacts;

    // 2. Calcul des KPI pour le dashboard CRM
    const totalContacts = contacts.length;
    const aiHandledCount = contacts.filter(c => c.aiActive).length;
    const humanHandledCount = totalContacts - aiHandledCount;

    // Formatage des données pour la table (si nécessaire)
    // Ici, le typage Prisma correspond parfaitement à notre ContactTableType
    const tableData: ContactTableType[] = contacts;

    return (
        <div className="flex-1 space-y-6 p-8 pt-6">
            {/* --- EN-TÊTE DE PAGE --- */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Contacts CRM</h2>
                    <p className="text-muted-foreground mt-1 text-sm">
                        Gérez vos prospects WhatsApp, analysez l&apos;activité et reprenez la main sur l&apos;IA.
                    </p>
                </div>
            </div>

            {/* --- KPI CARDS (Dashboard Rapide) --- */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="bg-background shadow-sm border-neutral-200 dark:border-neutral-800">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Prospects
                        </CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalContacts.toLocaleString('fr-FR')}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Contacts uniques sur ce projet
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-background shadow-sm border-neutral-200 dark:border-neutral-800">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Gérés par l&apos;IA
                        </CardTitle>
                        <Bot className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{aiHandledCount.toLocaleString('fr-FR')}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Réponses 100% automatisées
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-background shadow-sm border-neutral-200 dark:border-neutral-800">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">
                            Assignés aux agents
                        </CardTitle>
                        <User className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{humanHandledCount.toLocaleString('fr-FR')}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Nécessitent une intervention humaine
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* --- TABLEAU AVANCÉ --- */}
            <div className="mt-8">
                {/* On passe les données au Client Component (la table Interactive) */}
                <ContactsTable columns={ContactsTableColumns} data={tableData} />
            </div>
        </div>
    );
}