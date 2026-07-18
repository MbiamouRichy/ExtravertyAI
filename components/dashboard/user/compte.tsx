import ProfileUtilisateur from "./profileUtilisateur";
import AbonnementFacturation from "./abonnement&Facturation";
import ProjectsRecents from "./projectsRecents";

// Données fictives pour l'exemple (à remplacer par tes appels DB/Prisma)
const user = {
    name: "Richy Tchogna",
    email: "contact@extravertyai.com",
    role: "Administrateur",
    plan: "Pro",
};

const recentProjects = [
    { id: "1", name: "Support Client - Gabon", numero: "24177000000", status: "active", date: "12 Juin 2026" },
    { id: "2", name: "Campagne Leads VIP", numero: "24177111111", status: "connecting", date: "10 Juin 2026" },
];

export default function AccountPage() {
    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in pb-10">

            {/* En-tête de la page */}
            <div>
                <h1 className="text-3xl font-bold tracking-tight text-neutral-900">Mon Compte</h1>
                <p className="text-neutral-500 mt-1">
                    Gérez vos informations personnelles, votre abonnement et vos projets.
                </p>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                {/* SECTION 1 : PROFIL UTILISATEUR */}
                <ProfileUtilisateur user={user} />

                {/* SECTION 2 : ABONNEMENT & FACTURATION */}
                <AbonnementFacturation user={user} />
            </div>

            {/* SECTION 3 : PROJETS RÉCENTS */}
            <ProjectsRecents recentProjects={recentProjects} />
        </div>
    );
}