import {
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Delta, DeltaIcon, DeltaValue } from "@/components/delta";
import { DashboardCard } from "@/components/dashboard/dashboard-card";
import prisma from "@/lib/prisma"; // Assure-toi que ce chemin correspond à ton instance Prisma

type Stat = {
	label: string;
	value: string;
	delta: number;
	invertDelta?: boolean; // Permet de dire que "moins c'est mieux" (ex: pour les erreurs ou interventions)
};

// Fonction utilitaire pour calculer le pourcentage de croissance
const calculateDelta = (current: number, previous: number): number => {
	if (previous === 0) return current > 0 ? 100 : 0;
	return Number((((current - previous) / previous) * 100).toFixed(1));
};

// Formateur pour les grands nombres (ex: 1200 -> 1 200)
const formatNumber = (num: number) => new Intl.NumberFormat('fr-FR').format(num);

export async function DashboardStats({ projectId }: { projectId: string }) {
	// Définition des fenêtres temporelles : 7 derniers jours vs 7 jours précédents
	const now = new Date();
	const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

	// Exécution de toutes les requêtes en parallèle (Performance 🚀)
	const [
		currentContacts, prevContacts,
		currentInbound, prevInbound,
		currentBotReplies, prevBotReplies,
		currentHumanHandoff, prevHumanHandoff,
	] = await Promise.all([
		// 1. Nouveaux Contacts
		prisma.contact.count({ where: { projectId, createdAt: { gte: sevenDaysAgo } } }),
		prisma.contact.count({ where: { projectId, createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),

		// 2. Messages Reçus (Clients)
		prisma.message.count({ where: { projectId, senderType: "CLIENT", createdAt: { gte: sevenDaysAgo } } }),
		prisma.message.count({ where: { projectId, senderType: "CLIENT", createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),

		// 3. Réponses Automatisées (Bot)
		prisma.message.count({ where: { projectId, senderType: "BOT", createdAt: { gte: sevenDaysAgo } } }),
		prisma.message.count({ where: { projectId, senderType: "BOT", createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),

		// 4. Interventions Humaines (Contacts où l'IA a été désactivée par un agent)
		// Note: On regarde les messages envoyés par un AGENT sur la période.
		prisma.message.count({ where: { projectId, senderType: "AGENT", createdAt: { gte: sevenDaysAgo } } }),
		prisma.message.count({ where: { projectId, senderType: "AGENT", createdAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
	]);

	// Construction du tableau de statistiques
	const stats: Stat[] = [
		{
			label: "Nouveaux Contacts",
			value: formatNumber(currentContacts),
			delta: calculateDelta(currentContacts, prevContacts),
		},
		{
			label: "Messages Reçus",
			value: formatNumber(currentInbound),
			delta: calculateDelta(currentInbound, prevInbound),
		},
		{
			label: "Réponses du Bot",
			value: formatNumber(currentBotReplies),
			delta: calculateDelta(currentBotReplies, prevBotReplies),
		},
		{
			label: "Interventions Humaines",
			value: formatNumber(currentHumanHandoff),
			delta: calculateDelta(currentHumanHandoff, prevHumanHandoff),
			invertDelta: true, // Moins d'interventions humaines = meilleure autonomie de l'IA
		},
	];

	/* ===================================================
	A Supprimer ce bloc de code si tu veux utiliser les vraies stats depuis la base de données.
	===================================================
				*/
	type Stat = {
		label: string;
		value: string;
		delta: number;
		invertDelta?: boolean;
	};

	// Données de test générées en dur
	const mockStats: Stat[] = [
		{
			label: "Nouveaux Contacts",
			value: "25",
			delta: 150.0
		},
		{
			label: "Messages Reçus",
			value: "110",
			delta: 175.0
		},
		{
			label: "Réponses du Bot",
			value: "100",
			delta: 185.7
		},
		{
			label: "Interventions Humaines",
			value: "5",
			delta: -50.0,
			invertDelta: true // Indique que cette baisse est une bonne chose !
		},
	] as const;


	/* ===================================================
	
	===================================================*/

	return (
		<>
			{/* {N'oublie pas de remplacer mockStats par les vraies stats} */}
			{mockStats.map((s) => (
				<DashboardCard className="" key={s.label}>
					<CardHeader className="flex flex-row items-center justify-between pb-2">
						<CardTitle className="font-medium text-sm text-muted-foreground tracking-wide">
							{s.label}
						</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-1">
						<p className="font-semibold text-3xl tabular-nums tracking-tight">
							{s.value}
						</p>
					</CardContent>
					<CardFooter className="gap-2 rounded-none bg-background text-xs pt-1">
						{/* L'attribut 'invertDelta' pourrait être géré dans ton composant Delta pour inverser les couleurs (ex: une baisse des interventions humaines est positive, donc en vert) */}
						<Delta value={s.delta}>
							<DeltaIcon />
							<DeltaValue />
						</Delta>
						<span className="text-muted-foreground">vs sem. dernière</span>
					</CardFooter>
				</DashboardCard>
			))}
		</>
	);
}